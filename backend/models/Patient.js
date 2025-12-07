import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  dateOfBirth: { type: Date },
  gender: { type: String },
  nicNumber: { type: String, required: true }, // Can be used as login ID too
  
  mobileNumber: { type: String },
  email: { type: String, required: true, unique: true },
  district: { type: String },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Patient", PatientSchema);