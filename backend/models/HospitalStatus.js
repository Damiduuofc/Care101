import mongoose from "mongoose";

const HospitalStatusSchema = new mongoose.Schema({
  generalWard: { type: String, default: "Available" },
  icuBeds: { type: Number, default: 0 },
  emergencyUnit: { type: String, default: "Normal" },
  pharmacy: { type: String, default: "Open" },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("HospitalStatus", HospitalStatusSchema);