import mongoose from "mongoose";

const InstructionShareSchema = new mongoose.Schema({
  instruction: { type: mongoose.Schema.Types.ObjectId, ref: "Instruction", required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("InstructionShare", InstructionShareSchema);
