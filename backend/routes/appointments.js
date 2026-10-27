import express from "express";
import { countPaidAhead, dayRange } from "../utils/queueToken.js";
import { reconcilePendingBills } from "../utils/paymentService.js";
import Appointment from "../models/Appointment.js";
import Bill from "../models/Bill.js";
import Notification from "../models/Notification.js";
import HospitalFinance from "../models/Finance.js";
import Doctor from "../models/Doctor.js";
import ScheduleRequest from "../models/ScheduleRequest.js";
import { protect as auth, protect, authorize } from "../middleware/authRole.js";
import Patient from "../models/Patient.js";
import { UNPAID_HOLD_MINUTES } from "../config/fees.js";
import {
  findBookableSession,
  getSessionAvailability,
  createBooking,
  cancelAppointment,
  rescheduleAppointment,
  describeAppointmentForPatient,
  isAppointmentFinished,
  findNextAppointment,
  sendBookingError
} from "../utils/bookingService.js";

const router = express.Router();

// ==========================================
// 1. CHECK BOOKING AVAILABILITY & DOUBLE BOOKING
// ==========================================
router.post("/check-booking", protect, async (req, res) => {
  try {
    const { doctorId, scheduleId, date } = req.body;
    if (!doctorId || (!scheduleId && !date)) {
      return res.status(400).json({ msg: "Doctor and session are required" });
    }

    const schedule = await findBookableSession({ doctorId, scheduleId, date });
    const existing = await Appointment.findOne({
      patientId: req.user.id,
      status: { $ne: "cancelled" },
      $or: [{ scheduleId: schedule._id }, { scheduleId: { $exists: false }, doctorId, date: dayRange(schedule.date) }]
    });
    if (existing && (existing.paymentStatus === "paid" || !existing.holdExpiresAt || existing.holdExpiresAt > new Date())) {
      return res.status(400).json({ msg: "You already have a booking in this session." });
    }

    const availability = await getSessionAvailability(schedule);
    if (availability.isFull) {
      return res.status(400).json({ msg: "Sorry, this session is full. Please choose another session." });
    }

    return res.status(200).json({
      msg: "Booking is available.",
      session: { _id: schedule._id, startTime: schedule.startTime, endTime: schedule.endTime },
      availability,
      holdMinutes: UNPAID_HOLD_MINUTES
    });
  } catch (err) {
    return sendBookingError(res, err, "Could not check this session. Please try again.");
  }
});

// ==========================================
// 2. BOOK APPOINTMENT (patient)
// The fee and payment status are decided by the server: a booking is always created unpaid
// and becomes paid only after Stripe confirms the payment (see /payments).
// Staff book walk-ins through /admin/appointments/walkin.
// ==========================================
router.post("/book", protect, authorize(["patient"]), async (req, res) => {
  try {
    const { doctorId, scheduleId, date, visitType, reason } = req.body;
    if (!doctorId || (!scheduleId && !date)) {
      return res.status(400).json({ msg: "Doctor and session are required" });
    }

    const schedule = await findBookableSession({ doctorId, scheduleId, date });
    const { appointment, bill, fees } = await createBooking({
      patientId: req.user.id,
      schedule,
      visitType,
      reason,
      io: req.io
    });

    res.status(201).json({ ...appointment.toObject(), billId: bill._id, fees });
  } catch (err) {
    return sendBookingError(res, err, "Booking failed. Please try again.");
  }
});

// ==========================================
// 2A. GET MY APPOINTMENTS (with session, bill and whether it can still be changed)
// ==========================================
router.get("/my-appointments", auth, async (req, res) => {
  try {
    try {
      await reconcilePendingBills(req.user.id, req.io);
    } catch (reconcileErr) {
      console.error("Payment reconciliation error:", reconcileErr.message);
    }

    const appointments = await Appointment.find({ patientId: req.user.id }).sort({ date: -1 }).limit(100);
    const described = await Promise.all(appointments.map(describeAppointmentForPatient));
    res.json(described);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).json({ msg: "Could not load your bookings." });
  }
});

// ==========================================
// 2B. RESCHEDULE TO ANOTHER SESSION OF THE SAME DOCTOR
// ==========================================
router.put("/reschedule/:id", auth, async (req, res) => {
  try {
    const { scheduleId } = req.body || {};
    if (!scheduleId) return res.status(400).json({ msg: "Choose a session to move to." });

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ msg: "Booking not found" });
    if (String(appointment.patientId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const updated = await rescheduleAppointment(appointment, scheduleId, { io: req.io });
    res.json(await describeAppointmentForPatient(updated));
  } catch (err) {
    return sendBookingError(res, err, "Could not reschedule. Please try again.");
  }
});

// ==========================================
// 3. GET UPCOMING APPOINTMENT
// ==========================================
router.get("/upcoming", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Pick up payments that went through in Stripe but weren't recorded
    try {
      await reconcilePendingBills(req.user.id, req.io);
    } catch (reconcileErr) {
      console.error("Payment reconciliation error:", reconcileErr.message);
    }

    // Next booking that is still ahead: completed ones and ended sessions are skipped
    const upcoming = await findNextAppointment(req.user.id);

    if (!upcoming) {
      return res.status(200).json({ appointment: null });
    }

    const doc = upcoming.doctorId && typeof upcoming.doctorId === "object" ? upcoming.doctorId : null;
    // Unpaid patients keep their token but are not in the live queue until they pay
    const awaitingPayment = upcoming.paymentStatus !== "paid";
    const myToken = upcoming.queueNumber || null;
    const currentToken = doc && typeof doc.currentQueueNumber === "number" ? doc.currentQueueNumber : 0;
    const peopleAhead = awaitingPayment ? null : await countPaidAhead(upcoming, currentToken);
    const allocatedRoom = (doc && doc.allocatedRoom) ? doc.allocatedRoom : "Room TBA";
    const sessionStarted = !!(doc && doc.sessionStarted);
    const isArrived = !!(doc && doc.isArrived);
    const channelingStatus = (doc && doc.channelingStatus) ? doc.channelingStatus : "On Time";

    const appointmentObj = {
      ...upcoming.toObject(),
      doctorId: doc && doc._id ? doc._id : upcoming.doctorId,
      doctorDetails: doc,
      queueNumber: myToken,
      awaitingPayment,
      currentToken,
      ongoingToken: currentToken,
      currentServingNumber: currentToken,
      peopleAhead,
      allocatedRoom,
      sessionStarted,
      isArrived,
      channelingStatus
    };

    res.json({ appointment: appointmentObj });
  } catch (err) {
    console.error("Upcoming Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3B. GET HOME SCREEN WIDGET STATUS
// ==========================================
router.get("/widget-status", auth, async (req, res) => {
  try {
    const formatDoctorName = (raw) => {
      const trimmed = String(raw || "").trim();
      if (!trimmed || trimmed.toLowerCase() === "null") return "Doctor";
      const withoutPrefix = trimmed.replace(/^dr\.?\s*/i, "").trim();
      if (!withoutPrefix || withoutPrefix.toLowerCase() === "doctor") return "Doctor";
      return `Dr. ${withoutPrefix}`;
    };

    const patientId = req.user.id || req.query.patientId;
    if (!patientId) {
      return res.json({ state: "empty", message: "Patient not identified" });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const upcomingStatuses = ["confirmed", "Confirmed", "pending", "Pending", "scheduled", "Scheduled"];

    // 1. Look for today's active/upcoming appointment. A patient can have several today
    // (e.g. one completed, one later); prefer one that isn't completed so the widget
    // doesn't flip between "completed" and "queue" depending on Mongo's natural order.
    const todayAppts = await Appointment.find({
      patientId,
      date: { $gte: startOfToday, $lte: endOfToday },
      status: { $nin: ["cancelled", "Cancelled"] }
    }).sort({ date: 1, queueNumber: 1 }).populate("doctorId");
    // Prefer a booking that is still ahead; if all of today's are finished, show the
    // "completed" state with the patient's next booking.
    let activeToday = null;
    for (const appt of todayAppts) {
      if (!(await isAppointmentFinished(appt))) { activeToday = appt; break; }
    }
    const todayAppt = activeToday || todayAppts[0] || null;

    if (todayAppt) {
      const doc = todayAppt.doctorId;
      const doctorId = doc && doc._id ? doc._id.toString() : null;
      let room = (doc && doc.allocatedRoom) ? doc.allocatedRoom : "";
      let scheduledTime = (doc && doc.channelingTime) ? doc.channelingTime : "";
      
      // If room or time not set on doctor model, check approved schedule
      if ((!room || !scheduledTime) && doc && doc._id) {
        try {
          const schedule = await ScheduleRequest.findOne({
            doctorId: doc._id,
            status: "approved",
            date: { $gte: startOfToday, $lte: endOfToday }
          });
          if (schedule) {
            if (!room && schedule.allocatedRoom) {
              room = schedule.allocatedRoom;
            }
            if (!scheduledTime && schedule.startTime) {
              scheduledTime = new Date(schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
          }
        } catch (scheduleErr) {
          console.error("Schedule room lookup error:", scheduleErr);
        }
      }
      if (!room) room = "Room TBA";
      if (!scheduledTime) scheduledTime = "Scheduled Today";

      const hospitalName = (doc && doc.hospital) ? doc.hospital : "SUWASEWANA HOSPITAL";
      const rawDoctorName = (doc && (doc.fullName || doc.name)) ? (doc.fullName || doc.name) : todayAppt.doctorName;
      const doctorName = formatDoctorName(rawDoctorName);
      const awaitingPayment = todayAppt.paymentStatus !== "paid";
      const myToken = todayAppt.queueNumber || "--";
      const ongoingToken = (doc && doc.currentQueueNumber) ? doc.currentQueueNumber : 0;
      const isArrived = !!(doc && doc.isArrived);
      const isSessionStarted = !!(doc && doc.sessionStarted);
      const isSessionEnded = !activeToday;
      const channelingStatus = (doc && doc.channelingStatus) ? doc.channelingStatus : "On Time";
      const isDelayed = channelingStatus.toLowerCase() !== "on time" && !isArrived;
      const delayMessage = isArrived
        ? `Doctor Arrived • Ready in ${room}`
        : isDelayed
          ? `Doctor Delayed: ${channelingStatus}`
          : "Doctor On Time";

      // Case 1: Session has ended / completed
      if (isSessionEnded) {
        const nextAppt = await Appointment.findOne({
          patientId,
          date: { $gt: endOfToday },
          status: { $in: upcomingStatuses }
        }).sort({ date: 1 }).populate("doctorId");

        if (nextAppt) {
          const nextDoc = nextAppt.doctorId;
          let nextRoom = (nextDoc && nextDoc.allocatedRoom) ? nextDoc.allocatedRoom : "Room TBA";
          const rawNextDocName = (nextDoc && (nextDoc.fullName || nextDoc.name)) ? (nextDoc.fullName || nextDoc.name) : nextAppt.doctorName;
          return res.json({
            state: "completed",
            hasUpcoming: true,
            completedDoctor: doctorName,
            nextDoctorName: formatDoctorName(rawNextDocName),
            nextHospitalName: (nextDoc && nextDoc.hospital) ? nextDoc.hospital : "SUWASEWANA HOSPITAL",
            nextRoom,
            nextToken: nextAppt.queueNumber || "--",
            nextAwaitingPayment: nextAppt.paymentStatus !== "paid",
            nextDate: new Date(nextAppt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })
          });
        } else {
          // No further upcoming appointments -> show app logo with white background
          return res.json({
            state: "empty",
            message: "No upcoming appointments"
          });
        }
      }

      // Case 2: Session has started -> Real-time live queue (unpaid patients are not in the queue)
      const peopleAhead = awaitingPayment ? 0 : await countPaidAhead(todayAppt, ongoingToken);
      if (isSessionStarted && !awaitingPayment) {
        return res.json({
          state: "queue",
          doctorId,
          hospitalName,
          doctorName,
          room,
          myToken,
          ongoingToken,
          currentToken: ongoingToken,
          peopleAhead,
          sessionStarted: true,
          isArrived: true,
          isDelayed: channelingStatus.toLowerCase() !== "on time",
          delayMessage: channelingStatus.toLowerCase() !== "on time" ? `Delayed: ${channelingStatus}` : "Session in progress",
          channelingStatus,
          lastUpdated: new Date()
        });
      }

      // Case 3: Before session starts -> Upcoming appointment with doctor arrival / delay status + queue counts
      return res.json({
        state: "upcoming",
        doctorId,
        hospitalName,
        doctorName,
        room,
        myToken,
        ongoingToken,
        currentToken: ongoingToken,
        peopleAhead,
        awaitingPayment,
        sessionStarted: false,
        formattedDate: "Today",
        channelingTime: scheduledTime,
        isArrived,
        isDelayed,
        delayMessage,
        channelingStatus,
        lastUpdated: new Date()
      });
    }

    // 2. No appointment today -> check for future upcoming appointments
    const futureAppt = await Appointment.findOne({
      patientId,
      date: { $gt: endOfToday },
      status: { $in: upcomingStatuses }
    }).sort({ date: 1 }).populate("doctorId");

    if (futureAppt) {
      const doc = futureAppt.doctorId;
      const doctorId = doc && doc._id ? doc._id.toString() : null;
      const hospitalName = (doc && doc.hospital) ? doc.hospital : "SUWASEWANA HOSPITAL";
      const rawFutureDocName = (doc && (doc.fullName || doc.name)) ? (doc.fullName || doc.name) : futureAppt.doctorName;
      const doctorName = formatDoctorName(rawFutureDocName);
      const room = (doc && doc.allocatedRoom) ? doc.allocatedRoom : "Room TBA";
      const isArrived = false;
      const channelingStatus = (doc && doc.channelingStatus) ? doc.channelingStatus : "On Time";
      const isDelayed = channelingStatus.toLowerCase() !== "on time";

      return res.json({
        state: "upcoming",
        doctorId,
        hospitalName,
        doctorName,
        room,
        myToken: futureAppt.queueNumber || "--",
        awaitingPayment: futureAppt.paymentStatus !== "paid",
        formattedDate: new Date(futureAppt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }),
        channelingTime: (doc && doc.channelingTime) ? doc.channelingTime : "Scheduled",
        isArrived,
        isDelayed,
        delayMessage: isDelayed ? `Doctor Delayed: ${channelingStatus}` : "Doctor On Time",
        channelingStatus,
        lastUpdated: new Date()
      });
    }

    // 3. No upcoming appointments -> Empty state
    return res.json({
      state: "empty",
      message: "No upcoming appointments"
    });

  } catch (err) {
    console.error("Widget Status Error:", err);
    res.status(500).json({ error: "Failed to fetch widget status" });
  }
});

// ==========================================
// 4. GET QUEUE STATUS
// ==========================================
router.get("/queue-status/:id", auth, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const myAppointment = await Appointment.findById(appointmentId);

    if (!myAppointment) {
      return res.status(404).json({ msg: "Appointment not found" });
    }

    const awaitingPayment = myAppointment.paymentStatus !== "paid";
    const myToken = myAppointment.queueNumber || null;

    const doctor = await Doctor.findById(myAppointment.doctorId);
    const currentToken = doctor ? doctor.currentQueueNumber || 0 : 0;

    const peopleAhead = awaitingPayment ? null : await countPaidAhead(myAppointment, currentToken);
    const estimatedWait = awaitingPayment ? null : peopleAhead * 15;

    res.json({
      queueNumber: myToken,
      awaitingPayment,
      currentToken,
      peopleAhead,
      estimatedWait
    });

  } catch (err) {
    console.error("Queue Status Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 5. CANCEL APPOINTMENT
// ==========================================
router.put("/cancel/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ msg: "Booking not found" });

    if (String(appointment.patientId) !== String(req.user.id)) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const { bill } = await cancelAppointment(appointment, { io: req.io });
    res.json({
      msg: "Cancelled successfully",
      billStatus: bill?.status || null,
      appointment: await describeAppointmentForPatient(appointment)
    });
  } catch (err) {
    return sendBookingError(res, err, "Could not cancel. Please try again.");
  }
});

export default router;
