import mongoose from "mongoose";

const BillSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  
  title: { type: String, required: true }, // e.g., "Consultation - Dr. Smith" or "Surgery Fees"
  type: { 
    type: String, 
    enum: ['Appointment', 'Pharmacy', 'Surgery', 'Lab'], 
    default: 'Appointment' 
  },
  
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
  
  // Optional: Link to original appointment if needed
  appointmentId: { type: String } 
});

export default mongoose.model("Bill", BillSchema);