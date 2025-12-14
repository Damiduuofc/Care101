import mongoose from "mongoose";

const HospitalStatusSchema = new mongoose.Schema({
  generalWard: { type: String, default: "Available" },   // e.g., "15 Beds Free"
  icuBeds: { type: Number, default: 0 },                 // e.g., 2
  emergencyUnit: { type: String, default: "Normal" },    // e.g., "Busy", "Full"
  pharmacy: { type: String, default: "Open" },           // e.g., "Open", "Closed"
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("HospitalStatus", HospitalStatusSchema);