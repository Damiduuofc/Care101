// Single source of truth for channeling fees. Clients only display these values;
// the server always computes the amount it charges.
export const HOSPITAL_CHANNELING_FEE = Number(process.env.HOSPITAL_CHANNELING_FEE) || 1500;
export const DEFAULT_DOCTOR_FEE = Number(process.env.DEFAULT_DOCTOR_FEE) || 2000;

// How long an unpaid booking keeps its place before it is released (never past the session start)
export const UNPAID_HOLD_MINUTES = Number(process.env.UNPAID_HOLD_MINUTES) || 120;
// Shortest payment window, even when the session has already started or starts very soon
export const MIN_UNPAID_HOLD_MINUTES = Number(process.env.MIN_UNPAID_HOLD_MINUTES) || 30;

// Patients can cancel or reschedule up to this many minutes before the session starts
export const PATIENT_CHANGE_CUTOFF_MINUTES = Number(process.env.PATIENT_CHANGE_CUTOFF_MINUTES) || 60;

export const getChannelingFees = (doctor) => {
  const doctorFee = Number(doctor?.channelingFee) > 0 ? Number(doctor.channelingFee) : DEFAULT_DOCTOR_FEE;
  return {
    hospitalFee: HOSPITAL_CHANNELING_FEE,
    doctorFee,
    total: HOSPITAL_CHANNELING_FEE + doctorFee
  };
};
