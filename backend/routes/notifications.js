import express from "express";
import Notification from "../models/Notification.js";
import Appointment from "../models/Appointment.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// GET NOTIFICATIONS
router.get("/", auth, async (req, res) => {
  try {
    let notifications = await Notification.find({ userId: req.user.id })
      .sort({ timestamp: -1 })
      .lean(); // .lean() is important!

    // Reminder Logic
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setHours(23, 59, 59, 999);

    const upcomingAppointments = await Appointment.find({
      patientId: req.user.id,
      date: { $gte: tomorrow, $lte: endOfTomorrow },
      status: 'Confirmed'
    });

    upcomingAppointments.forEach(app => {
      notifications.unshift({
        _id: "rem-" + app._id,
        type: "reminder",
        message: `Reminder: Appointment with ${app.doctorName} tomorrow.`,
        timestamp: new Date(),
        read: false
      });
    });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// MARK READ
router.put("/read/:id", auth, async (req, res) => {
  try {
    if (req.params.id.startsWith("rem-")) return res.json({ msg: "Ok" });
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ msg: "Marked as read" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;