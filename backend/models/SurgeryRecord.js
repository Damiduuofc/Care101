import mongoose from "mongoose";

// 1. Define the Sub-schema for entries (Notes + Images)
const EntrySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  notes: { type: String },
  images: [{ type: String }] // Array of Base64 image strings
});

// 2. Define the Main Schema
const SurgeryRecordSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  name: { type: String, required: true },
  nic: { type: String },
  hospital: { type: String },
  
  // The main surgery card
  surgeryCardImage: { type: String, required: true }, 
  
  // ✅ THIS IS MISSING IN YOUR FILE:
  entries: [EntrySchema], 
  
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("SurgeryRecord", SurgeryRecordSchema);