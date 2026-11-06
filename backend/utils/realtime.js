import { sendAlertToUser, pushPatientUpdate, pushDoctorQueueUpdate } from "./iosPush.js";

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
  // iPhones: the socket is gone once the app is backgrounded, so also send it through APNs
  sendAlertToUser(userId, notif);
};

export const emitAppointmentUpdated = (io, appointment) => {
  if (!io || !appointment) return;
  let target = io.to(STAFF_ROOM);
  const patientId = idOf(appointment.patientId);
  const doctorId = idOf(appointment.doctorId);
  if (patientId) target = target.to(userRoom(patientId));
  if (doctorId) target = target.to(userRoom(doctorId));
  target.emit("appointmentUpdated", appointment);
  if (patientId) pushPatientUpdate(patientId);
};

// Only these doctor fields are ever broadcast. doctorStatusUpdated goes to EVERY connected
// client (patients included), so never send the raw document: it holds the email, NIC,
// phone and other private details.
const PUBLIC_DOCTOR_FIELDS = [
  "_id", "name", "fullName", "nameWithInitials", "specialization", "hospital",
  "isArrived", "lastArrivalDate", "allocatedRoom", "allocatedNurse",
  "channelingTime", "channelingStatus", "sessionStarted", "sessionEndedToday",
  "currentQueueNumber", "averageConsultationDuration",
];
export const publicDoctor = (doctor) => {
  if (!doctor) return doctor;
  const src = typeof doctor.toObject === "function" ? doctor.toObject() : doctor;
  const out = {};
  for (const key of PUBLIC_DOCTOR_FIELDS) if (src[key] !== undefined) out[key] = src[key];
  return out;
};
export const emitDoctorStatus = (io, doctor) => {
  if (io && doctor) io.emit("doctorStatusUpdated", publicDoctor(doctor));
};

// A doctor's arrival / delay / session / current token changed: refresh the iOS Live
// Activities and widgets of everyone booked with them today.
export const emitDoctorQueueChanged = (doctorId) => pushDoctorQueueUpdate(doctorId);

// Generic "something changed" hint for open dashboards. It carries no data, so it is safe
// to broadcast to everyone; each dashboard refetches what it is allowed to see.
// Bursts (e.g. a request that saves several documents) collapse into one signal.
let dashboardSignalTimer = null;
export const signalDashboards = (io) => {
  if (!io || dashboardSignalTimer) return;
  dashboardSignalTimer = setTimeout(() => {
    dashboardSignalTimer = null;
    io.emit("dashboardUpdated");
  }, 400);
};

// Time of the last successful write anywhere in the API, so read-side caches know when to refresh
let lastWriteAt = Date.now();
export const getLastWriteAt = () => lastWriteAt;

// Express middleware: every successful write (POST/PUT/PATCH/DELETE) refreshes dashboards,
// so stats stay live even for routes that don't emit their own socket event.
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const QUIET_PATHS = ["/api/push", "/api/notifications"];
export const dashboardSignalMiddleware = (io) => (req, res, next) => {
  if (!READ_METHODS.has(req.method) && !QUIET_PATHS.some((p) => req.originalUrl.startsWith(p))) {
    res.on("finish", () => {
      if (res.statusCode < 400) {
        lastWriteAt = Date.now();
        signalDashboards(io);
      }
    });
  }
  next();
};
