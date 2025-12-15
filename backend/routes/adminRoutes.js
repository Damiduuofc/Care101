import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import HospitalStatus from "../models/HospitalStatus.js";
import Bill from "../models/Bill.js"; 
import { protect, authorize } from "../middleware/authRole.js";

const router = express.Router();

// ==========================================
// 1. ADMIN LOGIN
// ==========================================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ msg: "Invalid Credentials" });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid Credentials" });

    const payload = { id: admin.id, role: admin.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department
      }
    });
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. DASHBOARD STATS (Merged: Counts + Status)
// ==========================================
router.get("/stats", protect, async (req, res) => {
  try {
    // A. CALCULATE DASHBOARD COUNTS
    const totalDoctors = await Doctor.countDocuments();
    const pendingDoctors = await Doctor.countDocuments({ isApproved: false });
    const totalPatients = await Patient.countDocuments();
    
    // Appointments Today
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
    const appointmentsToday = await Appointment.countDocuments({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    // Pending Appointments (Case Insensitive)
    const pendingAppointments = await Appointment.countDocuments({ 
      status: { $regex: /^pending$/i } 
    });

    // Revenue
    const revenueResult = await Appointment.aggregate([
      { $match: { paymentStatus: { $regex: /^paid$/i } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // B. FETCH HOSPITAL STATUS
    let status = await HospitalStatus.findOne();
    if (!status) {
      status = { generalWard: "Available", icuBeds: 0, emergencyUnit: "Normal", pharmacy: "Open" };
    }

    // C. SEND COMBINED RESPONSE
    res.json({
      doctors: { total: totalDoctors, pending: pendingDoctors },
      patients: { total: totalPatients, today: appointmentsToday },
      appointments: { pending: pendingAppointments },
      revenue: totalRevenue,
      // Map DB fields to Frontend expected fields
      status: {
        generalWard: status.generalWard,
        icuBeds: status.icuBeds,
        emergency: status.emergencyUnit, 
        pharmacy: status.pharmacy
      }
    });

  } catch (err) {
    console.error("Stats Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. UPDATE HOSPITAL STATUS
// ==========================================
router.put("/status", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const { generalWard, icuBeds, emergencyUnit, pharmacy } = req.body;
    let status = await HospitalStatus.findOne();

    if (status) {
      status.generalWard = generalWard;
      status.icuBeds = icuBeds;
      status.emergencyUnit = emergencyUnit;
      status.pharmacy = pharmacy;
      status.updatedAt = Date.now();
      await status.save();
    } else {
      status = new HospitalStatus({ generalWard, icuBeds, emergencyUnit, pharmacy });
      await status.save();
    }
    res.json({ msg: "Status Updated", status });

  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4. APPOINTMENT MANAGEMENT
// ==========================================
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

router.put("/appointments/:id", protect, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    let appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ msg: "Not found" });

    // Prevent editing cancelled appointments
    if (appointment.status.toLowerCase() === "cancelled") {
      return res.status(400).json({ msg: "Cannot edit a Cancelled appointment" });
    }

    if (status) appointment.status = status;
    if (paymentStatus) {
      appointment.paymentStatus = paymentStatus;
      // Sync with Bill if marked Paid
      if (paymentStatus.toLowerCase() === "paid") {
        await Bill.findOneAndUpdate({ appointmentId: appointment._id }, { status: "Paid" });
      }
    }

    await appointment.save();
    res.json(appointment);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

router.delete("/appointments/:id", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    await Bill.findOneAndDelete({ appointmentId: req.params.id });
    res.json({ msg: "Appointment removed" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 5. STAFF MANAGEMENT
// ==========================================
router.post("/create-staff", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    // ... (Your staff creation logic remains here) ...
    // Note: I'm keeping this brief for readability, but paste your existing logic here if needed
    if (!["receptionist", "nurse", "system_admin"].includes(role)) return res.status(400).json({ msg: "Invalid Role" });
    let user = await Admin.findOne({ email });
    if (user) return res.status(400).json({ msg: "User exists" });
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    user = new Admin({ name, email, password: hashedPassword, role, department });
    await user.save();
    res.json({ msg: `New ${role} created` });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.get("/staff", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const staff = await Admin.find().select("-password");
    res.json(staff);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 6. DELETE STAFF (System Admin Only)
// ==========================================
router.delete("/staff/:id", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ msg: "You cannot delete your own account." });
    }

    await Admin.findByIdAndDelete(req.params.id);
    res.json({ msg: "Staff member removed" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});


export default router;