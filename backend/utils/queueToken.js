import Appointment from "../models/Appointment.js";

const dayRange = (date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return { $gte: startOfDay, $lte: endOfDay };
};

// Every booking gets a queue token, paid or not (unpaid ones are kept out of the
// live queue until they pay). Gives the appointment the next token after the
// doctor's last token for that day, or keeps the one it already has (does not save).
export const assignQueueToken = async (appointment) => {
  if (!appointment) return null;
  if (appointment.queueNumber > 0) return appointment.queueNumber;

  const lastTokenAppt = await Appointment.findOne({
    _id: { $ne: appointment._id },
    doctorId: appointment.doctorId,
    date: dayRange(appointment.date),
    status: { $ne: "cancelled" },
    queueNumber: { $gt: 0 }
  }).sort({ queueNumber: -1 });

  appointment.queueNumber = (lastTokenAppt?.queueNumber || 0) + 1;
  return appointment.queueNumber;
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
export const firstPaidToken = async (doctorId) => {
  const first = await Appointment.findOne({
    doctorId,
    date: dayRange(new Date()),
    status: { $nin: ["cancelled", "completed"] },
    paymentStatus: "paid",
    queueNumber: { $gt: 0 }
  }).sort({ queueNumber: 1 });
  return first?.queueNumber || 1;
};
