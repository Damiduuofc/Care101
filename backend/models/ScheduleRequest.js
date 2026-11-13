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
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  // 'hospital_contact' = sent while the doctor's department was fully booked;
  // reception assigns any free room (any department) and nurse by hand
  requestType: { type: String, enum: ['normal', 'hospital_contact'], default: 'normal' },
  note: { type: String, default: "", maxlength: 500 },
  allocatedRoom: { type: String, default: "" },
  allocatedNurse: { type: String, default: "" },
  sessionEnded: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

ScheduleRequestSchema.index({ doctorId: 1, status: 1, date: 1 });
ScheduleRequestSchema.index({ status: 1, date: 1 });
ScheduleRequestSchema.index({ createdAt: -1 });

export default mongoose.model('ScheduleRequest', ScheduleRequestSchema);
