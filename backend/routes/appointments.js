import express from "express";
import Appointment from "../models/Appointment.js";
import Bill from "../models/Bill.js"; 
import Notification from "../models/Notification.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. BOOK APPOINTMENT & CREATE BILL
// ==========================================
router.post("/book", auth, async (req, res) => {
  try {
    const { doctorId, doctorName, department, date, visitType, reason, amount } = req.body;

    if (!doctorId || !date) {
      return res.status(400).json({ msg: "Doctor and Date are required" });
    }

    // 1. Create Appointment (LOWERCASE 'pending' for Appointment Schema)
    const newAppointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      doctorName,
      department,
      date,
      visitType,
      reason,
      amount: amount || 2000,
      status: 'pending',        // ✅ Lowercase for Appointment
      paymentStatus: 'pending'  // ✅ Lowercase for Appointment
    });

    const savedAppointment = await newAppointment.save();

    // 2. Automatically Create Bill (CAPITALIZED 'Pending' for Bill Schema)
    try {
      const newBill = new Bill({
        patientId: req.user.id,
        appointmentId: savedAppointment._id,
        title: `Consultation - ${doctorName}`,
        type: "Appointment",
        amount: amount || 2000,
        status: "Pending",     // ✅ Capitalized for Bill
        date: new Date()
      });
      await newBill.save();
    } catch (billError) {
      console.error("Bill Creation Failed:", billError);
    }

    // 3. Notify User
    try {
      await Notification.create({
        userId: req.user.id,
        type: 'appointment',
        message: `Booking request sent for Dr. ${doctorName}.`
      });
    } catch (notifError) {
      // Ignore notification errors
    }

    res.json(savedAppointment);

  } catch (err) {
    console.error("Booking Error:", err.message);
    res.status(500).send(`Booking Failed: ${err.message}`);
  }
});

// ==========================================
// 2. GET MY APPOINTMENTS
// ==========================================
router.get("/my-appointments", auth, async (req, res) => {
  try {
    const appointments = await Appointment.find({ patientId: req.user.id }).sort({ date: -1 });
    res.json(appointments);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. CANCEL APPOINTMENT
// ==========================================
router.put("/cancel/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ msg: "Not Found" });

    if (appointment.patientId.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not Authorized" });
    }

    // Update status to 'cancelled' (lowercase)
    appointment.status = "cancelled"; 
    await appointment.save();

    res.json({ msg: "Cancelled Successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;