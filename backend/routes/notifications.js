import express from "express";
import Notification from "../models/Notification.js";
import { auth } from "../middleware/auth.js"; // Assuming this is your patient auth middleware

const router = express.Router();

// ==========================================
// 1. GET ALL NOTIFICATIONS
// ==========================================
router.get("/", auth, async (req, res) => {
  try {
    // Safety check for user ID from middleware
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "User identification failed" });
    }

    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ timestamp: -1 }) // Newest first
      .limit(50);
      
    res.json(notifications);
  } catch (err) {
    console.error("Fetch Notifications Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. MARK AS READ
// ==========================================
router.put("/:id/read", auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user.id // Ensure patient can only mark their own notifications
    });

    if (!notification) {
      return res.status(404).json({ msg: "Notification not found" });
    }

    notification.read = true;
    await notification.save();
    
    res.json(notification);
  } catch (err) {
    console.error("Mark Read Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. MARK ALL AS READ
// ==========================================
router.put("/read-all", auth, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { $set: { read: true } }
    );
    
    res.json({ 
      msg: "All notifications marked as read", 
      count: result.modifiedCount 
    });
  } catch (err) {
    console.error("Mark All Read Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4. DELETE NOTIFICATION
// ==========================================
router.delete("/:id", auth, async (req, res) => {
  try {
    const result = await Notification.deleteOne({
      _id: req.params.id,
      userId: req.user.id
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ msg: "Notification not found" });
    }
    
    res.json({ msg: "Notification deleted" });
  } catch (err) {
    console.error("Delete Notification Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 5. GET UNREAD COUNT (For Mobile/Web Badges)
// ==========================================
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.user.id, 
      read: false 
    });
    
    res.json({ count });
  } catch (err) {
    console.error("Unread Count Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;