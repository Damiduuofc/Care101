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
  patientId: { type: String, required: true },
  hospital: { type: String },
  
  // The main surgery card (optional when created via OPD consultation / nurse record book update)
  surgeryCardImage: { type: String, default: "" }, 
  
  // ✅ THIS IS MISSING IN YOUR FILE:
  entries: [EntrySchema], 
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

SurgeryRecordSchema.index({ doctorId: 1, updatedAt: -1, createdAt: -1 });
SurgeryRecordSchema.index({ patientId: 1, updatedAt: -1 });
SurgeryRecordSchema.index({ nic: 1 });

export default mongoose.model("SurgeryRecord", SurgeryRecordSchema);