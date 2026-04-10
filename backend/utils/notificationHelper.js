import Notification from "../models/Notification.js";

/**
 * Centralized Notification Creator
 * Standardized to handle 'data' or 'metadata' interchangeably
 */
export const createNotification = async (userId, type, message, data = {}, title = null) => {
    try {
        const notification = new Notification({
            userId,
            type,
            message,
            metadata: data, // ✅ Fixed: Store in 'metadata' field matching schema
            title: title || "Care101 Update",
            read: false,
            timestamp: new Date()
        });

        await notification.save();
        console.log(`✅ Notification created for user ${userId}: ${type}`);
        return notification;
    } catch (error) {
        console.error("❌ Notification creation failed:", error.message);
        return null;
    }
};

/**
 * Create multiple notifications at once
 */
export const createBulkNotifications = async (notifications) => {
    try {
        const result = await Notification.insertMany(notifications);
        console.log(`✅ ${result.length} notifications created`);
        return result;
    } catch (error) {
        console.error("❌ Bulk notification creation failed:", error.message);
        return [];
    }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (notificationId, userId) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { $set: { read: true } },
            { new: true }
        );
        if (!notification) return { success: false, message: "Notification not found" };
        return { success: true, message: "Marked as read" };
    } catch (error) {
        return { success: false, message: "Server error" };
    }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
    try {
        await Notification.updateMany({ userId, read: false }, { read: true });
        return { success: true, message: "All notifications marked as read" };
    } catch (error) {
        return { success: false, message: "Server error" };
    }
};

/**
 * Get unread count
 */
export const getUnreadCount = async (userId) => {
    try {
        return await Notification.countDocuments({ userId, read: false });
    } catch (error) {
        return 0;
    }
};