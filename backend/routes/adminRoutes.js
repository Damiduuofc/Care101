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

    const payload = { id: admin.id, role: admin.role };

    // Ensure JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is missing in .env");
      return res.status(500).send("Server Configuration Error");
    }

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
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointmentsToday = await Appointment.countDocuments({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    // Pending Appointments (Case Insensitive)
    const pendingAppointments = await Appointment.countDocuments({
      status: { $regex: /^pending$/i }
    });

    // Revenue Calculation
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
    console.error("Fetch Appointments Error:", err);
    res.status(500).send("Server Error");
  }
});

router.put("/appointments/:id", protect, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    let appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ msg: "Not found" });

    // Prevent editing cancelled appointments
    if (appointment.status && appointment.status.toLowerCase() === "cancelled") {
      return res.status(400).json({ msg: "Cannot edit a Cancelled appointment" });
    }

    if (status) appointment.status = status;



    if (paymentStatus) {
      // Check if status is changing TO paid FROM something else
      const isBecomingPaid = paymentStatus.toLowerCase() === "paid" && appointment.paymentStatus !== "paid";

      appointment.paymentStatus = paymentStatus;

      // Sync with Bill & Finance if marked Paid
      if (isBecomingPaid) {
        // 1. Update Bill
        await Bill.findOneAndUpdate(
          { appointmentId: appointment._id },
          { status: "Paid" }
        );

        // 2. ✅ Update Finance Record
        try {
          const hospitalName = "Suwasevana"; // Default
          let hospitalFinance = await HospitalFinance.findOne({
            doctorId: appointment.doctorId,
            name: hospitalName
          });

          if (!hospitalFinance) {
            hospitalFinance = new HospitalFinance({
              doctorId: appointment.doctorId,
              name: hospitalName,
              records: []
            });
          }

          hospitalFinance.records.unshift({
            type: 'channeling',
            date: new Date(appointment.date),
            patients: 1,
            income: appointment.amount || 2000
          });

          await hospitalFinance.save();
          console.log(`✅ Finance Updated: ${appointment.amount} LKR added via Admin Panel`);

        } catch (finErr) {
          console.error("Failed to update finance from admin:", finErr);
        }
      }
    }

    await appointment.save();
    res.json(appointment);
  } catch (err) {
    console.error("Update Appointment Error:", err);
    res.status(500).send("Server Error");
  }
});

router.delete("/appointments/:id", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    await Bill.findOneAndDelete({ appointmentId: req.params.id });
    res.json({ msg: "Appointment removed" });
  } catch (err) {
    console.error("Delete Appointment Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 5. BILLING MANAGEMENT
// ==========================================
// Search Patient by NIC Number
router.get("/patients/search/nic/:nic", protect, async (req, res) => {
  try {
    const patient = await Patient.findOne({ nicNumber: req.params.nic }).select("-password");
    if (!patient) return res.status(404).json({ msg: "Patient not found" });
    res.json(patient);
  } catch (err) {
    console.error("NIC Search Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// Fetch All Billing History (for Admin View)
router.get("/bills/all", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("patientId", "fullName nicNumber")
      .sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    console.error("Fetch All Bills Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// Create a New Bill (Cash or App Payment)
router.post("/bills/create", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const { patientId, title, type, amount, status } = req.body;

    if (!patientId || !amount) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    const newBill = new Bill({
      patientId: new mongoose.Types.ObjectId(patientId), // Explicitly convert to ObjectId
      title,
      type,
      amount,
      status: status || "Pending",
      date: new Date()
    });

    await newBill.save();

    // 2. Update Finance Records (if Cash)
    if (status === "Paid") {
      try {
        const hospitalName = "Suwasevana";
        let hospitalFinance = await HospitalFinance.findOne({ name: hospitalName });

        if (!hospitalFinance) {
          hospitalFinance = new HospitalFinance({ name: hospitalName, records: [], doctorId: null });
        }

        hospitalFinance.records.unshift({
          type: type.toLowerCase() === 'appointment' ? 'channeling' : 'surgical', // Map to valid enums
          date: new Date(),
          patients: 1,
          income: amount,
          amount: amount // Set for surgical record structure if needed
        });

        await hospitalFinance.save();
        console.log("✅ Finance record updated");
      } catch (finErr) {
        console.error("❌ Finance Sync Error:", finErr.message);
        // We don't crash the bill creation if finance update fails
      }
    }

    // 3. Send Notification to Patient
    try {
      await Notification.create({
        userId: newBill.patientId, // Use the converted ObjectId from the saved bill
        type: "payment",
        message: status === "Paid" 
          ? `Receipt Confirmed! LKR ${amount} paid for ${title}.` 
          : `New Bill Issued: You have a payment of LKR ${amount} due for ${title}. Pay via app.`
      });
    } catch (notifErr) {
      console.error("❌ Notification Error:", notifErr.message);
    }

    // 4. Return Populated Bill
    const populatedBill = await Bill.findById(newBill._id).populate("patientId", "fullName nicNumber");
    res.json({ msg: "Bill created successfully", bill: populatedBill });

  } catch (err) {
    console.error("Create Bill Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 6. STAFF MANAGEMENT
// ==========================================
router.post("/create-staff", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;

    // 1. Check for valid role
    const validRoles = ["receptionist", "nurse", "system_admin", "lab_assistant"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ msg: "Invalid Role. Must be one of: " + validRoles.join(", ") });
    }

    // 2. Check if user already exists
    let user = await Admin.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User with this email already exists" });
    }

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Save to DB
    user = new Admin({
      name,
      email,
      password: hashedPassword,
      role,
      department
    });

    await user.save();

    res.json({ msg: `New ${role} created successfully` });

  } catch (err) {
    console.error("Create Staff Error:", err);
    res.status(500).send("Server Error");
  }
});

router.get("/staff", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const staff = await Admin.find().select("-password");
    res.json(staff);
  } catch (err) {
    console.error("Fetch Staff Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 6. DELETE STAFF (System Admin Only)
// ==========================================
router.delete("/staff/:id", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    // Prevent deleting yourself
    // Note: req.user.id comes from the token, req.params.id comes from the URL
    if (req.params.id === req.user.id) {
      return res.status(400).json({ msg: "You cannot delete your own account." });
    }

    const result = await Admin.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ msg: "Staff member not found" });
    }

    res.json({ msg: "Staff member removed" });
  } catch (err) {
    console.error("Delete Staff Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 7. SYSTEM ADMIN: ALL DOCTORS MANAGEMENT
// ==========================================
router.get("/all-doctors", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const doctors = await Doctor.find().select("-password").sort({ createdAt: -1 });
    res.json(doctors);
  } catch (err) {
    console.error("Fetch All Doctors Error:", err);
    res.status(500).send("Server Error");
  }
});

router.put("/all-doctors/:id/approve", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const { isApproved } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      { new: true }
    ).select("-password");

    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    res.json({ msg: isApproved ? "Doctor approved successfully" : "Doctor account rejected", doctor });
  } catch (err) {
    console.error("Approve Doctor Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 8. RECEPTIONIST / NURSE DASHBOARD: DOCTORS STATUS
// ==========================================
router.get("/doctors", protect, authorize(["system_admin", "receptionist", "nurse"]), async (req, res) => {
  try {
    const doctors = await Doctor.find().select("name specialization isArrived allocatedRoom allocatedNurse channelingTime channelingStatus phone profileImage sessionStarted currentQueueNumber");
    res.json(doctors);
  } catch (err) {
    console.error("Fetch Doctors Error:", err);
    res.status(500).send("Server Error");
  }
});

router.put("/doctors/:id/status", protect, authorize(["system_admin", "receptionist", "nurse"]), async (req, res) => {
  try {
    const { isArrived, allocatedRoom, allocatedNurse, channelingTime, channelingStatus, sessionStarted, currentQueueNumber } = req.body;
    let doctor = await Doctor.findById(req.params.id);

    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    if (isArrived !== undefined) {
      doctor.isArrived = isArrived;
      
      // ✅ AUTOMATION: If doctor arrives, find their approved schedule for today and set allocation
      if (isArrived === true) {
        try {
          const ScheduleRequest = mongoose.model('ScheduleRequest');
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);

          const todaySchedule = await ScheduleRequest.findOne({
            doctorId: doctor._id,
            status: 'approved',
            date: { $gte: startOfDay, $lte: endOfDay }
          }).sort({ startTime: 1 }); // Get the first approved session of the day

          if (todaySchedule) {
            console.log(`✅ Auto-populating allocation for ${doctor.name} from schedule: ${todaySchedule.allocatedRoom}, ${todaySchedule.allocatedNurse}`);
            doctor.allocatedRoom = todaySchedule.allocatedRoom || doctor.allocatedRoom;
            doctor.allocatedNurse = todaySchedule.allocatedNurse || doctor.allocatedNurse;
            doctor.channelingTime = new Date(todaySchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        } catch (err) {
          console.error("Failed to auto-populate allocation from schedule:", err.message);
        }
      }
    }
    
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