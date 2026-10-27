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
  // "YYYY-MM-DD" in the hospital time zone; set with the queue token
  dayKey: { type: String },

  // The approved doctor session this booking belongs to
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleRequest" },

  // Unpaid bookings keep their place until this time, then they are released
  holdExpiresAt: { type: Date },

  status: {
    type: String,
    enum: ["pending", "confirmed", "scheduled", "completed", "cancelled"],
    default: "pending"
  },

  amount: { type: Number, default: 0 },

  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending"
  },

  arrived: { type: Boolean, default: false },

  cancelledAt: { type: Date },
  cancelReason: { type: String },

  createdAt: { type: Date, default: Date.now }
});

AppointmentSchema.index({ patientId: 1, date: -1 });
AppointmentSchema.index({ doctorId: 1, date: 1, status: 1 });
AppointmentSchema.index({ scheduleId: 1, status: 1 });
AppointmentSchema.index({ paymentStatus: 1, status: 1, holdExpiresAt: 1 });
// A queue token is never handed out twice for the same doctor and day
AppointmentSchema.index(
  { doctorId: 1, dayKey: 1, queueNumber: 1 },
  { unique: true, partialFilterExpression: { dayKey: { $exists: true }, queueNumber: { $gt: 0 } } }
);

export default mongoose.model("Appointment", AppointmentSchema);
