import express from "express";
import Notification from "../models/Notification.js";
import { auth } from "../middleware/auth.js"; 

const router = express.Router();

// 1. GET ALL NOTIFICATIONS FOR PATIENT
router.get("/", auth, async (req, res) => {
  try {
    // We look for userId matching the authenticated patient's ID
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(50);
      
    res.json(notifications);
  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. GET UNREAD COUNT
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.user.id, 
      read: false 
    });
    res.json({ count });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 3. MARK SINGLE AS READ
router.put("/:id/read", auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) return res.status(404).json({ msg: "Not found" });
    res.json(notification);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 4. MARK ALL AS READ
router.put("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ msg: "Updated all" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 5. DELETE
router.delete("/:id", auth, async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, userId: req.user.id });
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 6. CLEAR ALL NOTIFICATIONS
router.delete("/clear-all", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });
    res.json({ msg: "All notifications cleared" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;
