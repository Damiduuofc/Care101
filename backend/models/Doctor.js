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
  slmcCertificateUrl: { type: String }, 
  
  profileImage: { type: String, default: "" }, 

  createdAt: { type: Date, default: Date.now },

  // --- Subscription Fields ---
  subscription: {
    plan: { type: String, enum: ['free', 'premium'], default: 'free' },
    startDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
    endDate: { type: Date }, 
    autoRenew: { type: Boolean, default: true } 
  },
});

export default mongoose.model("Doctor", DoctorSchema);