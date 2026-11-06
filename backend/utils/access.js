import Patient from "../models/Patient.js";
import { ROLES } from "../middleware/authRole.js";

// Doctors and hospital staff may look up any patient; patients only themselves
export const canSeeAnyPatient = (user) => ROLES.CLINICAL.includes(user?.role);

// Use before putting user input into a RegExp, so "." or "(" are matched literally
export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// True when a surgery record (keyed by patient code, Mongo id or NIC) belongs to this patient
export const recordBelongsToPatient = async (patientUserId, record) => {
  const patient = await Patient.findById(patientUserId).select("patientId nicNumber").lean();
  if (!patient || !record) return false;
  const recId = String(record.patientId || "").trim().toUpperCase();
  if (recId && (recId === String(patient._id).toUpperCase() || recId === String(patient.patientId || "").toUpperCase())) return true;
  return Boolean(record.nic && patient.nicNumber && record.nic.trim().toLowerCase() === patient.nicNumber.trim().toLowerCase());
};
