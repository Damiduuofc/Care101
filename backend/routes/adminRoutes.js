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
import { sendBookingConfirmation, sendDoctorWelcomeEmail } from "../utils/emailService.js";

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

// ==========================================
// 4A. WALK-IN APPOINTMENT BOOKING
// ==========================================
router.post("/appointments/walkin", protect, async (req, res) => {
  try {
    const { patientDetails, appointmentDetails } = req.body;

    if (!patientDetails || !appointmentDetails) {
      return res.status(400).json({ msg: "Patient details and appointment details are required." });
    }

    const { fullName, nic, dob, phone, email } = patientDetails;
    const { doctorId, doctorName, department, date, visitType, reason, paymentStatus, amount } = appointmentDetails;

    if (!fullName || !nic || !dob || !phone || !email) {
      return res.status(400).json({ msg: "All patient details (Name, NIC, DOB, Phone, Email) are required." });
    }

    if (!doctorId || !date) {
      return res.status(400).json({ msg: "Doctor and Date are required." });
    }

    // --- 1. FIND OR CREATE PATIENT ---
    let patient = await Patient.findOne({ nicNumber: nic });
    if (!patient) {
      patient = await Patient.findOne({ email: email.toLowerCase() });
    }

    if (!patient) {
      // Create new patient
      const baseUsername = fullName.toLowerCase().replace(/\s+/g, "") || "patient";
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const username = `${baseUsername}${randomSuffix}`;

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("Walkin123!", salt);

      patient = new Patient({
        fullName,
        username,
        email: email.toLowerCase(),
        nicNumber: nic,
        password: hashedPassword,
        mobileNumber: phone,
        dateOfBirth: new Date(dob),
        gender: "Other", // Default for walk-in
        district: "Colombo", // Default for walk-in
        isRegistered: false
      });

      await patient.save();
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

    const populatedBill = await Bill.findById(newBill._id).populate("patientId", "fullName nicNumber");
    res.json({ msg: "Bill created successfully", bill: populatedBill });
  } catch (err) {
    console.error("Create Bill Error:", err);
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
    sendDoctorWelcomeEmail(email, fullName, password).catch(err => {
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

export default router;
