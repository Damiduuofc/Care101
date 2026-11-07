import ScheduleRequest from "../models/ScheduleRequest.js";
import Doctor from "../models/Doctor.js";
import { dayRange } from "./queueToken.js";
import { isArrivedToday, isSessionLive } from "./doctorSession.js";
import { emitDoctorStatus } from "./realtime.js";

// A doctor's live room/nurse (Doctor.allocatedRoom / allocatedNurse) is what the nurse queue
// screens match on. It must always mirror ONE of the doctor's sessions today: the session in
// progress, or the next one to run. Every place that changes a session or the live allocation
// goes through here, so a doctor with several sessions in a day (same or different nurses) never
// ends up showing another session's nurse, or no nurse at all.

const sameId = (a, b) => Boolean(a && b) && String(a) === String(b);

// Today's approved sessions for a doctor that have not been ended yet, earliest first.
export const openSessionsToday = (doctorId, now = new Date()) =>
  ScheduleRequest.find({
    doctorId,
    status: "approved",
    sessionEnded: { $ne: true },
    date: dayRange(now)
  }).sort({ startTime: 1 });

/**
 * The session a doctor's live room/nurse belongs to, out of today's open sessions (earliest first):
 * 1. While the queue is live: the session that was started (it may run past its end time).
 * 2. Otherwise: the first session whose time has not passed yet (in progress or next).
 * 3. Otherwise, if the doctor is checked in: the earliest open session (late start).
 * null when nothing applies, i.e. the doctor's live room/nurse should be released.
 */
export const pickCurrentSession = (open, doctor, now = new Date()) => {
  if (!open?.length) return null;
  if (isSessionLive(doctor, now)) {
    return open.find((s) => sameId(s._id, doctor.activeScheduleId)) || open[0];
  }
  return (
    open.find((s) => new Date(s.endTime) > now) ||
    (isArrivedToday(doctor, now) ? open[0] : null)
  );
};

/**
 * Applies the picked session's room/nurse to an in-memory doctor document. Returns true when
 * something changed. A live session with no open schedule keeps what it has.
 */
export const applyLiveAllocation = (doctor, open, now = new Date()) => {
  const session = pickCurrentSession(open, doctor, now);
  let room;
  let nurse;
  if (session) {
    room = session.allocatedRoom || "";
    nurse = session.allocatedNurse || "";
  } else if (isSessionLive(doctor, now) && !doctor.sessionEndedToday) {
    return false;
  } else {
    room = "";
    nurse = "";
  }
  let changed = false;
  if ((doctor.allocatedRoom || "") !== room) { doctor.allocatedRoom = room; changed = true; }
  if ((doctor.allocatedNurse || "") !== nurse) { doctor.allocatedNurse = nurse; changed = true; }
  return changed;
};

/**
 * Re-derives one doctor's live room/nurse from today's sessions and saves it.
 * Call after any change to a schedule's status, time or allocation.
 */
export const syncDoctorLiveAllocation = async (doctorId, io) => {
  if (!doctorId) return null;
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return null;
  const open = await openSessionsToday(doctor._id);
  if (open.length && doctor.sessionEndedToday) doctor.sessionEndedToday = false;
  if (applyLiveAllocation(doctor, open) || doctor.isModified()) {
    await doctor.save();
    emitDoctorStatus(io, doctor);
  }
  return doctor;
};
