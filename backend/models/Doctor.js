import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema({
  // --- Auth Details ---
  name: { type: String, required: true }, // Mapped from 'fullName'
  hospital: { type: String, default: "SUWASEWANA HOSPITAL" },
  fullName: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

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
  allocatedRoom: { type: String, default: "" },
  allocatedNurse: { type: String, default: "" },
  channelingTime: { type: String, default: "" },
  channelingStatus: { type: String, default: "On Time" },

  // --- Nurse Dashboard Current Session Info ---
  sessionStarted: { type: Boolean, default: false },
  currentQueueNumber: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  resetPasswordOtp: { type: String },
  resetPasswordExpire: { type: Date }

});

export default mongoose.model("Doctor", DoctorSchema);