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
import ScheduleRequest from "../models/ScheduleRequest.js";
import { protect, authorize } from "../middleware/authRole.js";
import { sendBookingConfirmation, sendDoctorWelcomeEmail, sendDoctorApprovalEmail } from "../utils/emailService.js";
import crypto from "crypto"; 
import nodemailer from "nodemailer"; 
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
      .populate("patientId", "fullName phone patientId")
      .populate("doctorId", "name department")
      .sort({ date: -1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4A. WALK-IN APPOINTMENT BOOKING
// ==========================================
router.post("/appointments/walkin", protect, async (req, res) => {
  try {
    const { patientDetails, appointmentDetails } = req.body;

    if (!patientDetails || !appointmentDetails) {
      return res.status(400).json({ msg: "Patient details and appointment details are required." });
    }

    const { fullName, nic, dob, phone, email, patientId } = patientDetails;
    const { doctorId, doctorName, department, date, visitType, reason, paymentStatus, amount } = appointmentDetails;

    if (!fullName || !phone) {
      return res.status(400).json({ msg: "Patient Name and Phone number are required." });
    }

    if (!doctorId || !date) {
      return res.status(400).json({ msg: "Doctor and Date are required." });
    }

    // --- 1. FIND OR CREATE PATIENT ---
    let patient = null;
    if (patientId && patientId.trim() !== "") {
      patient = await Patient.findOne({ patientId: patientId.toUpperCase() });
    }

    if (!patient) {
      // Create new patient
      const baseUsername = fullName.toLowerCase().replace(/\s+/g, "") || "patient";
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const username = `${baseUsername}${randomSuffix}`;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("Walkin123!", salt);

      // Generate unique values for optional fields if not provided
      const resolvedNic = (nic && nic.trim() !== "")
        ? nic
        : `WALKIN-NIC-${phone}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const resolvedEmail = (email && email.trim() !== "")
        ? email.toLowerCase()
        : `walkin-${phone}-${Date.now()}@care101.com`;
      const resolvedDob = (dob && dob.trim() !== "")
        ? new Date(dob)
        : new Date("1970-01-01");

      patient = new Patient({
        fullName,
        username,
        email: resolvedEmail,
        nicNumber: resolvedNic,
        password: hashedPassword,
        mobileNumber: phone,
        dateOfBirth: resolvedDob,
        gender: "Other", // Default for walk-in
        district: "Colombo", // Default for walk-in
        isRegistered: false
      });

      await patient.save();
    } else {
      // Update missing/mock details if admin has now provided real data
      let detailsUpdated = false;
      if (nic && nic.trim() !== "" && patient.nicNumber.startsWith("WALKIN-NIC-")) {
        patient.nicNumber = nic;
        detailsUpdated = true;
      }
      if (email && email.trim() !== "" && (patient.email.startsWith("walkin-") || patient.email.endsWith("@care101.com"))) {
        patient.email = email.toLowerCase();
        detailsUpdated = true;
      }
      if (dob && dob.trim() !== "" && patient.dateOfBirth.getTime() === new Date("1970-01-01").getTime()) {
        patient.dateOfBirth = new Date(dob);
        detailsUpdated = true;
      }

      if (detailsUpdated) {
        try {
          await patient.save();
        } catch (saveErr) {
          console.error("Failed to update patient walkin details:", saveErr.message);
        }
      }
    }

    // --- 2. CHECK IF DOCTOR HAS AN APPROVED SCHEDULE ---
    const bookingDate = new Date(date);
    const startOfDay = new Date(bookingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(bookingDate);
    endOfDay.setHours(23, 59, 59, 999);

    const approvedSchedule = await ScheduleRequest.findOne({
      doctorId,
      status: "approved",
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (!approvedSchedule) {
      return res.status(400).json({ msg: "This doctor is not available on the selected date (No approved schedule)." });
    }

    // --- 3. CHECK QUEUE LIMIT ---
    const currentAppointmentCount = await Appointment.countDocuments({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" }
    });

    if (!approvedSchedule.isUnlimited && approvedSchedule.queueLimit) {
      if (currentAppointmentCount >= approvedSchedule.queueLimit) {
        return res.status(400).json({ msg: "Sorry, this session is full. Maximum patient count reached." });
      }
    }

    // --- 4. GENERATE QUEUE NUMBER ---
    const queueNumber = currentAppointmentCount + 1;
    
    // Set total amount (2000 Doctor + 1500 Hospital = 3500)
    const totalAmount = amount || 3500; 

    // --- 5. CREATE APPOINTMENT ---
    const newAppointment = new Appointment({
      patientId: patient._id,
      doctorId,
      doctorName,
      department,
      date,
      queueNumber,
      visitType: visitType || 'Consultation',
      reason,
      amount: totalAmount,
      status: 'confirmed', // Walk-ins confirmed automatically by admin/receptionist
      paymentStatus: paymentStatus || 'pending'
    });

    const savedAppointment = await newAppointment.save();

    // --- 6. AUTOMATICALLY CREATE BILL ---
    let createdBill = null;
    try {
      const newBill = new Bill({
        patientId: patient._id,
        appointmentId: savedAppointment._id,
        title: `Consultation - ${doctorName}`,
        type: "Appointment",
        amount: totalAmount,
        status: paymentStatus === 'paid' ? "Paid" : "Pending",
        date: new Date()
      });
      createdBill = await newBill.save();
    } catch (billError) {
      console.error("Bill Creation Failed:", billError);
    }

    // --- 7. ADD TO CHANNELING INCOME (Split: 2000 Doctor, 1500 Hospital) ---
    if (paymentStatus === 'paid') {
      try {
        const hospitalName = "Suwasevana";
        
        // Define the exact split
        const hospitalIncome = 1500;
        const doctorIncome = totalAmount > hospitalIncome ? (totalAmount - hospitalIncome) : 0;

        // Update DOCTOR'S Finance Record
        let doctorFinance = await HospitalFinance.findOne({
          doctorId: doctorId,
          name: hospitalName
        });

        if (!doctorFinance) {
          doctorFinance = new HospitalFinance({
            doctorId: doctorId,
            name: hospitalName,
            records: []
          });
        }

        doctorFinance.records.unshift({
          type: 'channeling',
          date: new Date(date),
          patients: 1,
          income: doctorIncome
        });

        await doctorFinance.save();

        // Update HOSPITAL'S Finance Record (doctorId is null)
        let systemFinance = await HospitalFinance.findOne({
          doctorId: null, 
          name: hospitalName
        });

        if (!systemFinance) {
          systemFinance = new HospitalFinance({
            doctorId: null,
            name: hospitalName,
            records: []
          });
        }

        systemFinance.records.unshift({
          type: 'channeling',
          date: new Date(date),
          patients: 1,
          income: hospitalIncome
        });

        await systemFinance.save();

      } catch (financeError) {
        console.error("Finance Update Failed:", financeError);
      }
    }

    // --- 8. CREATE NOTIFICATIONS ---
    try {
      await Notification.create({
        userId: patient._id,
        type: 'appointment',
        message: `Booking Confirmed! Queue #${queueNumber} for Dr. ${doctorName}.`
      });

      if (paymentStatus === 'paid') {
        await Notification.create({
          userId: patient._id,
          type: 'payment',
          message: `Payment of LKR ${totalAmount} received successfully.`
        });
      }
    } catch (notifError) {
      console.error("Notification Error:", notifError);
    }

    // --- 9. SEND EMAIL CONFIRMATION ---
    try {
      const doctorInfo = await Doctor.findById(doctorId);
      const doctorRoom = doctorInfo ? doctorInfo.allocatedRoom : "TBA";
      
      let pdfBuffer = null;
      if (paymentStatus === 'paid' && createdBill) {
        try {
          const { generateReceiptPdf } = await import("../utils/pdfService.js");
          pdfBuffer = await generateReceiptPdf(createdBill, savedAppointment, doctorInfo, patient);
        } catch (pdfErr) {
          console.error("Failed to generate PDF receipt:", pdfErr);
        }
      }
      
      await sendBookingConfirmation(patient.email, savedAppointment, doctorRoom, pdfBuffer);
    } catch (emailErr) {
      console.error("Failed to send booking confirmation email:", emailErr);
    }

    res.status(201).json(savedAppointment);

  } catch (err) {
    console.error("Walkin Booking Error:", err.message);
    res.status(500).json({ msg: `Booking Failed: ${err.message}` });
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
        const updatedBill = await Bill.findOneAndUpdate({ appointmentId: appointment._id }, { status: "Paid" }, { new: true });

        // Generate and email PDF Receipt
        try {
          const patient = await Patient.findById(appointment.patientId);
          if (patient && patient.email) {
            const doctorInfo = await Doctor.findById(appointment.doctorId);
            const { generateReceiptPdf } = await import("../utils/pdfService.js");
            const { sendPaymentReceipt } = await import("../utils/emailService.js");
            const pdfBuffer = await generateReceiptPdf(updatedBill || {}, appointment, doctorInfo, patient);
            await sendPaymentReceipt(patient.email, updatedBill || { _id: appointment._id, amount: appointment.amount || 3500, title: `Consultation - ${appointment.doctorName}` }, pdfBuffer);
          }
        } catch (pdfEmailErr) {
          console.error("Failed to generate/send PDF receipt on admin update:", pdfEmailErr);
        }

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
router.get("/patients/search/patientid/:patientId", protect, async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.params.patientId.toUpperCase() }).select("-password");
    if (!patient) return res.status(404).json({ msg: "Patient not found" });
    res.json(patient);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.get("/patients/search/mobile/:mobileNumber", protect, async (req, res) => {
  try {
    const { mobileNumber } = req.params;
    const patients = await Patient.find({
      mobileNumber: { $regex: mobileNumber, $options: "i" }
    }).select("-password");
    res.json(patients);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

router.get("/bills/all", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const manualBills = await Bill.find().populate("patientId", "fullName nicNumber patientId").lean();
    const appointments = await Appointment.find({ amount: { $gt: 0 } }).populate("patientId", "fullName nicNumber patientId").lean();

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
    // 1. Catch doctorId from the frontend request
    const { patientId, doctorId, title, type, amount, status } = req.body;

    const newBill = new Bill({
      patientId: new mongoose.Types.ObjectId(patientId),
      doctorId: doctorId ? new mongoose.Types.ObjectId(doctorId) : null, // Link doctor if provided
      title,
      type,
      amount,
      status: status || "Pending",
      date: new Date()
    });

    await newBill.save();

    if (status === "Paid") {
      try {
        // 2. Calculate the financial split based on Type
        let hospitalIncome = amount;
        let doctorIncome = 0;

        if (type === "Surgery") {
            hospitalIncome = amount * 0.25; // 25% to Hospital
            doctorIncome = amount * 0.75;   // 75% to Doctor
        }

        // 3. Update HOSPITAL Finance
        const hospitalName = "Suwasevana";
        let hospitalFinance = await HospitalFinance.findOne({ name: hospitalName, doctorId: null });
        if (!hospitalFinance) {
          hospitalFinance = new HospitalFinance({ name: hospitalName, records: [], doctorId: null });
        }
        hospitalFinance.records.unshift({
          type: type.toLowerCase() === 'appointment' ? 'channeling' : 'surgical',
          date: new Date(),
          patients: 1,
          income: hospitalIncome // Uses the 25% calculated above
        });
        await hospitalFinance.save();

        // 4. Update DOCTOR Finance (Only if it's Surgery & Doctor is selected)
        if (type === "Surgery" && doctorId && doctorIncome > 0) {
            let doctorFinance = await HospitalFinance.findOne({ doctorId: doctorId });
            if (!doctorFinance) {
                // Create a finance record for this doctor if they don't have one yet
                doctorFinance = new HospitalFinance({ doctorId: doctorId, name: "Doctor Revenue", records: [] });
            }
            doctorFinance.records.unshift({
                type: 'surgical',
                date: new Date(),
                patients: 1,
                income: doctorIncome // Uses the 75% calculated above
            });
            await doctorFinance.save();
        }

      } catch (finErr) { 
        console.error("Finance Error:", finErr); 
      }
    }

    // Generate and email PDF Receipt if manual bill is paid immediately
    if (status === "Paid") {
      try {
        const patient = await Patient.findById(newBill.patientId);
        if (patient && patient.email) {
          let doctor = null;
          if (doctorId) {
            doctor = await Doctor.findById(doctorId);
          }
          const { generateReceiptPdf } = await import("../utils/pdfService.js");
          const { sendPaymentReceipt } = await import("../utils/emailService.js");
          const pdfBuffer = await generateReceiptPdf(newBill, null, doctor, patient);
          await sendPaymentReceipt(patient.email, newBill, pdfBuffer);
        }
      } catch (pdfEmailErr) {
        console.error("Failed to generate/send PDF receipt for manual bill:", pdfEmailErr);
      }
    }

    await Notification.create({
      userId: newBill.patientId,
      type: "payment",
      message: status === "Paid" 
        ? `Receipt Confirmed! LKR ${amount} paid for ${title}.` 
        : `New Bill Issued: LKR ${amount} due for ${title}.`
    });

    const populatedBill = await Bill.findById(newBill._id).populate("patientId", "fullName nicNumber patientId");
    res.json({ msg: "Bill created successfully", bill: populatedBill });
  } catch (err) {
    console.error("Create Bill Error:", err);
    res.status(500).send("Server Error");
  }
});

router.put("/bills/pay/:billId", protect, authorize(["system_admin", "receptionist"]), async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId);
    if (!bill) {
      return res.status(404).json({ msg: "Bill not found" });
    }
    
    if (bill.status === "Paid") {
      return res.status(400).json({ msg: "Bill is already paid" });
    }

    bill.status = "Paid";
    await bill.save();

    // 1. Calculate the financial split based on Type
    try {
      let hospitalIncome = bill.amount;
      let doctorIncome = 0;

      if (bill.type === "Surgery") {
          hospitalIncome = bill.amount * 0.25;
          doctorIncome = bill.amount * 0.75;
      }

      // 2. Update HOSPITAL Finance
      const hospitalName = "Suwasevana";
      let hospitalFinance = await HospitalFinance.findOne({ name: hospitalName, doctorId: null });
      if (!hospitalFinance) {
        hospitalFinance = new HospitalFinance({ name: hospitalName, records: [], doctorId: null });
      }
      hospitalFinance.records.unshift({
        type: bill.type.toLowerCase() === 'appointment' ? 'channeling' : 'surgical',
        date: new Date(),
        patients: 1,
        income: hospitalIncome
      });
      await hospitalFinance.save();

      // 3. Update DOCTOR Finance (Only if it's Surgery & Doctor is selected)
      if (bill.type === "Surgery" && bill.doctorId && doctorIncome > 0) {
          let doctorFinance = await HospitalFinance.findOne({ doctorId: bill.doctorId });
          if (!doctorFinance) {
              doctorFinance = new HospitalFinance({ doctorId: bill.doctorId, name: "Doctor Revenue", records: [] });
          }
          doctorFinance.records.unshift({
              type: 'surgical',
              date: new Date(),
              patients: 1,
              income: doctorIncome
          });
          await doctorFinance.save();
      }
    } catch (finErr) {
      console.error("Finance Error:", finErr);
    }

    // 4. Generate and email PDF Receipt
    try {
      const patient = await Patient.findById(bill.patientId);
      if (patient && patient.email) {
        let doctor = null;
        if (bill.doctorId) {
          doctor = await Doctor.findById(bill.doctorId);
        }
        const { generateReceiptPdf } = await import("../utils/pdfService.js");
        const { sendPaymentReceipt } = await import("../utils/emailService.js");
        const pdfBuffer = await generateReceiptPdf(bill, null, doctor, patient);
        await sendPaymentReceipt(patient.email, bill, pdfBuffer);
      }
    } catch (pdfEmailErr) {
      console.error("Failed to generate/send PDF receipt for manual bill:", pdfEmailErr);
    }

    // 5. Create Notification
    await Notification.create({
      userId: bill.patientId,
      type: "payment",
      message: `Receipt Confirmed! LKR ${bill.amount} paid for ${bill.title}.`
    });

    const populatedBill = await Bill.findById(bill._id).populate("patientId", "fullName nicNumber patientId");
    res.json({ msg: "Bill marked as paid successfully", bill: populatedBill });
  } catch (err) {
    console.error("Pay Bill Error:", err);
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
router.post("/create-doctor", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const {
      fullName,
      nameWithInitials,
      slmcRegistrationNumber,
      specialization,
      nicNumber,
      email,
      phoneNumber,
      password
    } = req.body;

    // 1. Validation
    if (!fullName || !nameWithInitials || !slmcRegistrationNumber || !specialization || !nicNumber || !email || !phoneNumber || !password) {
      return res.status(400).json({ msg: "All fields are required." });
    }

    // 2. Uniqueness Checks
    const existingDoctorEmail = await Doctor.findOne({ email });
    const existingPatientEmail = await Patient.findOne({ email });
    const existingAdminEmail = await Admin.findOne({ email });

    if (existingDoctorEmail || existingPatientEmail || existingAdminEmail) {
      return res.status(400).json({ msg: "A user with this email already exists." });
    }

    const existingSlmc = await Doctor.findOne({ slmcReg: slmcRegistrationNumber });
    if (existingSlmc) {
      return res.status(400).json({ msg: "A doctor with this SLMC registration number already exists." });
    }

    const existingNic = await Doctor.findOne({ nic: nicNumber });
    if (existingNic) {
      return res.status(400).json({ msg: "A doctor with this NIC number already exists." });
    }

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create Doctor
    const newDoctor = new Doctor({
      name: fullName,
      fullName,
      email,
      password: hashedPassword,
      specialization,
      nic: nicNumber,
      phone: phoneNumber,
      slmcReg: slmcRegistrationNumber,
      nameWithInitials,
      isApproved: true // Direct approval
    });

    await newDoctor.save();

    // 5. Send Welcome Email
    sendDoctorWelcomeEmail(email, fullName, password, slmcRegistrationNumber).catch(err => {
      console.error("Failed to send welcome email to doctor", err);
    });

    // Return the created doctor without password
    const docResponse = newDoctor.toObject();
    delete docResponse.password;

    res.status(201).json({ msg: "Doctor account created successfully and welcome email sent.", doctor: docResponse });

  } catch (err) {
    console.error("Create Doctor Error:", err);
    res.status(500).send("Server Error");
  }
});

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
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ msg: "Doctor not found" });
    }

    const wasApproved = doctor.isApproved;
    doctor.isApproved = isApproved;
    await doctor.save();

    // If newly approved, send automated notification email
    if (isApproved && !wasApproved) {
      sendDoctorApprovalEmail(doctor.email, doctor.name || doctor.fullName).catch(err => {
        console.error("Failed to send approval email to doctor", err);
      });
    }

    const docResponse = doctor.toObject();
    delete docResponse.password;

    res.json({ msg: isApproved ? "Doctor approved" : "Doctor rejected", doctor: docResponse });
  } catch (err) {
    console.error("Approve Doctor Error:", err);
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
              message: `Dr. ${doctor.name} has arrived. ${timeInfo} Please proceed to  ${allocatedRoom || doctor.allocatedRoom || 'TBA'}.`,
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

// ==========================================
// 1A. FORGOT PASSWORD (ADMIN)
// ==========================================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });

    // Security check: Don't reveal if the email exists
    if (!admin) {
      return res.json({ msg: "If that email exists, a reset link has been sent." });
    }

    // 1. Generate a random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 2. Hash the token and set expiration (15 minutes) to save in DB
    admin.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    admin.resetPasswordExpire = Date.now() + 15 * 60 * 1000;
    await admin.save();

    // 3. Create the reset URL (Points to your Next.js frontend)
    // Make sure NEXT_PUBLIC_FRONTEND_URL or a similar variable exists in your .env
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/admin/reset-password/${resetToken}`;

    // 4. Send the Email using Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const message = {
      from: '"Care101 IT" <noreply@care101.com>',
      to: admin.email,
      subject: "Admin Password Reset Request",
      text: `You requested a password reset. Please go to this link to reset your password: \n\n ${resetUrl} \n\n This link expires in 15 minutes.`,
    };

    await transporter.sendMail(message);
    res.json({ msg: "If that email exists, a reset link has been sent." });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 1B. RESET PASSWORD WITH TOKEN (ADMIN)
// ==========================================
router.put("/reset-password/:token", async (req, res) => {
  try {
    const { newPassword } = req.body;

    // 1. Re-hash the token from the URL so we can compare it to the DB
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // 2. Find the admin with this token AND ensure it hasn't expired
    const admin = await Admin.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!admin) {
      return res.status(400).json({ msg: "Invalid or expired reset token." });
    }

    // 3. Hash the new password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    // 4. Clear the reset token fields so they can't be used again
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpire = undefined;
    await admin.save();

    res.json({ msg: "Password successfully reset. You can now log in." });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 6A. RESET STAFF PASSWORD (ADMIN OVERRIDE)
// ==========================================
router.post("/staff/:id/reset-password", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    // Find the staff member (Admins, Nurses, Receptionists are in Admin model)
    const staff = await Admin.findById(req.params.id);
    if (!staff) return res.status(404).json({ msg: "Staff member not found" });

    // 1. Generate a temporary password (e.g., Care101@4928)
    const randomPin = Math.floor(1000 + Math.random() * 9000);
    const tempPassword = `Care101@${randomPin}`;

    // 2. Hash the temporary password
    const salt = await bcrypt.genSalt(10);
    staff.password = await bcrypt.hash(tempPassword, salt);

    // Optional: If you added the requiresPasswordChange flag to your schema earlier
    // staff.requiresPasswordChange = true;

    await staff.save();

    // 3. Return the RAW password to the admin frontend
    res.json({
      msg: "Password reset successfully",
      tempPassword: tempPassword
    });

  } catch (err) {
    console.error("Reset Staff Password Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 1C. CHANGE OWN PASSWORD (LOGGED IN USER)
// ==========================================
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Find the logged-in user (req.user.id comes from your 'protect' middleware)
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: "User not found" });
    }

    // 2. Check if the current password provided matches the database
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Incorrect current password." });
    }

    // 3. Hash the new password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);

    // 4. Save the updated user
    await admin.save();

    res.json({ msg: "Password successfully updated." });

  } catch (err) {
    console.error("Change Password Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;