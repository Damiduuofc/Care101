import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  doctorName: { type: String, required: true }, 
  
  department: { type: String, required: true },
  date: { type: Date, required: true },
  visitType: { type: String, default: 'Channeling' },
  reason: { type: String },
  
  status: { 
    type: String, 
    enum: ["pending", "confirmed", "completed", "cancelled"], 
    default: "pending" 
  },
  
  // ✅ Removed the extra "}," that was here
  
  amount: { type: Number, default: 0 }, // Fee for the appointment
  
  paymentStatus: { 
    type: String, 
    enum: ["pending", "paid"], 
    default: "pending" 
  },
  
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Appointment", AppointmentSchema);