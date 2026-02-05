import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  type: {
    type: String,
    enum: [
      'appointment',      // Appointment booking
      'cancellation',     // Appointment cancelled
      'reschedule',       // Appointment rescheduled
      'payment',          // Payment confirmation
      'prescription',     // New prescription added
      'lab_report',       // Lab report available
      'report',           // General report
      'message',          // Message from doctor
      'reminder',         // Appointment reminder
      'system'            // System notification
    ],
    required: true
  },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }, // Additional data (appointmentId, recordId, etc.)
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Notification", NotificationSchema);