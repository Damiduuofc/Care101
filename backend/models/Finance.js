import mongoose from "mongoose";

const RecordSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  
  // For Channeling
  patients: { type: Number },
  income: { type: Number },

  // For Surgical
  bht: { type: String },
  amount: { type: Number },

  type: { type: String, enum: ['channeling', 'surgical'], required: true }
});

const HospitalSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  name: { type: String, required: true },
  whtEnabled: { type: Boolean, default: false },
  records: [RecordSchema], // Nested records
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("HospitalFinance", HospitalSchema);