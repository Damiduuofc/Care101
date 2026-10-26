import mongoose from "mongoose";

const LabRequestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  doctorName: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  // Tests picked from the lab test catalog, with the price copied at request time
  tests: [{
    testId: { type: mongoose.Schema.Types.ObjectId, ref: "LabTest" },
    name: { type: String, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, default: 0 },
  type: { type: String, enum: ['lab_tests', 'prescriptions', 'reports', 'consultations'], default: 'lab_tests' },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: "MedicalRecord" },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: "Bill" },
  createdAt: { type: Date, default: Date.now }
});

LabRequestSchema.index({ patientId: 1, createdAt: -1 });
LabRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("LabRequest", LabRequestSchema);
