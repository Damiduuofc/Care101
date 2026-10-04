import mongoose from "mongoose";

const ConsultationHistorySchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", required: true },
  date: { type: Date, default: Date.now },
  actualDuration: { type: Number, required: true }, // in minutes
  startHour: { type: Number, required: true },       // 0-23 for hourly patterns
  dayOfWeek: { type: Number, required: true },       // 0-6 (Sunday to Saturday)
  delayMinutes: { type: Number, default: 0 }        // Deviation from scheduled appointment slot
});

export default mongoose.model("ConsultationHistory", ConsultationHistorySchema);
