import Notification from "../models/Notification.js";

/**
 * Centralized Notification Creator
 * @param {String} userId - Patient ID
 * @param {String} type - Notification type
 * @param {String} message - Notification message
 * @param {Object} metadata - Additional data (optional)
 */
export const createNotification = async (userId, type, message, metadata = {}) => {
    try {
        const notification = new Notification({
            userId,
            type,
            message,
            metadata,
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
        const notification = await Notification.findOne({ _id: notificationId, userId });
        if (!notification) {
            return { success: false, message: "Notification not found" };
        }

        notification.read = true;
        await notification.save();
        return { success: true, message: "Marked as read" };
    } catch (error) {
        console.error("❌ Mark as read failed:", error.message);
        return { success: false, message: "Server error" };
    }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
    try {
        await Notification.updateMany(
            { userId, read: false },
            { read: true }
        );
        return { success: true, message: "All notifications marked as read" };
    } catch (error) {
        console.error("❌ Mark all as read failed:", error.message);
        return { success: false, message: "Server error" };
    }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId, userId) => {
    try {
        const result = await Notification.findOneAndDelete({ _id: notificationId, userId });
        if (!result) {
            return { success: false, message: "Notification not found" };
        }
        return { success: true, message: "Notification deleted" };
    } catch (error) {
        console.error("❌ Delete notification failed:", error.message);
        return { success: false, message: "Server error" };
    }
};

/**
 * Get unread count for a user
 */
export const getUnreadCount = async (userId) => {
    try {
        const count = await Notification.countDocuments({ userId, read: false });
        return count;
    } catch (error) {
        console.error("❌ Get unread count failed:", error.message);
        return 0;
    }
};
