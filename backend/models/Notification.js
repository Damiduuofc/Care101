import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  type: { 
    type: String, 
    enum: ['appointment', 'report', 'payment', 'message', 'reminder'], 
    required: true 
  },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Notification", NotificationSchema);