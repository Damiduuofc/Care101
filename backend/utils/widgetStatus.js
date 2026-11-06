import Appointment from "../models/Appointment.js";
import ScheduleRequest from "../models/ScheduleRequest.js";
import { countPaidAhead } from "./queueToken.js";
import { isArrivedToday, isSessionLive } from "./doctorSession.js";
import { isAppointmentFinished } from "./bookingService.js";

// The payload the home screen widgets (Android + iOS) and the iOS Live Activity render.
// Shared by GET /appointments/widget-status and the iOS push sender.
export const buildWidgetStatus = async (patientId) => {
  const formatDoctorName = (raw) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed.toLowerCase() === "null") return "Doctor";
    const withoutPrefix = trimmed.replace(/^dr\.?\s*/i, "").trim();
    if (!withoutPrefix || withoutPrefix.toLowerCase() === "doctor") return "Doctor";
    return `Dr. ${withoutPrefix}`;
  };

  if (!patientId) {
    return ({ state: "empty", message: "Patient not identified" });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const upcomingStatuses = ["confirmed", "Confirmed", "pending", "Pending", "scheduled", "Scheduled"];

  // 1. Look for today's active/upcoming appointment. A patient can have several today
  // (e.g. one completed, one later); prefer one that isn't completed so the widget
  // doesn't flip between "completed" and "queue" depending on Mongo's natural order.
  const todayAppts = await Appointment.find({
    patientId,
    date: { $gte: startOfToday, $lte: endOfToday },
    status: { $nin: ["cancelled", "Cancelled"] }
  }).sort({ date: 1, queueNumber: 1 }).populate("doctorId");
  // Prefer a booking that is still ahead; if all of today's are finished, show the
  // "completed" state with the patient's next booking.
  let activeToday = null;
  for (const appt of todayAppts) {
    if (!(await isAppointmentFinished(appt))) { activeToday = appt; break; }
  }
  const todayAppt = activeToday || todayAppts[0] || null;

  if (todayAppt) {
    const doc = todayAppt.doctorId;
    const doctorId = doc && doc._id ? doc._id.toString() : null;
    let room = (doc && doc.allocatedRoom) ? doc.allocatedRoom : "";
    let scheduledTime = (doc && doc.channelingTime) ? doc.channelingTime : "";
    
    // If room or time not set on doctor model, check approved schedule
    if ((!room || !scheduledTime) && doc && doc._id) {
      try {
        const schedule = await ScheduleRequest.findOne({
          doctorId: doc._id,
          status: "approved",
          date: { $gte: startOfToday, $lte: endOfToday }
        });
        if (schedule) {
          if (!room && schedule.allocatedRoom) {
            room = schedule.allocatedRoom;
          }
          if (!scheduledTime && schedule.startTime) {
            scheduledTime = new Date(schedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
        }
      } catch (scheduleErr) {
        console.error("Schedule room lookup error:", scheduleErr);
      }
    }
    if (!room) room = "Room TBA";
    if (!scheduledTime) scheduledTime = "Scheduled Today";

    const hospitalName = (doc && doc.hospital) ? doc.hospital : "SUWASEWANA HOSPITAL";
    const rawDoctorName = (doc && (doc.fullName || doc.name)) ? (doc.fullName || doc.name) : todayAppt.doctorName;
    const doctorName = formatDoctorName(rawDoctorName);
    const awaitingPayment = todayAppt.paymentStatus !== "paid";
    const myToken = todayAppt.queueNumber || "--";
    const ongoingToken = (doc && doc.currentQueueNumber) ? doc.currentQueueNumber : 0;
    const isArrived = isArrivedToday(doc);
    const isSessionStarted = isSessionLive(doc);
    const isSessionEnded = !activeToday;
    const channelingStatus = (doc && doc.channelingStatus) ? doc.channelingStatus : "On Time";
    const isDelayed = channelingStatus.toLowerCase() !== "on time" && !isArrived;
    const delayMessage = isArrived
      ? `Doctor Arrived • Ready in ${room}`
      : isDelayed
        ? `Doctor Delayed: ${channelingStatus}`
        : "Doctor On Time";

    // Case 1: Session has ended / completed
    if (isSessionEnded) {
      const nextAppt = await Appointment.findOne({
        patientId,
        date: { $gt: endOfToday },
        status: { $in: upcomingStatuses }
      }).sort({ date: 1 }).populate("doctorId");

      if (nextAppt) {
        const nextDoc = nextAppt.doctorId;
        let nextRoom = (nextDoc && nextDoc.allocatedRoom) ? nextDoc.allocatedRoom : "Room TBA";
        const rawNextDocName = (nextDoc && (nextDoc.fullName || nextDoc.name)) ? (nextDoc.fullName || nextDoc.name) : nextAppt.doctorName;
        return ({
          state: "completed",
          hasUpcoming: true,
          completedDoctor: doctorName,
          nextDoctorName: formatDoctorName(rawNextDocName),
          nextHospitalName: (nextDoc && nextDoc.hospital) ? nextDoc.hospital : "SUWASEWANA HOSPITAL",
          nextRoom,
          nextToken: nextAppt.queueNumber || "--",
          nextAwaitingPayment: nextAppt.paymentStatus !== "paid",
          nextDate: new Date(nextAppt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })
        });
      } else {
        // No further upcoming appointments -> show app logo with white background
        return ({
          state: "empty",
          message: "No upcoming appointments"
        });
      }
    }

    // Case 2: Session has started -> Real-time live queue (unpaid patients are not in the queue)
    const peopleAhead = awaitingPayment ? 0 : await countPaidAhead(todayAppt, ongoingToken);
    if (isSessionStarted && !awaitingPayment) {
      return ({
        state: "queue",
        appointmentId: String(todayAppt._id),
        doctorId,
        hospitalName,
        doctorName,
        room,
        myToken,
        ongoingToken,
        currentToken: ongoingToken,
        peopleAhead,
        sessionStarted: true,
        isArrived: true,
        isDelayed: channelingStatus.toLowerCase() !== "on time",
        delayMessage: channelingStatus.toLowerCase() !== "on time" ? `Delayed: ${channelingStatus}` : "Session in progress",
        channelingStatus,
        lastUpdated: new Date()
      });
    }

    // Case 3: Before session starts -> Upcoming appointment with doctor arrival / delay status + queue counts
    return ({
      state: "upcoming",
      appointmentId: String(todayAppt._id),
      doctorId,
      hospitalName,
      doctorName,
      room,
      myToken,
      ongoingToken,
      currentToken: ongoingToken,
      peopleAhead,
      awaitingPayment,
      sessionStarted: false,
      formattedDate: "Today",
      channelingTime: scheduledTime,
      isArrived,
      isDelayed,
      delayMessage,
      channelingStatus,
      lastUpdated: new Date()
    });
  }

  // 2. No appointment today -> check for future upcoming appointments
  const futureAppt = await Appointment.findOne({
    patientId,
    date: { $gt: endOfToday },
    status: { $in: upcomingStatuses }
  }).sort({ date: 1 }).populate("doctorId");

  if (futureAppt) {
    const doc = futureAppt.doctorId;
    const doctorId = doc && doc._id ? doc._id.toString() : null;
    const hospitalName = (doc && doc.hospital) ? doc.hospital : "SUWASEWANA HOSPITAL";
    const rawFutureDocName = (doc && (doc.fullName || doc.name)) ? (doc.fullName || doc.name) : futureAppt.doctorName;
    const doctorName = formatDoctorName(rawFutureDocName);
    const room = (doc && doc.allocatedRoom) ? doc.allocatedRoom : "Room TBA";
    const isArrived = false;
    const channelingStatus = (doc && doc.channelingStatus) ? doc.channelingStatus : "On Time";
    const isDelayed = channelingStatus.toLowerCase() !== "on time";

    return ({
      state: "upcoming",
      doctorId,
      hospitalName,
      doctorName,
      room,
      myToken: futureAppt.queueNumber || "--",
      awaitingPayment: futureAppt.paymentStatus !== "paid",
      formattedDate: new Date(futureAppt.date).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" }),
      channelingTime: (doc && doc.channelingTime) ? doc.channelingTime : "Scheduled",
      isArrived,
      isDelayed,
      delayMessage: isDelayed ? `Doctor Delayed: ${channelingStatus}` : "Doctor On Time",
      channelingStatus,
      lastUpdated: new Date()
    });
  }

  // 3. No upcoming appointments -> Empty state
  return ({
    state: "empty",
    message: "No upcoming appointments"
  });

};
