import mongoose from "mongoose";

const DoctorSchema = new mongoose.Schema({
  // --- Auth Details ---
  name: { type: String, required: true }, // Mapped from 'fullName'
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // --- Personal & Professional Details ---
  specialization: { type: String, default: 'General Practitioner' },
  nameWithInitials: { type: String },
  nic: { type: String },              
  phone: { type: String },       
  slmcReg: { type: String, unique: true }, 
  
  profileImage: { type: String, default: "" }, 

  createdAt: { type: Date, default: Date.now },


});

export default mongoose.model("Doctor", DoctorSchema);