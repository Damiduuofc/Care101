import express from "express";
import Appointment from "../models/Appointment.js";
import Bill from "../models/Bill.js"; 
import Notification from "../models/Notification.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. BOOK APPOINTMENT & CREATE BILL (Updated with Token)
// ==========================================
router.post("/book", auth, async (req, res) => {
  try {
    const { doctorId, doctorName, department, date, visitType, reason, amount } = req.body;

    if (!doctorId || !date) {
      return res.status(400).json({ msg: "Doctor and Date are required" });
    }

    // --- NEW: GENERATE TOKEN NUMBER ---
    // Count existing appointments for this doctor on this specific date to assign the next token
    // We assume 'date' is passed as a string (YYYY-MM-DD) or ISO object. 
    // We strictly check the start/end of that day.
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await Appointment.countDocuments({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    
    const tokenNumber = count + 1;
    // ----------------------------------

    // 1. Create Appointment
    const newAppointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      doctorName,
      department,
      date,
      tokenNumber, // <--- Save the token
      visitType,
      reason,
      amount: amount || 2000,
      status: 'pending',
      paymentStatus: 'pending'
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
        status: "Pending",
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
        message: `Booking request sent for Dr. ${doctorName}. Your Token is #${tokenNumber}`
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
// 3. GET UPCOMING APPOINTMENT (New)
// ==========================================
router.get("/upcoming", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the first appointment in the future (or today) that isn't cancelled
    const upcoming = await Appointment.findOne({
      patientId: req.user.id,
      date: { $gte: today },
      status: { $ne: 'cancelled' }
    }).sort({ date: 1 }); // Sort by date ascending (closest first)

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
// 4. GET QUEUE STATUS (New)
// ==========================================
router.get("/queue-status/:id", auth, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const myAppointment = await Appointment.findById(appointmentId);

    if (!myAppointment) {
      return res.status(404).json({ msg: "Appointment not found" });
    }

    // 1. Get My Token
    const myToken = myAppointment.tokenNumber || 0;

    // 2. Calculate Current Ongoing Token
    // Logic: Count how many appointments for this doctor on this day are 'completed' or 'in-progress'
    // This gives us an approximation of where the queue is.
    const startOfDay = new Date(myAppointment.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(myAppointment.date);
    endOfDay.setHours(23, 59, 59, 999);

    const completedCount = await Appointment.countDocuments({
      doctorId: myAppointment.doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'completed' 
    });

    const currentToken = completedCount + 1; // The next person is current

    // 3. Calculate People Ahead & Wait Time
    // Ensure we don't show negative numbers if I'm late or status is weird
    const peopleAhead = Math.max(0, myToken - currentToken);
    
    // Assume 15 mins per patient (you can make this dynamic if you have a Doctor config)
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

    res.json({ msg: "Cancelled Successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;