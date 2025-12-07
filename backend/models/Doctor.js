import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema({
  // Basic Auth
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // Doctor Specific Details
  specialization: { type: String, default: 'General Practitioner' },
  nameWithInitials: { type: String },
  nic: { type: String },
  phone: { type: String },
  slmcReg: { type: String },
  hospital: { type: String, default: 'Private Practice' },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Doctor", DoctorSchema);