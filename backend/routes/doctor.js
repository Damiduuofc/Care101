import express from "express";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// GET DOCTOR DASHBOARD STATS
router.get("/dashboard-stats", auth, async (req, res) => {
  try {
    const doctorId = req.user.id;

    // 1. Get Doctor Details
    const doctor = await Doctor.findById(doctorId).select("name fullName specialization");
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    // Handle inconsistent naming
    const doctorName = doctor.name || doctor.fullName || "Doctor";

    // 2. Count Total Records (Appointments)
    const recordCount = await Appointment.countDocuments({ doctorId });

    // 3. Calculate Total Income
    // We sum the 'amount' field of all appointments for this doctor
    const appointments = await Appointment.find({ doctorId });
    const totalIncome = appointments.reduce((sum, appt) => sum + (appt.amount || 0), 0);

    res.json({
      name: doctorName,
      specialization: doctor.specialization || "Specialist",
      income: totalIncome,
      records: recordCount
    });

  } catch (err) {
    console.error("Doctor Dashboard Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;