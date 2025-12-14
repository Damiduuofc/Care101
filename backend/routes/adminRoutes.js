import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import HospitalStatus from "../models/HospitalStatus.js";
import Bill from "../models/Bill.js"; // ✅ Import Bill Model
import { protect, authorize } from "../middleware/authRole.js";

const router = express.Router();

// ... (Keep your Login, Status, Stats, Staff routes exactly as they are) ...
// ... Skip down to the APPOINTMENT MANAGEMENT section ...

// ==========================================
// 5. APPOINTMENT MANAGEMENT (Master Control)
// ==========================================

// GET ALL APPOINTMENTS
router.get("/appointments", protect, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("patientId", "fullName phone") 
      .populate("doctorId", "name department") 
      .sort({ date: -1 });

    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ✅ UPDATE APPOINTMENT (With Validation & Bill Sync)
router.put("/appointments/:id", protect, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    let appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ msg: "Not found" });

    // 🔒 RULE 1: Cannot edit if Patient already Cancelled
    if (appointment.status.toLowerCase() === "cancelled") {
      return res.status(400).json({ msg: "Cannot edit a Cancelled appointment" });
    }

    // Update Status (Confirmed/Completed)
    if (status) {
      appointment.status = status;
    }

    // Update Payment Status
    if (paymentStatus) {
      appointment.paymentStatus = paymentStatus;

      // 🔄 SYNC: If Admin marks "Paid", update the linked Bill too
      if (paymentStatus.toLowerCase() === "paid") {
        await Bill.findOneAndUpdate(
          { appointmentId: appointment._id },
          { status: "Paid" }
        );
      }
    }

    await appointment.save();
    res.json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// DELETE APPOINTMENT
router.delete("/appointments/:id", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    // Optional: Delete linked bill too
    await Bill.findOneAndDelete({ appointmentId: req.params.id });
    res.json({ msg: "Appointment removed" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

export default router;