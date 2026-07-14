import express from "express";
import Appointment from "../models/Appointment.js";
import Bill from "../models/Bill.js";
import Notification from "../models/Notification.js";
import HospitalFinance from "../models/Finance.js";
import Doctor from "../models/Doctor.js";
import ScheduleRequest from "../models/ScheduleRequest.js";
import { auth } from "../middleware/auth.js";
import Patient from "../models/Patient.js";
import { sendBookingConfirmation } from "../utils/emailService.js";

const router = express.Router();

// ==========================================
// 1. BOOK APPOINTMENT (With Notifications & Split Payment Logic)
// ==========================================
router.post("/book", auth, async (req, res) => {
  try {
    const {
      doctorId,
      doctorName,
      department,
      date,
      visitType,
      reason,
      amount,
      paymentStatus, // Get payment status from frontend
      hospitalName   // Optional: Hospital name for finance tracking
    } = req.body;

    if (!doctorId || !date) {
      return res.status(400).json({ msg: "Doctor and Date are required" });
    }

    // --- 1. CHECK IF DOCTOR HAS AN APPROVED SCHEDULE ---
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

    // --- 1A. CHECK DOUBLE BOOKING ---
    const existingBooking = await Appointment.findOne({
      patientId: req.user.id,
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" }
    });

    if (existingBooking) {
      return res.status(400).json({ msg: "You already have an appointment with this doctor on the selected date." });
    }

    // --- 2. CHECK QUEUE LIMIT ---
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

    // --- 3. GENERATE QUEUE NUMBER ---
    const queueNumber = currentAppointmentCount + 1;
    
    // Set total amount (2000 Doctor + 1500 Hospital = 3500)
    const totalAmount = amount || 3500; 

    // 1. Create Appointment
    const newAppointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      doctorName,
      department,
      date,
      queueNumber,
      visitType,
      reason,
      amount: totalAmount,
      status: 'scheduled',
      paymentStatus: paymentStatus || 'pending'
    });

    const savedAppointment = await newAppointment.save();

    // 2. Automatically Create Bill
    let createdBill = null;
    try {
      const newBill = new Bill({
        patientId: req.user.id,
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

    // 3. ✅ ADD TO CHANNELING INCOME (Split: 2000 Doctor, 1500 Hospital)
    if (paymentStatus === 'paid') {
      try {
        const hospital = hospitalName || "Suwasevana";
        
        // Define the exact split
        const hospitalIncome = 1500;
        const doctorIncome = totalAmount > hospitalIncome ? (totalAmount - hospitalIncome) : 0; // Ensures it safely handles weird amounts

        // 3A. Update DOCTOR'S Finance Record
        let doctorFinance = await HospitalFinance.findOne({
          doctorId: doctorId,
          name: hospital
        });

        if (!doctorFinance) {
          doctorFinance = new HospitalFinance({
            doctorId: doctorId,
            name: hospital,
            records: []
          });
        }

        doctorFinance.records.unshift({
          type: 'channeling',
          date: new Date(date),
          patients: 1,
          income: doctorIncome // Assigns the 2000
        });

        await doctorFinance.save();

        // 3B. Update HOSPITAL'S Finance Record (doctorId is null)
        let systemFinance = await HospitalFinance.findOne({
          doctorId: null, 
          name: hospital
        });

        if (!systemFinance) {
          systemFinance = new HospitalFinance({
            doctorId: null,
            name: hospital,
            records: []
          });
        }

        systemFinance.records.unshift({
          type: 'channeling',
          date: new Date(date),
          patients: 1,
          income: hospitalIncome // Assigns the 1500
        });

        await systemFinance.save();

        console.log(`✅ Channeling split successful: ${doctorIncome} to Doctor, ${hospitalIncome} to Hospital`);

      } catch (financeError) {
        console.error("Finance Update Failed:", financeError);
      }
    }

    // 4. ✅ CREATE NOTIFICATIONS
    try {
      await Notification.create({
        userId: req.user.id,
        type: 'appointment',
        message: `Booking Confirmed! Queue #${queueNumber} for Dr. ${doctorName}.`
      });

      if (paymentStatus === 'paid') {
        await Notification.create({
          userId: req.user.id,
          type: 'payment',
          message: `Payment of LKR ${totalAmount} received successfully.`
        });
      }

    } catch (notifError) {
      console.error("Notification Error:", notifError);
    }
    // 5. ✅ SEND EMAIL CONFIRMATION
    try {
      const patient = await Patient.findById(req.user.id);
      if (patient && patient.email) {
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
      }
    } catch (emailErr) {
      console.error("Failed to send booking confirmation email:", emailErr);
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
// 3. GET UPCOMING APPOINTMENT
// ==========================================
router.get("/upcoming", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = await Appointment.findOne({
      patientId: req.user.id,
      date: { $gte: today },
      status: { $ne: 'cancelled' }
    }).sort({ date: 1 });

    if (!upcoming) {
      return res.status(200).json({ appointment: null });
    }

    res.json({ appointment: upcoming });
  } catch (err) {
    console.error("Upcoming Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4. GET QUEUE STATUS
// ==========================================
router.get("/queue-status/:id", auth, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const myAppointment = await Appointment.findById(appointmentId);

    if (!myAppointment) {
      return res.status(404).json({ msg: "Appointment not found" });
    }

    const myToken = myAppointment.queueNumber || 0;

    const doctor = await Doctor.findById(myAppointment.doctorId);
    const currentToken = doctor ? doctor.currentQueueNumber || 0 : 0;

    const peopleAhead = Math.max(0, myToken - currentToken);
    const estimatedWait = peopleAhead * 15;

    res.json({
      queueNumber: myToken,
      currentToken,
      peopleAhead,
      estimatedWait
    });

  } catch (err) {
    console.error("Queue Status Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 5. CANCEL APPOINTMENT
// ==========================================
router.put("/cancel/:id", auth, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) return res.status(404).json({ msg: "Not Found" });

    if (appointment.patientId.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not Authorized" });
    }

    appointment.status = "cancelled";
    await appointment.save();

    try {
      await Notification.create({
        userId: req.user.id,
        type: 'cancellation',
        message: `Appointment with ${appointment.doctorName} on ${new Date(appointment.date).toLocaleDateString()} has been cancelled.`,
        metadata: { appointmentId: appointment._id }
      });
    } catch (notifError) {
      console.error("Notification Error:", notifError);
    }

    res.json({ msg: "Cancelled Successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;