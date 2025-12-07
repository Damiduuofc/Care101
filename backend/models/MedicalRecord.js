import mongoose from "mongoose";

const MedicalRecordSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  
  type: { 
    type: String, 
    enum: ['consultations', 'prescriptions', 'lab_tests', 'reports'], 
    required: true 
  },
  
  title: { type: String, required: true },
  doctorName: { type: String, default: "Self Uploaded" },
  date: { type: Date, required: true },
  
  description: { type: String },
  diagnosis: { type: String },
  medications: { type: String }, // For prescriptions
  
  // We store the file (PDF/Image) as a text string
  fileData: { type: String }, 
  fileType: { type: String }, // e.g., "application/pdf" or "image/png"

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("MedicalRecord", MedicalRecordSchema);