import express from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { protect } from "../middleware/authRole.js"; 


const router = express.Router();

// Helper to reliably query userId as both ObjectId or string
const getUserCondition = (userId) => {
  if (!userId) return null;
  return mongoose.Types.ObjectId.isValid(userId)
    ? { $in: [userId, new mongoose.Types.ObjectId(userId)] }
    : userId;
};

// ==========================================
// 1. GET ALL NOTIFICATIONS (Patient or Doctor)
// ==========================================
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userCondition = getUserCondition(userId);
    if (!userCondition) {
      return res.status(401).json({ msg: "User identification failed" });
    }

    const notifications = await Notification.find({ userId: userCondition })
      .sort({ timestamp: -1 })
      .limit(50);
      
    res.json(notifications);
  } catch (err) {
    console.error("Fetch Notifications Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. GET UNREAD COUNT
// ==========================================
router.get("/unread-count", protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userCondition = getUserCondition(userId);
    if (!userCondition) {
      return res.status(401).json({ msg: "User identification failed" });
    }

    const count = await Notification.countDocuments({ 
      userId: userCondition, 
      read: false 
    });
    res.json({ count });
  } catch (err) {
    console.error("Unread Count Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. MARK ALL AS READ (Must be before parameterized routes)
// ==========================================
router.put("/read-all", protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userCondition = getUserCondition(userId);
    if (!userCondition) {
      return res.status(401).json({ msg: "User identification failed" });
    }

    await Notification.updateMany(
      { userId: userCondition, read: false },
      { $set: { read: true } }
    );
    res.json({ msg: "Updated all" });
  } catch (err) {
    console.error("Mark All Read Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4. MARK SINGLE AS READ (Supports both /read/:id and /:id/read)
// ==========================================
const handleMarkAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid notification ID" });
    }

    const userId = req.user.id || req.user._id;
    const userCondition = getUserCondition(userId);

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: userCondition },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) return res.status(404).json({ msg: "Not found" });
    res.json(notification);
  } catch (err) {
    console.error("Mark Read Error:", err.message);
    res.status(500).send("Server Error");
  }
};

router.put("/read/:id", protect, handleMarkAsRead);
router.put("/:id/read", protect, handleMarkAsRead);

// ==========================================
// 5. CLEAR ALL NOTIFICATIONS (Must be before /:id)
// ==========================================
router.delete("/clear-all", protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const userCondition = getUserCondition(userId);
    if (!userCondition) {
      return res.status(401).json({ msg: "User identification failed" });
    }

    const result = await Notification.deleteMany({ userId: userCondition });
    res.json({ msg: "All notifications cleared", deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Clear All Notifications Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 6. DELETE SINGLE NOTIFICATION
// ==========================================
router.delete("/:id", protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid notification ID" });
    }

    const userId = req.user.id || req.user._id;
    const userCondition = getUserCondition(userId);

    const result = await Notification.deleteOne({ _id: id, userId: userCondition });
    res.json({ msg: "Deleted", deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Delete Notification Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;
