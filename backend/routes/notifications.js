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

// GET UNREAD COUNT
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      read: false
    });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// MARK READ (Single)
router.put("/read/:id", auth, async (req, res) => {
  try {
    if (req.params.id.startsWith("rem-")) return res.json({ msg: "Ok" });

    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!notification) {
      return res.status(404).json({ msg: "Notification not found" });
    }

    notification.read = true;
    await notification.save();

    res.json({ msg: "Marked as read" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// MARK ALL AS READ
router.put("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );
    res.json({ msg: "All notifications marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// DELETE NOTIFICATION
router.delete("/:id", auth, async (req, res) => {
  try {
    if (req.params.id.startsWith("rem-")) {
      return res.json({ msg: "Cannot delete reminder" });
    }

    const result = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!result) {
      return res.status(404).json({ msg: "Notification not found" });
    }

    res.json({ msg: "Notification deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// CLEAR ALL NOTIFICATIONS
router.delete("/clear-all", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });
    res.json({ msg: "All notifications cleared" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

export default router;