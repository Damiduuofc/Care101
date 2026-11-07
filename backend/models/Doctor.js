import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema({
  // --- Auth Details ---
  name: { type: String, required: true }, // Mapped from 'fullName'
  hospital: { type: String, default: "SUWASEWANA HOSPITAL" },
  fullName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // load with "+password"

  // --- Admin Approval ---
  isApproved: { type: Boolean, default: false },

  // --- Personal & Professional Details ---
  specialization: { type: String, default: 'General Practitioner' },
  nameWithInitials: { type: String },
  nic: { type: String },
  phone: { type: String },
  slmcReg: { type: String, unique: true },

  profileImage: { type: String, default: "" },

  // --- Receptionist Dashboard Daily Status ---
  isArrived: { type: Boolean, default: false },
  lastArrivalDate: { type: Date },
  allocatedRoom: { type: String, default: "" },
  allocatedNurse: { type: String, default: "" },
  channelingTime: { type: String, default: "" },
  channelingStatus: { type: String, default: "On Time" },

  // --- Nurse Dashboard Current Session Info ---
  sessionStarted: { type: Boolean, default: false },
  sessionEndedToday: { type: Boolean, default: false },
  // The schedule (session) the running queue belongs to, so a doctor with several sessions
  // in one day keeps the right room/nurse while a session runs past its end time
  activeScheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleRequest", default: null },
  currentQueueNumber: { type: Number, default: 0 },
  averageConsultationDuration: { type: Number, default: 10 },
  // Doctor's channeling fee in LKR (hospital fee is added on top); falls back to DEFAULT_DOCTOR_FEE
  channelingFee: { type: Number },

  createdAt: { type: Date, default: Date.now },
  resetPasswordOtp: { type: String, select: false },
  resetPasswordExpire: { type: Date, select: false },
  resetPasswordAttempts: { type: Number, default: 0, select: false }

});

// Indexes for the dashboard / list queries
DoctorSchema.index({ allocatedNurse: 1 });
DoctorSchema.index({ createdAt: -1 });
DoctorSchema.index({ isApproved: 1 });

export default mongoose.model("Doctor", DoctorSchema);
