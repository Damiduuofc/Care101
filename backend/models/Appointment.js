import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },

  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  doctorName: { type: String, required: true },

  department: { type: String, required: true },
  date: { type: Date, required: true },
  visitType: { type: String, default: 'Channeling' },
  reason: { type: String },


  queueNumber: { type: Number },

  status: {
    type: String,
    enum: ["pending", "confirmed", "scheduled", "completed", "cancelled"],
    default: "pending"
  },

  amount: { type: Number, default: 0 },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed"],
    default: "pending"
  },

  arrived: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Appointment", AppointmentSchema);
