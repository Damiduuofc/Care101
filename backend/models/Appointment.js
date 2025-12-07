import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  
  // Ensure doctorId is just a String for now (unless you have a strict Ref set up)
  doctorId: { type: String, required: true }, 
  doctorName: { type: String, required: true }, 
  
  department: { type: String, required: true },
  date: { type: Date, required: true },
  visitType: { type: String, default: 'Channeling' },
  reason: { type: String },
  
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed'], 
    default: 'Pending' 
  },
  
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Appointment", AppointmentSchema);