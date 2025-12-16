import express from "express";
import bcrypt from "bcryptjs"; // ✅ Essential for password changing
import Doctor from "../models/Doctor.js";
import SurgeryRecord from "../models/SurgeryRecord.js"; 
import HospitalFinance from "../models/Finance.js"; 
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ---------------------------------------------
// 1. DASHBOARD STATS
// ---------------------------------------------
router.get("/dashboard-stats", auth, async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Get Doctor
    const doctor = await Doctor.findById(doctorId).select("name fullName specialization");
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    // Count Records
    const recordCount = await SurgeryRecord.countDocuments({ doctorId });

    // Calculate Income
    const hospitals = await HospitalFinance.find({ doctorId });
    let totalIncome = 0;

    hospitals.forEach(hospital => {
      let hospitalIncome = 0;
      if (hospital.records && hospital.records.length > 0) {
        hospital.records.forEach(rec => {
          if (rec.type === 'channeling') hospitalIncome += (rec.income || 0);
          else if (rec.type === 'surgical') hospitalIncome += (rec.amount || 0);
        });
      }
      if (hospital.whtEnabled) hospitalIncome = hospitalIncome * 0.95;
      totalIncome += hospitalIncome;
    });

    res.json({
      name: doctor.name || doctor.fullName || "Doctor",
      specialization: doctor.specialization || "Specialist",
      income: Math.round(totalIncome),
      records: recordCount
    });

  } catch (err) {
    console.error("Dashboard Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 2. GET PROFILE (View)
// ---------------------------------------------
router.get("/profile", auth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select("-password");
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    res.json({
      fullName: doctor.fullName || doctor.name,
      nameWithInitials: doctor.nameWithInitials || doctor.name,
      nic: doctor.nic || "N/A",
      phone: doctor.phone || "N/A",
      email: doctor.email,
      specialization: doctor.specialization || "General Physician",
      profileImage: doctor.profileImage || null,
subscription: doctor.subscription || { plan: 'free', status: 'active' },
    });

  } catch (err) {
    console.error("Profile Fetch Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 3. UPDATE PROFILE (Edit)
// ---------------------------------------------
router.put("/profile", auth, async (req, res) => {
  try {
    const { fullName, nameWithInitials, nic, phone,  profileImage } = req.body;

    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    // Update fields if provided
    if (fullName) doctor.fullName = fullName;
    if (nameWithInitials) doctor.nameWithInitials = nameWithInitials;
    if (nic) doctor.nic = nic;
    if (phone) doctor.phone = phone;
    if (profileImage) doctor.profileImage = profileImage; 

    await doctor.save();
    res.json({ msg: "Profile Updated", doctor });

  } catch (err) {
    console.error("Profile Update Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 4. CHANGE PASSWORD
// ---------------------------------------------
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const doctor = await Doctor.findById(req.user.id);

    // Verify Current Password
    const isMatch = await bcrypt.compare(currentPassword, doctor.password);
    if (!isMatch) return res.status(400).json({ msg: "Incorrect current password" });

    // Hash New Password
    const salt = await bcrypt.genSalt(10);
    doctor.password = await bcrypt.hash(newPassword, salt);

    await doctor.save();
    res.json({ msg: "Password Changed Successfully" });

  } catch (err) {
    console.error("Password Change Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;