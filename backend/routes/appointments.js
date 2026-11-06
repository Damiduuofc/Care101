import express from "express";
import { countPaidAhead, dayRange } from "../utils/queueToken.js";
import { reconcilePendingBills } from "../utils/paymentService.js";
import Appointment from "../models/Appointment.js";
import Bill from "../models/Bill.js";
import Notification from "../models/Notification.js";
import HospitalFinance from "../models/Finance.js";
import Doctor from "../models/Doctor.js";
import { isArrivedToday, isSessionLive } from "../utils/doctorSession.js";
import ScheduleRequest from "../models/ScheduleRequest.js";
import { protect as auth, protect, authorize } from "../middleware/authRole.js";
import Patient from "../models/Patient.js";
import { UNPAID_HOLD_MINUTES } from "../config/fees.js";
import { buildWidgetStatus } from "../utils/widgetStatus.js";
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
    const sessionStarted = isSessionLive(doc);
    const isArrived = isArrivedToday(doc);
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
    const patientId = req.user.id || req.query.patientId;
    res.json(await buildWidgetStatus(patientId));
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
