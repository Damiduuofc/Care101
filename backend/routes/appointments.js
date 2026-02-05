import express from "express";
import Appointment from "../models/Appointment.js";
import Bill from "../models/Bill.js";
import Notification from "../models/Notification.js";
import HospitalFinance from "../models/Finance.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. BOOK APPOINTMENT (With Notifications & Payment Logic)
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
      paymentStatus, // ✅ Get payment status from frontend
      hospitalName // ✅ Optional: Hospital name for finance tracking
    } = req.body;

    if (!doctorId || !date) {
      return res.status(400).json({ msg: "Doctor and Date are required" });
    }

    // --- GENERATE TOKEN NUMBER ---
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await Appointment.countDocuments({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    const tokenNumber = count + 1;

    // 1. Create Appointment
    const newAppointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      doctorName,
      department,
      date,
      tokenNumber,
      visitType,
      reason,
      amount: amount || 2000,
      status: 'scheduled',
      paymentStatus: paymentStatus || 'pending' // ✅ Save 'paid' or 'pending'
    });

    const savedAppointment = await newAppointment.save();

    // 2. Automatically Create Bill
    try {
      const newBill = new Bill({
        patientId: req.user.id,
        appointmentId: savedAppointment._id,
        title: `Consultation - ${doctorName}`,
        type: "Appointment",
        amount: amount || 2000,
        // ✅ Mark bill as Paid if appointment is paid
        status: paymentStatus === 'paid' ? "Paid" : "Pending",
        date: new Date()
      });
      await newBill.save();
    } catch (billError) {
      console.error("Bill Creation Failed:", billError);
    }

    // 3. ✅ ADD TO CHANNELING INCOME (If Paid)
    if (paymentStatus === 'paid') {
      try {
        // Find or create hospital finance record
        const hospital = hospitalName || "Suwasevana"; // Default to Suwasevana

        let hospitalFinance = await HospitalFinance.findOne({
          doctorId: doctorId,
          name: hospital
        });

        // If hospital doesn't exist, create it
        if (!hospitalFinance) {
          hospitalFinance = new HospitalFinance({
            doctorId: doctorId,
            name: hospital,
            whtEnabled: false,
            records: []
          });
        }

        // Add channeling record
        hospitalFinance.records.unshift({
          type: 'channeling',
          date: new Date(date),
          patients: 1,
          income: amount || 2000
        });

        await hospitalFinance.save();
        console.log(`✅ Channeling income added: ${amount || 2000} LKR to ${hospital}`);

      } catch (financeError) {
        console.error("Finance Update Failed:", financeError);
        // Don't fail the appointment if finance update fails
      }
    }

    // 4. ✅ CREATE NOTIFICATIONS
    try {
      // Notification A: Booking Confirmed
      await Notification.create({
        userId: req.user.id,
        type: 'appointment',
        message: `Booking Confirmed! Token #${tokenNumber} for Dr. ${doctorName}.`
      });

      // Notification B: Payment Received (Only if paid)
      if (paymentStatus === 'paid') {
        await Notification.create({
          userId: req.user.id,
          type: 'payment', // Ensure 'payment' is in your Notification Enum
          message: `Payment of LKR ${amount || 2000} received successfully.`
        });
      }

    } catch (notifError) {
      console.error("Notification Error:", notifError);
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

    const myToken = myAppointment.tokenNumber || 0;

    const startOfDay = new Date(myAppointment.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(myAppointment.date);
    endOfDay.setHours(23, 59, 59, 999);

    const completedCount = await Appointment.countDocuments({
      doctorId: myAppointment.doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'completed'
    });

    const currentToken = completedCount + 1;
    const peopleAhead = Math.max(0, myToken - currentToken);
    const estimatedWait = peopleAhead * 15;

    res.json({
      myToken,
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

    // ✅ CREATE CANCELLATION NOTIFICATION
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