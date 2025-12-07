import express from "express";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js"; // ✅ NEW: Import Notification Model
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. BOOK APPOINTMENT
router.post("/book", auth, async (req, res) => {
  try {
    const { doctorId, doctorName, department, date, visitType, reason, amount } = req.body;

    if (!doctorId || !doctorName || !department || !date) {
      return res.status(400).json({ msg: "Please fill all required fields" });
    }

    const newAppointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      doctorName,
      department,
      date,
      visitType,
      reason,
      status: 'Pending',
      amount: amount || 0,
      paymentStatus: 'Paid'
    });

    await newAppointment.save();

    // ✅ NEW: Create Notification for Booking
    await Notification.create({
      userId: req.user.id,
      type: 'appointment',
      message: `Appointment requested with ${doctorName} on ${new Date(date).toLocaleDateString()}. Status: Pending.`
    });

    res.json(newAppointment);

  } catch (err) {
    console.error("Booking Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// 2. GET MY APPOINTMENTS
router.get("/my-appointments", auth, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id }).sort({ date: 1 });
    res.json(appointments);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. CANCEL APPOINTMENT
router.put("/cancel/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ msg: "Appointment not found" });
    }

    if (appointment.patientId.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    appointment.status = "Cancelled";
    await appointment.save();

    // ✅ NEW: Create Notification for Cancellation
    await Notification.create({
      userId: req.user.id,
      type: 'appointment',
      message: `Appointment with ${appointment.doctorName} has been cancelled.`
    });

    res.json({ msg: "Appointment Cancelled" });

  } catch (err) {
    console.error("Cancel Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;