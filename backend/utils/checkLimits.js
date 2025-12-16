import Doctor from "../models/Doctor.js";
import SurgeryRecord from "../models/SurgeryRecord.js";
import HospitalFinance from "../models/Finance.js";

export const checkPlanLimits = async (doctorId, actionType, targetId = null) => {
  const doctor = await Doctor.findById(doctorId);
  
  // ✅ Premium Users have NO limits
  if (doctor.subscription && doctor.subscription.plan === 'premium') {
    return true; 
  }

  // --- FREE PLAN RESTRICTIONS ---

  // 1. Limit Surgery Records (Patients) to 4
  if (actionType === 'create_record') {
    const count = await SurgeryRecord.countDocuments({ doctorId });
    if (count >= 4) {
      throw new Error("Free Plan Limit: You can only manage 4 Patient Records. Upgrade to Premium for unlimited access.");
    }
  }

  // 2. Limit Entries per Record to 3
  if (actionType === 'add_entry') {
    const record = await SurgeryRecord.findById(targetId);
    if (record && record.entries.length >= 3) {
      throw new Error("Free Plan Limit: You can only add 3 progress entries per patient. Upgrade to Premium.");
    }
  }

  // 3. Limit Hospitals in Finance to 1
  if (actionType === 'add_hospital') {
    const count = await HospitalFinance.countDocuments({ doctorId });
    if (count >= 1) {
      throw new Error("Free Plan Limit: You can only track 1 Hospital in finances. Upgrade to Premium.");
    }
  }

  return true;
};