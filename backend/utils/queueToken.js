import Appointment from "../models/Appointment.js";
import QueueCounter from "../models/QueueCounter.js";

export const dayRange = (date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return { $gte: startOfDay, $lte: endOfDay };
};

const pad = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DD" for a date in the hospital time zone (see config/timezone.js)
export const toDayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Every booking gets a queue token, paid or not (unpaid ones are kept out of the
// live queue until they pay). Gives the appointment the next token for that doctor and day,
// or keeps the one it already has (does not save). Tokens come from an atomic counter,
// so simultaneous bookings never share a number; cancelled tokens are not reused.
export const assignQueueToken = async (appointment) => {
  if (!appointment) return null;
  if (appointment.queueNumber > 0) return appointment.queueNumber;

  const dayKey = toDayKey(appointment.date);
  const counterId = `${appointment.doctorId?._id || appointment.doctorId}:${dayKey}`;

  // Start the counter above any token issued before counters existed
  const lastTokenAppt = await Appointment.findOne({
    _id: { $ne: appointment._id },
    doctorId: appointment.doctorId,
    date: dayRange(appointment.date),
    queueNumber: { $gt: 0 }
  }).sort({ queueNumber: -1 }).select("queueNumber").lean();
  await QueueCounter.updateOne(
    { _id: counterId },
    { $max: { seq: lastTokenAppt?.queueNumber || 0 } },
    { upsert: true }
  );

  const counter = await QueueCounter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  appointment.queueNumber = counter.seq;
  appointment.dayKey = dayKey;
  return appointment.queueNumber;
};

// Token the next booking for this doctor and day would get (display only)
export const peekNextToken = async (doctorId, date) => {
  const counter = await QueueCounter.findById(`${doctorId}:${toDayKey(date)}`).lean();
  const lastTokenAppt = await Appointment.findOne({
    doctorId,
    date: dayRange(date),
    queueNumber: { $gt: 0 }
  }).sort({ queueNumber: -1 }).select("queueNumber").lean();
  return Math.max(counter?.seq || 0, lastTokenAppt?.queueNumber || 0) + 1;
};

// Patients ahead of this appointment in the live queue: only paid tokens from the
// one being served now up to (not including) this one.
export const countPaidAhead = async (appointment, currentServing) => {
  if (!appointment?.queueNumber) return 0;
  return Appointment.countDocuments({
    _id: { $ne: appointment._id },
    doctorId: appointment.doctorId?._id || appointment.doctorId,
    date: dayRange(appointment.date),
    status: { $nin: ["cancelled", "completed"] },
    paymentStatus: "paid",
    queueNumber: { $gte: Math.max(1, currentServing || 0), $lt: appointment.queueNumber }
  });
};

// First paid token for a doctor today, so a session starts on a patient who is in the queue.
// With a sessionId, only that session's bookings count (older bookings without a session are included).
export const firstPaidToken = async (doctorId, sessionId = null) => {
  const first = await Appointment.findOne({
    doctorId,
    date: dayRange(new Date()),
    status: { $nin: ["cancelled", "completed"] },
    paymentStatus: "paid",
    queueNumber: { $gt: 0 },
    ...(sessionId ? { $or: [{ scheduleId: sessionId }, { scheduleId: { $exists: false } }] } : {})
  }).sort({ queueNumber: 1 });
  return first?.queueNumber || 1;
};
