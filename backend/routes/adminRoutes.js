import mongoose from "mongoose";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js";
import HospitalStatus from "../models/HospitalStatus.js";
import Bill from "../models/Bill.js";
import HospitalFinance from "../models/Finance.js";
import Notification from "../models/Notification.js";
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

    // Ensure JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");
      return res.status(500).send("Server Configuration Error");
    }

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
// 2. DASHBOARD STATS
// ==========================================
router.get("/stats", protect, async (req, res) => {
  try {
    const totalDoctors = await Doctor.countDocuments();
    const pendingDoctors = await Doctor.countDocuments({ isApproved: false });
    const totalPatients = await Patient.countDocuments();

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointmentsToday = await Appointment.countDocuments({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    const pendingAppointments = await Appointment.countDocuments({
      status: { $regex: /^pending$/i }
    });

    const appointmentRevenue = await Appointment.aggregate([
      { $match: { paymentStatus: { $regex: /^paid$/i } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const billRevenue = await Bill.aggregate([
      { $match: { status: { $regex: /^paid$/i } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const appTotal = appointmentRevenue.length > 0 ? appointmentRevenue[0].total : 0;
    const billTotal = billRevenue.length > 0 ? billRevenue[0].total : 0;
    const totalRevenue = appTotal + billTotal;

    let status = await HospitalStatus.findOne();
    if (!status) {
      status = { generalWard: "Available", icuBeds: 0, emergencyUnit: "Normal", pharmacy: "Open" };
    }

    res.json({
      doctors: { total: totalDoctors, pending: pendingDoctors },
      patients: { total: totalPatients, today: appointmentsToday },
      appointments: { pending: pendingAppointments },
      revenue: totalRevenue,
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
    res.status(500).send("Server Error");
  }
});

router.put("/appointments/:id", protect, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    let appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ msg: "Not found" });

    if (appointment.status && appointment.status.toLowerCase() === "cancelled") {
      return res.status(400).json({ msg: "Cannot edit a Cancelled appointment" });
    }

    if (status) appointment.status = status;

    if (paymentStatus) {
      const isBecomingPaid = paymentStatus.toLowerCase() === "paid" && appointment.paymentStatus !== "paid";
      appointment.paymentStatus = paymentStatus;

      if (isBecomingPaid) {
        await Bill.findOneAndUpdate({ appointmentId: appointment._id }, { status: "Paid" });

        try {
          const hospitalName = "Suwasevana";
          let hospitalFinance = await HospitalFinance.findOne({ doctorId: appointment.doctorId, name: hospitalName });

          if (!hospitalFinance) {
            hospitalFinance = new HospitalFinance({ doctorId: appointment.doctorId, name: hospitalName, records: [] });
          }

          hospitalFinance.records.unshift({
            type: 'channeling',
            date: new Date(),
            patients: 1,
            income: appointment.amount || 2000
          });

          await hospitalFinance.save();
        } catch (finErr) {
          console.error("Finance Update Error:", finErr);
        }
      }
    }

    await appointment.save();
    res.json(appointment);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.delete("/appointments/:id", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    await Bill.findOneAndDelete({ appointmentId: req.params.id });
    res.json({ msg: "Appointment removed" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 5. BILLING MANAGEMENT
// ==========================================
router.get("/patients/search/nic/:nic", protect, async (req, res) => {
  try {
    const patient = await Patient.findOne({ nicNumber: req.params.nic }).select("-password");
    if (!patient) return res.status(404).json({ msg: "Patient not found" });
    res.json(patient);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.get("/bills/all", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const manualBills = await Bill.find().populate("patientId", "fullName nicNumber").lean();
    const appointments = await Appointment.find({ amount: { $gt: 0 } }).populate("patientId", "fullName nicNumber").lean();

    const appointmentBills = appointments.map(app => ({
      _id: app._id,
      patientId: app.patientId,
      title: `Appointment Fee - ${app.status}`,
      type: "Appointment",
      amount: app.amount,
      status: app.paymentStatus || "Pending",
      date: app.date
    }));

    const combinedHistory = [...manualBills, ...appointmentBills].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(combinedHistory);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.post("/bills/create", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const { patientId, title, type, amount, status } = req.body;

    const newBill = new Bill({
      patientId: new mongoose.Types.ObjectId(patientId),
      title,
      type,
      amount,
      status: status || "Pending",
      date: new Date()
    });

    await newBill.save();

    if (status === "Paid") {
      try {
        const hospitalName = "Suwasevana";
        let hospitalFinance = await HospitalFinance.findOne({ name: hospitalName });
        if (!hospitalFinance) {
          hospitalFinance = new HospitalFinance({ name: hospitalName, records: [], doctorId: null });
        }
        hospitalFinance.records.unshift({
          type: type.toLowerCase() === 'appointment' ? 'channeling' : 'surgical',
          date: new Date(),
          patients: 1,
          income: amount
        });
        await hospitalFinance.save();
      } catch (finErr) { console.error(finErr); }
    }

    await Notification.create({
      userId: newBill.patientId,
      type: "payment",
      message: status === "Paid" 
        ? `Receipt Confirmed! LKR ${amount} paid for ${title}.` 
        : `New Bill Issued: LKR ${amount} due for ${title}.`
    });

    const populatedBill = await Bill.findById(newBill._id).populate("patientId", "fullName nicNumber");
    res.json({ msg: "Bill created successfully", bill: populatedBill });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 6. STAFF MANAGEMENT
// ==========================================
router.post("/create-staff", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
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

router.get("/staff", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const staff = await Admin.find().select("-password");
    res.json(staff);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.delete("/staff/:id", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ msg: "Cannot delete self" });
    await Admin.findByIdAndDelete(req.params.id);
    res.json({ msg: "Staff removed" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 7. DOCTOR MANAGEMENT
// ==========================================
router.get("/all-doctors", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const doctors = await Doctor.find().select("-password").sort({ createdAt: -1 });
    res.json(doctors);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.put("/all-doctors/:id/approve", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const { isApproved } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, { isApproved }, { new: true }).select("-password");
    res.json({ msg: isApproved ? "Doctor approved" : "Doctor rejected", doctor });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.get("/doctors", protect, authorize(["system_admin", "receptionist", "nurse"]), async (req, res) => {
  try {
    const doctors = await Doctor.find().select("name specialization isArrived allocatedRoom allocatedNurse channelingTime channelingStatus phone profileImage sessionStarted currentQueueNumber");
    res.json(doctors);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// Updated Doctor Status Route with Notification Trigger
router.put("/doctors/:id/status", protect, authorize(["system_admin", "receptionist", "nurse"]), async (req, res) => {
  try {
    const { isArrived, allocatedRoom, allocatedNurse, channelingTime, channelingStatus, sessionStarted, currentQueueNumber } = req.body;
    let doctor = await Doctor.findById(req.params.id);

    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    // Handle Doctor Arrival and Patient Notifications
    if (isArrived === true && !doctor.isArrived) {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const activeAppointments = await Appointment.find({
          doctorId: doctor._id,
          date: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["confirmed", "Confirmed", "pending", "Pending", "completed", "Completed"] }
        });

        if (activeAppointments.length > 0) {
          const notificationPromises = activeAppointments.map(app => {
            const timeInfo = channelingTime || doctor.channelingTime 
              ? `Sessions start around ${channelingTime || doctor.channelingTime}.` 
              : "Sessions will begin shortly.";

            return Notification.create({
              userId: app.patientId,
              type: 'arrival',
              title: "Doctor Arrived",
              message: `Dr. ${doctor.name} has arrived. ${timeInfo} Please proceed to Room ${allocatedRoom || doctor.allocatedRoom || 'TBA'}.`,
              metadata: { doctorId: doctor._id, appointmentId: app._id }
            });
          });
          await Promise.all(notificationPromises);
        }
      } catch (err) { console.error("Notification trigger error:", err); }
    }
    
    // Update Doctor Fields
    if (isArrived !== undefined) doctor.isArrived = isArrived;
    if (allocatedRoom !== undefined) doctor.allocatedRoom = allocatedRoom;
    if (allocatedNurse !== undefined) doctor.allocatedNurse = allocatedNurse;
    if (channelingTime !== undefined) doctor.channelingTime = channelingTime;
    if (channelingStatus !== undefined) doctor.channelingStatus = channelingStatus;
    if (sessionStarted !== undefined) doctor.sessionStarted = sessionStarted;
    if (currentQueueNumber !== undefined) doctor.currentQueueNumber = currentQueueNumber;

    await doctor.save();
    res.json(doctor);
  } catch (err) {
    console.error("Update Doctor Status Error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;
