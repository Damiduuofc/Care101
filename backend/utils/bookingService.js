import Appointment from "../models/Appointment.js";
import Bill from "../models/Bill.js";
import Doctor from "../models/Doctor.js";
import Notification from "../models/Notification.js";
import ScheduleRequest from "../models/ScheduleRequest.js";
import {
  getChannelingFees,
  UNPAID_HOLD_MINUTES,
  MIN_UNPAID_HOLD_MINUTES,
  PATIENT_CHANGE_CUTOFF_MINUTES
} from "../config/fees.js";
import { assignQueueToken, dayRange, peekNextToken } from "./queueToken.js";
import { emitAppointmentUpdated, emitNotification } from "./realtime.js";
import {
  stripe,
  markBillPaid,
  verifyIntentForBill,
  reverseChannelingIncome
} from "./paymentService.js";

// Thrown for anything the user can fix; routes turn it into a JSON { msg } response
export class BookingError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const sendBookingError = (res, err, fallback = "Something went wrong. Please try again.") => {
  if (err instanceof BookingError) {
    return res.status(err.status).json({ msg: err.message });
  }
  console.error(fallback, err);
  return res.status(500).json({ msg: fallback });
};

const idOf = (value) => String(value?._id || value || "");

const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" });

const formatDay = (date) =>
  new Date(date).toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" });

const notify = async (io, userId, type, title, message, metadata = {}) => {
  try {
    const notif = await Notification.create({ userId, type, title, message, metadata });
    emitNotification(io, notif);
  } catch (err) {
    console.error("Booking notification error:", err.message);
  }
};

// Bookings that take up a place: paid ones, plus unpaid ones whose hold has not run out
const holdsPlace = (now) => ({
  $or: [
    { paymentStatus: "paid" },
    { holdExpiresAt: { $gt: now } },
    // Bookings made before holds existed: treat as held for the normal hold window after booking
    { holdExpiresAt: { $exists: false }, createdAt: { $gt: new Date(now.getTime() - UNPAID_HOLD_MINUTES * 60000) } }
  ]
});

// Bookings for one session (older bookings have no scheduleId and are matched by doctor and day)
const inSession = (schedule) => ({
  $or: [
    { scheduleId: schedule._id },
    { scheduleId: { $exists: false }, doctorId: schedule.doctorId, date: dayRange(schedule.date) }
  ]
});

const activeInSession = (schedule, now = new Date()) => ({
  $and: [inSession(schedule), holdsPlace(now), { status: { $nin: ["cancelled"] } }]
});

const sessionStart = (schedule) => new Date(schedule.startTime || schedule.date);

// Approved session to book. Older clients send only a date: use that day's next open session.
export const findBookableSession = async ({ doctorId, scheduleId, date }) => {
  let schedule = null;
  if (scheduleId) {
    schedule = await ScheduleRequest.findOne({ _id: scheduleId, doctorId, status: "approved" });
  } else if (date) {
    const sessions = await ScheduleRequest.find({ doctorId, status: "approved", date: dayRange(date) }).sort({ startTime: 1 });
    schedule = sessions.find(s => !s.sessionEnded && new Date(s.endTime) > new Date()) || sessions[0] || null;
  }

  if (!schedule) {
    throw new BookingError("This doctor has no approved session at the selected time.");
  }
  if (schedule.sessionEnded || new Date(schedule.endTime) <= new Date()) {
    throw new BookingError("This session has already ended. Please choose another session.");
  }
  return schedule;
};

// Places left, the next token and an estimated consultation time for a session
export const getSessionAvailability = async (schedule, doctor = null) => {
  const now = new Date();
  const booked = await Appointment.countDocuments(activeInSession(schedule, now));
  const limit = schedule.isUnlimited ? null : (schedule.queueLimit || null);
  const remaining = limit === null ? null : Math.max(0, limit - booked);

  const doc = doctor || await Doctor.findById(schedule.doctorId).select("averageConsultationDuration channelingFee");
  const nextToken = await peekNextToken(schedule.doctorId, schedule.date);
  const avgMinutes = doc?.averageConsultationDuration || 10;
  const estimatedTime = new Date(sessionStart(schedule).getTime() + booked * avgMinutes * 60000);
  const ended = schedule.sessionEnded || new Date(schedule.endTime) <= now;

  return {
    booked,
    limit,
    remaining,
    isFull: remaining === 0,
    isEnded: ended,
    nextToken,
    estimatedTime,
    fees: getChannelingFees(doc)
  };
};

export const assertSessionHasRoom = async (schedule) => {
  const availability = await getSessionAvailability(schedule);
  if (availability.isFull) {
    throw new BookingError("Sorry, this session is full. Please choose another session.");
  }
  return availability;
};

const assertNoDuplicateBooking = async (patientId, schedule, ignoreId = null) => {
  const existing = await Appointment.findOne({
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {}),
    patientId,
    ...activeInSession(schedule)
  });
  if (existing) {
    throw new BookingError("You already have a booking in this session.");
  }
};

// Saves with a queue token. Retries once if the unique token index rejects a duplicate.
const saveWithToken = async (appointment) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    await assignQueueToken(appointment);
    try {
      return await appointment.save();
    } catch (err) {
      if (err?.code !== 11000 || attempt === 1) throw err;
      appointment.queueNumber = undefined;
    }
  }
};

// The count is checked again after saving: if a simultaneous booking took the last place,
// this one is rolled back instead of overbooking the session.
const rollbackIfOverbooked = async (appointment, schedule, { removeBooking = true } = {}) => {
  if (schedule.isUnlimited || !schedule.queueLimit) return;
  const booked = await Appointment.countDocuments(activeInSession(schedule));
  if (booked > schedule.queueLimit) {
    if (removeBooking) await Appointment.deleteOne({ _id: appointment._id });
    throw new BookingError("Sorry, this session just filled up. Please choose another session.");
  }
};

// Normally the hold lasts UNPAID_HOLD_MINUTES or until the session starts. A session that has
// already started (or starts any minute) still gets MIN_UNPAID_HOLD_MINUTES to pay, so closing
// the payment sheet doesn't release the place straight away. Never past the session end.
const holdUntil = (schedule) => {
  const now = Date.now();
  const byHoldWindow = now + UNPAID_HOLD_MINUTES * 60000;
  const minimum = now + MIN_UNPAID_HOLD_MINUTES * 60000;
  const sessionEnd = new Date(schedule.endTime || sessionStart(schedule)).getTime();
  const until = Math.max(Math.min(byHoldWindow, sessionStart(schedule).getTime()), minimum);
  return new Date(Math.min(until, sessionEnd));
};

// Creates an unpaid booking with a reserved token and an open bill. Payment always happens
// afterwards (card via Stripe, or cash recorded by staff), never by trusting the client.
export const createBooking = async ({ patientId, schedule, visitType, reason, io }) => {
  const doctor = await Doctor.findById(schedule.doctorId);
  if (!doctor) throw new BookingError("Doctor not found.", 404);

  await assertNoDuplicateBooking(patientId, schedule);
  await assertSessionHasRoom(schedule);

  const fees = getChannelingFees(doctor);
  const doctorName = doctor.fullName || doctor.name || schedule.doctorName || "Doctor";

  const appointment = new Appointment({
    patientId,
    doctorId: doctor._id,
    doctorName,
    department: doctor.specialization || "General",
    scheduleId: schedule._id,
    date: sessionStart(schedule),
    visitType: visitType || "Consultation",
    reason,
    amount: fees.total,
    status: "pending",
    paymentStatus: "pending",
    holdExpiresAt: holdUntil(schedule)
  });

  await saveWithToken(appointment);
  await rollbackIfOverbooked(appointment, schedule);

  const bill = await Bill.create({
    patientId,
    appointmentId: appointment._id,
    title: `Consultation - ${doctorName}`,
    type: "Appointment",
    amount: fees.total,
    status: "Pending",
    date: new Date()
  });

  await notify(
    io, patientId, "appointment", "Booking Reserved",
    `Token #${appointment.queueNumber} with ${doctorName} on ${formatDay(appointment.date)} is reserved. ` +
    `Pay LKR ${fees.total.toLocaleString()} by ${formatTime(appointment.holdExpiresAt)} to keep your place.`,
    { appointmentId: appointment._id }
  );

  emitAppointmentUpdated(io, appointment);
  return { appointment, bill, fees };
};

const findOrCreateBill = async (appointment) => {
  let bill = await Bill.findOne({ appointmentId: String(appointment._id) });
  if (!bill) {
    bill = await Bill.create({
      patientId: appointment.patientId,
      appointmentId: appointment._id,
      title: `Consultation - ${appointment.doctorName}`,
      type: "Appointment",
      amount: appointment.amount,
      status: "Pending",
      date: new Date()
    });
  }
  return bill;
};

// Staff collected cash at the counter
export const recordCashPayment = async (appointment, io) => {
  if (appointment.status === "cancelled") {
    throw new BookingError("This booking was cancelled and can no longer be paid.");
  }
  const bill = await findOrCreateBill(appointment);
  if (bill.status === "Paid") return { bill, appointment, alreadyPaid: true };
  if (bill.status !== "Pending") {
    throw new BookingError(`This bill is ${bill.status.toLowerCase()} and cannot be paid.`);
  }
  return markBillPaid(bill._id, null, io);
};

const sessionForAppointment = async (appointment) => {
  if (appointment.scheduleId) {
    const schedule = await ScheduleRequest.findById(appointment.scheduleId);
    if (schedule) return schedule;
  }
  return ScheduleRequest.findOne({
    doctorId: appointment.doctorId,
    status: "approved",
    date: dayRange(appointment.date)
  }).sort({ startTime: 1 });
};

// Whether the patient (not staff) may still change this booking, and why not
export const patientChangePolicy = async (appointment, schedule = undefined) => {
  if (appointment.status === "cancelled") return { allowed: false, reason: "This booking is already cancelled." };
  if (appointment.status === "completed") return { allowed: false, reason: "This consultation is already completed." };
  if (appointment.arrived) return { allowed: false, reason: "You have already checked in. Please speak to the reception desk." };

  const session = schedule === undefined ? await sessionForAppointment(appointment) : schedule;
  const start = session ? sessionStart(session) : new Date(appointment.date);
  const cutoff = new Date(start.getTime() - PATIENT_CHANGE_CUTOFF_MINUTES * 60000);
  if (new Date() >= cutoff) {
    return {
      allowed: false,
      reason: `Bookings can only be changed up to ${PATIENT_CHANGE_CUTOFF_MINUTES} minutes before the session. Please call the hospital.`
    };
  }
  return { allowed: true, cutoff };
};

// Cancels a booking and settles its bill: open bills are closed, card payments are refunded
// through Stripe, cash payments are marked for a refund at the counter.
export const cancelAppointment = async (appointment, { byStaff = false, reason = "", io, notifyPatient = true } = {}) => {
  if (!byStaff) {
    const policy = await patientChangePolicy(appointment);
    if (!policy.allowed) throw new BookingError(policy.reason);
  } else if (["cancelled", "completed"].includes(appointment.status)) {
    throw new BookingError(`This booking is already ${appointment.status}.`);
  }

  appointment.status = "cancelled";
  appointment.cancelledAt = new Date();
  appointment.cancelReason = reason || (byStaff ? "Cancelled by hospital" : "Cancelled by patient");
  appointment.holdExpiresAt = undefined;
  appointment.arrived = false;

  const bill = await Bill.findOne({ appointmentId: String(appointment._id) });
  let refundNote = "";

  if (bill?.status === "Pending") {
    // A card payment may have gone through just now: refund it rather than lose it
    if (bill.paymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(bill.paymentIntentId);
        if (["requires_payment_method", "requires_confirmation", "requires_action"].includes(intent.status)) {
          await stripe.paymentIntents.cancel(intent.id);
        }
      } catch (err) {
        console.error("Could not cancel open PaymentIntent:", err.message);
      }
    }
    bill.status = "Cancelled";
    await bill.save();
  } else if (bill?.status === "Paid") {
    if (bill.paymentIntentId) {
      try {
        await stripe.refunds.create({ payment_intent: bill.paymentIntentId });
        bill.status = "Refunded";
        appointment.paymentStatus = "refunded";
        refundNote = ` Your payment of LKR ${bill.amount.toLocaleString()} will be refunded to your card within 5–10 days.`;
      } catch (err) {
        console.error("Stripe refund failed:", err.message);
        bill.status = "Refund Due";
        refundNote = " Your refund could not be processed automatically; the hospital will contact you.";
      }
    } else {
      bill.status = "Refund Due";
      refundNote = ` Please collect your LKR ${bill.amount.toLocaleString()} refund from the reception desk.`;
    }
    await bill.save();
    try {
      await reverseChannelingIncome(appointment, bill.amount);
    } catch (err) {
      console.error("Failed to reverse channeling income:", err.message);
    }
  }

  await appointment.save();

  if (notifyPatient) {
    await notify(
      io, appointment.patientId, "cancellation", "Booking Cancelled",
      `Your booking (token #${appointment.queueNumber || "-"}) with ${appointment.doctorName} on ${formatDay(appointment.date)} was cancelled` +
      `${reason ? `: ${reason}` : "."}${refundNote}`,
      { appointmentId: appointment._id }
    );
  }

  emitAppointmentUpdated(io, appointment);
  return { appointment, bill };
};

// Moves a booking to another session of the same doctor, keeping its payment.
export const rescheduleAppointment = async (appointment, newScheduleId, { io } = {}) => {
  const policy = await patientChangePolicy(appointment);
  if (!policy.allowed) throw new BookingError(policy.reason);

  if (String(appointment.scheduleId || "") === String(newScheduleId)) {
    throw new BookingError("Your booking is already in this session.");
  }

  const schedule = await findBookableSession({ doctorId: appointment.doctorId, scheduleId: newScheduleId });
  const newPolicy = await patientChangePolicy({ status: appointment.status, date: schedule.startTime }, schedule);
  if (!newPolicy.allowed) throw new BookingError("That session starts too soon to move your booking into it.");

  await assertNoDuplicateBooking(appointment.patientId, schedule, appointment._id);
  await assertSessionHasRoom(schedule);

  const previous = {
    scheduleId: appointment.scheduleId,
    date: appointment.date,
    queueNumber: appointment.queueNumber,
    dayKey: appointment.dayKey,
    holdExpiresAt: appointment.holdExpiresAt
  };
  const newStart = sessionStart(schedule);
  const sameDay = dayRange(newStart).$gte.getTime() === dayRange(appointment.date).$gte.getTime();

  appointment.scheduleId = schedule._id;
  appointment.date = newStart;
  appointment.arrived = false;
  if (appointment.paymentStatus !== "paid") appointment.holdExpiresAt = holdUntil(schedule);
  if (!sameDay) appointment.queueNumber = undefined;

  try {
    await saveWithToken(appointment);
    await rollbackIfOverbooked(appointment, schedule, { removeBooking: false });
  } catch (err) {
    // Put the booking back where it was
    if (err instanceof BookingError) {
      await Appointment.updateOne({ _id: appointment._id }, { $set: previous });
    }
    throw err;
  }

  await notify(
    io, appointment.patientId, "appointment", "Booking Rescheduled",
    `Your booking with ${appointment.doctorName} is now on ${formatDay(newStart)} at ${formatTime(newStart)}, token #${appointment.queueNumber}.`,
    { appointmentId: appointment._id }
  );

  emitAppointmentUpdated(io, appointment);
  return appointment;
};

// Releases unpaid bookings whose hold ran out. A card payment that succeeded at the last
// moment is recorded instead of being cancelled.
export const releaseExpiredHolds = async (io) => {
  const expired = await Appointment.find({
    status: "pending",
    paymentStatus: { $ne: "paid" },
    holdExpiresAt: { $lte: new Date() }
  }).limit(200);

  for (const appointment of expired) {
    try {
      const bill = await Bill.findOne({ appointmentId: String(appointment._id) });
      if (bill?.paymentIntentId && bill.status === "Pending") {
        const result = await verifyIntentForBill(bill);
        if (result.ok) {
          await markBillPaid(bill._id, result.intent.id, io);
          continue;
        }
        if (result.pending) continue;
      }
      await cancelAppointment(appointment, {
        byStaff: true,
        reason: "the payment was not completed in time, so the place was released",
        io
      });
    } catch (err) {
      console.error(`Failed to release unpaid booking ${appointment._id}:`, err.message);
    }
  }
};

// A booking is finished once it is completed/cancelled or its session is over: the nurse ended it,
// or it is long past its end time (in case the session was never ended in the system).
const SESSION_OVER_GRACE_MINUTES = 180;

export const isAppointmentFinished = async (appointment, doctor = null) => {
  const status = String(appointment.status || "").toLowerCase();
  if (status === "cancelled" || status === "completed") return true;

  const schedule = await sessionForAppointment(appointment);
  if (schedule?.sessionEnded) return true;
  if (schedule?.endTime && new Date(schedule.endTime).getTime() + SESSION_OVER_GRACE_MINUTES * 60000 < Date.now()) {
    return true;
  }

  // Older bookings without a session: the doctor ended today's session
  const doc = doctor || (appointment.doctorId?._id ? appointment.doctorId : null);
  const isToday = dayRange(new Date()).$gte.getTime() === dayRange(appointment.date).$gte.getTime();
  return Boolean(!schedule && isToday && doc?.sessionEndedToday);
};

// The patient's next booking that still lies ahead (skips finished ones from earlier today)
export const findNextAppointment = async (patientId, { populateDoctor = true } = {}) => {
  let query = Appointment.find({
    patientId,
    date: { $gte: dayRange(new Date()).$gte },
    status: { $nin: ["cancelled", "Cancelled", "completed", "Completed"] }
  }).sort({ date: 1, queueNumber: 1 }).limit(20);
  if (populateDoctor) query = query.populate("doctorId");

  for (const appointment of await query) {
    if (!(await isAppointmentFinished(appointment))) return appointment;
  }
  return null;
};

// Shape returned to the apps for a session list
export const describeSession = async (schedule) => ({
  ...(schedule.toObject ? schedule.toObject() : schedule),
  availability: await getSessionAvailability(schedule)
});

// Shape returned to the patient app for "My bookings"
export const describeAppointmentForPatient = async (appointment) => {
  const schedule = await sessionForAppointment(appointment);
  const bill = await Bill.findOne({ appointmentId: String(appointment._id) }).select("_id status amount").lean();
  const policy = await patientChangePolicy(appointment, schedule);
  return {
    ...(appointment.toObject ? appointment.toObject() : appointment),
    session: schedule ? {
      _id: schedule._id,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      allocatedRoom: schedule.allocatedRoom || ""
    } : null,
    bill: bill || null,
    canChange: policy.allowed,
    changeBlockedReason: policy.allowed ? null : policy.reason
  };
};

export { idOf };
