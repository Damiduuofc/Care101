import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema({
  // ... existing fields (fullName, email, nic, etc) ...
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  nicNumber: { type: String },
  mobileNumber: { type: String },
  dateOfBirth: { type: String },
  gender: { type: String },
  
  
  emergencyContact: { type: String },
  medicalConditions: { type: String, default: "" },
  allergies: { type: String, default: "" },
  insuranceProvider: { type: String, default: "" },
  policyNumber: { type: String, default: "" },
  profileImage: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Patient", PatientSchema);