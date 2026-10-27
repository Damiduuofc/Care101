// Socket.IO rooms. Patient data is only sent to the people allowed to see it:
// the patient, their doctor, and hospital staff.
export const STAFF_ROOM = "staff";
export const userRoom = (id) => `user:${id}`;

const idOf = (value) => (value?._id || value ? String(value?._id || value) : "");

// Called once per connection: every client joins its own room, staff also join the staff room.
export const joinDefaultRooms = (socket) => {
  const { id, role } = socket.user || {};
  if (id) socket.join(userRoom(id));
  if (role && role !== "patient" && role !== "doctor") socket.join(STAFF_ROOM);
};

export const emitNotification = (io, notif) => {
  const userId = idOf(notif?.userId);
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit("newNotification", notif);
};

export const emitAppointmentUpdated = (io, appointment) => {
  if (!io || !appointment) return;
  let target = io.to(STAFF_ROOM);
  const patientId = idOf(appointment.patientId);
  const doctorId = idOf(appointment.doctorId);
  if (patientId) target = target.to(userRoom(patientId));
  if (doctorId) target = target.to(userRoom(doctorId));
  target.emit("appointmentUpdated", appointment);
};
