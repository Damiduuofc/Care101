import express from "express";
import bcrypt from "bcryptjs";
import Patient from "../models/Patient.js";
import Appointment from "../models/Appointment.js"; 
import { auth } from "../middleware/auth.js"; 

const router = express.Router();

// ==========================================
// 1. GET PROFILE
// ==========================================
router.get("/profile", auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.user.id).select("-password");
    if (!patient) return res.status(404).json({ msg: "Patient not found" });
    res.json(patient);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. UPDATE PROFILE
// ==========================================
router.put("/profile", auth, async (req, res) => {
  try {
    const { 
      fullName, dateOfBirth, gender, emergencyContact, 
      mobileNumber, profileImage, medicalConditions, 
      allergies, insuranceProvider, policyNumber 
    } = req.body;

    const patient = await Patient.findById(req.user.id);
    if (!patient) return res.status(404).json({ msg: "Patient not found" });

    if (fullName) patient.fullName = fullName;
    if (dateOfBirth) patient.dateOfBirth = dateOfBirth;
    if (gender) patient.gender = gender;
    if (mobileNumber) patient.mobileNumber = mobileNumber;
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (profileImage) patient.profileImage = profileImage;
    if (medicalConditions) patient.medicalConditions = medicalConditions;
    if (allergies) patient.allergies = allergies;
    if (insuranceProvider) patient.insuranceProvider = insuranceProvider;
    if (policyNumber) patient.policyNumber = policyNumber;

    await patient.save();
    res.json(patient);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. CHANGE PASSWORD
// ==========================================
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const patient = await Patient.findById(req.user.id);

    const isMatch = await bcrypt.compare(currentPassword, patient.password);
    if (!isMatch) return res.status(400).json({ msg: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    patient.password = await bcrypt.hash(newPassword, salt);

    await patient.save();
    res.json({ msg: "Password updated successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4. DELETE ACCOUNT
// ==========================================
router.delete("/delete-account", auth, async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.user.id);
    res.json({ msg: "Account deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 5. GET DASHBOARD DATA (FIXED)
// ==========================================
router.get("/dashboard", auth, async (req, res) => {
  try {
    const patientId = req.user.id;

    // 1. Fetch Patient Details
    const patient = await Patient.findById(patientId).select("-password");
    if (!patient) return res.status(404).json({ msg: "Patient not found" });

    // 2. Calculate Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ FIX: Changed to look for LOWERCASE "pending" and "confirmed"
    const upcomingAppointments = await Appointment.countDocuments({
      patientId: patientId,
      date: { $gte: today },
      status: { $in: ["pending", "confirmed", "Pending", "Confirmed"] } // Checking both to be safe
    });

    // ✅ FIX: Changed to look for LOWERCASE "completed"
    const completedAppointments = await Appointment.countDocuments({
      patientId: patientId,
      status: { $in: ["completed", "Completed"] }
    });

    // 3. Generate Recent Activity Feed
    const latestAppointments = await Appointment.find({ patientId: patientId })
      .sort({ createdAt: -1 })
      .limit(3);

    const activities = latestAppointments.map((appt) => {
      // Capitalize first letter for display (e.g., "pending" -> "Pending")
      const statusDisplay = appt.status.charAt(0).toUpperCase() + appt.status.slice(1);
      return {
        description: `Appointment ${statusDisplay} with ${appt.doctorName}`,
        timestamp: new Date(appt.createdAt).toLocaleDateString()
      };
    });

    if (activities.length === 0) {
      activities.push({
        description: "Account created successfully",
        timestamp: new Date(patient.createdAt).toLocaleDateString()
      });
    }

    res.json({
      name: patient.fullName,
      profileImage: patient.profileImage || "",
      stats: {
        appointments: upcomingAppointments,
        prescriptions: completedAppointments,
        reports: 0, 
        vitals: "Good" 
      },
      activities: activities
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;