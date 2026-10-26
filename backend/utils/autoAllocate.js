import ScheduleRequest from '../models/ScheduleRequest.js';
import Admin from '../models/Admin.js';

// Keep in sync with ROOM_DEPARTMENTS in the admin frontend
export const ROOM_DEPARTMENTS = {
  "Room 1": "Cardiology",
  "Room 2": "Cardiology",
  "Room 3": "Cardiology",
  "Room 4": "Pediatrics",
  "Room 5": "Pediatrics",
  "Room 6": "Pediatrics",
  "Room 7": "Dermatology",
  "Room 8": "Dermatology",
  "Room 9": "Dermatology",
  "Room 10": "Orthopedics",
  "Room 11": "Orthopedics",
  "Room 12": "Orthopedics",
  "Room 13": "General Medicine",
  "Room 14": "General Medicine",
  "Room 15": "General Medicine",
  "Room 16": "General Medicine",
  "Room 17": "General Medicine",
  "Room 18": "General Medicine",
  "Room 19": "General Medicine",
  "Room 20": "General Medicine"
};

export const getDoctorDept = (specialization) => {
  const spec = (specialization || "").toLowerCase();
  if (spec.includes("cardio")) return "Cardiology";
  if (spec.includes("pedia") || spec.includes("child")) return "Pediatrics";
  if (spec.includes("derma") || spec.includes("skin")) return "Dermatology";
  if (spec.includes("ortho") || spec.includes("bone")) return "Orthopedics";
  return "General Medicine";
};

/**
 * Picks a free room (department rooms first, then any other room) and the
 * least-busy free nurse for the request's time slot. Either value is "" when
 * nothing is available.
 */
export const findAutoAllocation = async (request, specialization) => {
  const startOfDay = new Date(request.startTime);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(request.startTime);
  endOfDay.setHours(23, 59, 59, 999);

  // Match sessions by their actual times, not the stored "date" field, so every
  // overlapping session is seen regardless of how its date was saved
  const sameDaySessions = await ScheduleRequest.find({
    _id: { $ne: request._id },
    status: 'approved',
    sessionEnded: { $ne: true },
    startTime: { $lt: endOfDay },
    endTime: { $gt: startOfDay }
  }).select('allocatedRoom allocatedNurse startTime endTime');

  const overlapping = sameDaySessions.filter(s =>
    new Date(s.startTime) < new Date(request.endTime) &&
    new Date(s.endTime) > new Date(request.startTime)
  );
  const busyRooms = new Set(overlapping.map(s => s.allocatedRoom).filter(Boolean));
  const busyNurses = new Set(overlapping.map(s => s.allocatedNurse).filter(Boolean));

  const dept = getDoctorDept(specialization);
  const allRooms = Object.keys(ROOM_DEPARTMENTS);
  const roomOrder = [
    ...allRooms.filter(r => ROOM_DEPARTMENTS[r] === dept),
    ...allRooms.filter(r => ROOM_DEPARTMENTS[r] !== dept)
  ];
  const room = roomOrder.find(r => !busyRooms.has(r)) || "";

  // Spread work evenly: prefer the free nurse with the fewest sessions that day
  const nurses = await Admin.find({ role: 'nurse' }).select('name');
  const dayLoad = {};
  sameDaySessions.forEach(s => {
    if (s.allocatedNurse) dayLoad[s.allocatedNurse] = (dayLoad[s.allocatedNurse] || 0) + 1;
  });
  const freeNurses = nurses
    .map(n => n.name)
    .filter(name => name && !busyNurses.has(name))
    .sort((a, b) => (dayLoad[a] || 0) - (dayLoad[b] || 0));

  return { room, nurse: freeNurses[0] || "" };
};
