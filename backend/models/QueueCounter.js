import mongoose from "mongoose";

// One counter per doctor per day (_id = "<doctorId>:<YYYY-MM-DD>"), incremented atomically
// so two bookings made at the same moment can never get the same queue token.
const QueueCounterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 }
}, { versionKey: false });

export default mongoose.model("QueueCounter", QueueCounterSchema);
