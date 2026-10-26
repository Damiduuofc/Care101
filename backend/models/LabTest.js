import mongoose from "mongoose";

// Lab test catalog managed by the system admin; lab requests pick tests from here
const LabTestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  code: { type: String, trim: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("LabTest", LabTestSchema);
