import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true,
    trim: true 
  },
  
  // --- UNIQUE FIELDS ---
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  nicNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },

  password: { 
    type: String, 
    required: true 
  },

  // --- DEMOGRAPHICS ---
  mobileNumber: { 
    type: String, 
    required: true 
  },
  dateOfBirth: { 
    type: Date, // Better to store as Date object (frontend sends ISO string)
    required: true 
  },
  gender: { 
    type: String, 
    enum: ["Male", "Female", "Other"],
    required: true 
  },
  district: { 
    type: String, 
    required: true 
  },

  // --- OPTIONAL MEDICAL DATA ---
  emergencyContact: { type: String, default: "" },
  medicalConditions: { type: String, default: "" },
  allergies: { type: String, default: "" },
  insuranceProvider: { type: String, default: "" },
  policyNumber: { type: String, default: "" },
  profileImage: { type: String, default: "" },
  
  isRegistered: {
    type: Boolean,
    default: true
  },

  role: { 
    type: String, 
    default: "patient" 
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

export default mongoose.model("Patient", PatientSchema);
