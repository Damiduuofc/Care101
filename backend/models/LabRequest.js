import mongoose from "mongoose";

const LabRequestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  doctorName: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  type: { type: String, enum: ['lab_tests', 'prescriptions', 'reports', 'consultations'], default: 'lab_tests' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: "MedicalRecord" },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("LabRequest", LabRequestSchema);
