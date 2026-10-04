import Doctor from "../models/Doctor.js";
import ConsultationHistory from "../models/ConsultationHistory.js";

/**
 * Calculates estimated waiting time and arrival window for a patient.
 *
 * Improvements over the previous version:
 *  - Credits elapsed time already spent on the current consultation, instead
 *    of always charging a full averageDuration for the next patient.
 *  - Anchors the estimate to the doctor's scheduled channelingTime (instead
 *    of "now") when the session hasn't started yet, so patients get a
 *    realistic arrival window even before the doctor begins seeing patients.
 *  - Reflects doctor arrival status in the confidence level.
 */
export const calculatePrediction = async (doctorId, currentServingNumber, patientQueueNumber) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new Error("Doctor not found");

  const averageDuration = doctor.averageConsultationDuration || 10;
  const patientsAhead = Math.max(0, patientQueueNumber - currentServingNumber);

  const now = new Date();
  let baseTime = now;
  let estimatedWaitingMinutes = 0;

  if (!doctor.sessionStarted) {
    // Session hasn't started yet — anchor to the scheduled channeling time
    // rather than "now", so the estimate reflects when the doctor is actually
    // expected to begin, not just patients ahead * average.
    const scheduledStart = parseChannelingTime(doctor.channelingTime, now);
    baseTime = scheduledStart && scheduledStart > now ? scheduledStart : now;
    estimatedWaitingMinutes = patientsAhead * averageDuration;
  } else {
    // Session in progress — give credit for time already spent on the
    // current patient instead of assuming a fresh averageDuration.
    const elapsedOnCurrent = doctor.consultationStartTime
      ? Math.max(0, (now.getTime() - doctor.consultationStartTime.getTime()) / 60000)
      : 0;
    const remainingOnCurrent = Math.max(0, averageDuration - elapsedOnCurrent);

    estimatedWaitingMinutes =
      patientsAhead === 0
        ? remainingOnCurrent
        : remainingOnCurrent + (patientsAhead - 1) * averageDuration;
  }

  const estimatedArrival = new Date(baseTime.getTime() + estimatedWaitingMinutes * 60 * 1000);

  const formatTime = (dateObj) =>
    dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  let confidenceLevel = "Calculated";
  const historyCount = await ConsultationHistory.countDocuments({ doctorId });
  if (historyCount > 15) {
    confidenceLevel = "Refined (Historical)";
  }
  if (!doctor.isArrived && !doctor.sessionStarted) {
    confidenceLevel = "Low (Doctor Not Arrived)";
  }

  return {
    estimatedWaitingMinutes: Math.round(estimatedWaitingMinutes),
    estimatedArrivalTime: formatTime(estimatedArrival),
    confidenceLevel,
    patientsAhead,
    averageDuration
  };
};

/**
 * Parses a channelingTime string like "2:00 PM" into a Date for today.
 * Returns null if it can't be parsed (e.g. empty string).
 */
function parseChannelingTime(channelingTime, referenceDate) {
  if (!channelingTime) return null;
  const match = channelingTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let [, hours, minutes, meridiem] = match;
  hours = parseInt(hours, 10);
  minutes = parseInt(minutes, 10);

  if (meridiem) {
    if (/PM/i.test(meridiem) && hours < 12) hours += 12;
    if (/AM/i.test(meridiem) && hours === 12) hours = 0;
  }

  const result = new Date(referenceDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Recalculates average consultation duration from recent history.
 * Uses a trimmed mean (drops the shortest/longest 10%) so a single
 * emergency or unusually quick visit doesn't skew every future estimate.
 */
export const updateDoctorAverageDuration = async (doctorId) => {
  try {
    const history = await ConsultationHistory.find({ doctorId }).sort({ date: -1 }).limit(50);
    if (history.length === 0) return;

    const durations = history.map((h) => h.actualDuration).sort((a, b) => a - b);
    const trimCount = Math.floor(durations.length * 0.1);
    const trimmed = trimCount > 0 ? durations.slice(trimCount, durations.length - trimCount) : durations;

    const total = trimmed.reduce((sum, d) => sum + d, 0);
    const newAverage = Math.round(total / trimmed.length);

    await Doctor.findByIdAndUpdate(doctorId, {
      averageConsultationDuration: newAverage > 0 ? newAverage : 10
    });
  } catch (err) {
    console.error("Failed to update doctor average duration:", err);
  }
};