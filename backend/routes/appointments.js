import express from "express";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. BOOK APPOINTMENT
router.post("/book", auth, async (req, res) => {
  try {
    const { doctorId, doctorName, department, date, visitType, reason, amount } = req.body;

    if (!doctorId || !date) {
      return res.status(400).json({ msg: "Doctor and Date are required" });
    }

    const newAppointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      doctorName,
      department,
      date,
      visitType,
      reason,
      amount: amount || 2000,
      status: 'Pending', // Default status
      paymentStatus: 'Pending'
    });

    await newAppointment.save();

    // Notify the user
    await Notification.create({
      userId: req.user.id,
      type: 'appointment',
      message: `Booking request sent for Dr. ${doctorName} on ${new Date(date).toLocaleDateString()}.`
    });

    res.json(newAppointment);

  } catch (err) {
    console.error("Booking Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. GET MY APPOINTMENTS (Fixes "Previous details not showing")
router.get("/my-appointments", auth, async (req, res) => {
  try {
    // Find appointments where patientId matches the logged-in user
    const appointments = await Appointment.find({ patientId: req.user.id }).sort({ date: -1 }); // Sort newest first
    res.json(appointments);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 3. CANCEL APPOINTMENT
router.put("/cancel/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ msg: "Not Found" });

    // Verify ownership
    if (appointment.patientId.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not Authorized" });
    }

    appointment.status = "Cancelled";
    await appointment.save();

    res.json({ msg: "Cancelled Successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;