import Appointment from "../models/Appointment.js";

// Queue tokens are only issued once an appointment is paid.
// Call this when an appointment becomes paid: it gives the appointment the next
// token after the doctor's last paid token for that day (does not save).
export const assignQueueToken = async (appointment) => {
  if (!appointment || appointment.paymentStatus !== "paid") {
    return null;
  }

  const startOfDay = new Date(appointment.date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(appointment.date);
  endOfDay.setHours(23, 59, 59, 999);

  const lastTokenAppt = await Appointment.findOne({
    _id: { $ne: appointment._id },
    doctorId: appointment.doctorId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "cancelled" },
    paymentStatus: "paid",
    queueNumber: { $gt: 0 }
  }).sort({ queueNumber: -1 });

  appointment.queueNumber = (lastTokenAppt?.queueNumber || 0) + 1;
  return appointment.queueNumber;
};
