import mongoose from "mongoose";

const InstructionSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  surgeryName: { type: String, required: true },
  description: { type: String },
  
  // Store file URIs (or Cloudinary URLs in production)
  preOp: {
    video: { type: String, default: null },
    audio: { type: String, default: null },
    document: { type: String, default: null }
  },
  postOp: {
    video: { type: String, default: null },
    audio: { type: String, default: null },
    document: { type: String, default: null }
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Instruction", InstructionSchema);