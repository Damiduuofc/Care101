import mongoose from 'mongoose';

const ScheduleRequestSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  doctorName: { type: String, required: true },
  
  date: { type: Date, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  
  isUnlimited: { type: Boolean, default: false },
  queueLimit: { type: Number }, // Only used if isUnlimited is false
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  createdAt: { type: Date, default: Date.now },
  
  // Allocation Details (set on approval)
  allocatedRoom: { type: String, default: "" },
  allocatedNurse: { type: String, default: "" }
});

export default mongoose.model('ScheduleRequest', ScheduleRequestSchema);
