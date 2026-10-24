import mongoose from "mongoose";

const InstructionShareSchema = new mongoose.Schema({
  instruction: { type: mongoose.Schema.Types.ObjectId, ref: "Instruction", required: true },
  section: { type: String, enum: ["preOp", "postOp", "both"], required: true },
  // Set when a nurse shares instructions with a specific patient
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", default: null },
  sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  medicalRecord: { type: mongoose.Schema.Types.ObjectId, ref: "MedicalRecord", default: null },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("InstructionShare", InstructionShareSchema);
