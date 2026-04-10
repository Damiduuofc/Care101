import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Patient" },
  type: {
    type: String,
    enum: [
      'appointment',      
      'cancellation',     
      'reschedule',       
      'payment',          
      'prescription',     
      'lab_report',       
      'report',           
      'message',          
      'reminder',         
      'schedule_request', 
      'arrival',         
      'doctor_status',    
      'system'            
    ],
    required: true
  },
  title: { type: String }, // Optional title
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }, 
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Notification", NotificationSchema);