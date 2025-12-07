import express from "express";
import Patient from "../models/Patient.js";
import { auth } from "../middleware/auth.js";
import bcrypt from "bcryptjs"; // Needed for password hashing

const router = express.Router();

// 1. GET Profile
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

// 2. UPDATE Profile (Includes Photo & Phone)
router.put("/profile", auth, async (req, res) => {
  try {
    const { 
      fullName, dateOfBirth, gender, emergencyContact, 
      mobileNumber, // ✅ Fix: Ensure this matches frontend
      profileImage, // ✅ New: Base64 Image String
      medicalConditions, allergies, 
      insuranceProvider, policyNumber 
    } = req.body;

    const patient = await Patient.findById(req.user.id);
    if (!patient) return res.status(404).json({ msg: "Patient not found" });

    // Update fields
    if (fullName) patient.fullName = fullName;
    if (dateOfBirth) patient.dateOfBirth = dateOfBirth;
    if (gender) patient.gender = gender;
    if (mobileNumber) patient.mobileNumber = mobileNumber; // ✅ Save Phone
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (profileImage) patient.profileImage = profileImage; // ✅ Save Image
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

// 3. CHANGE PASSWORD
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const patient = await Patient.findById(req.user.id);

    // Verify old password
    const isMatch = await bcrypt.compare(currentPassword, patient.password);
    if (!isMatch) return res.status(400).json({ msg: "Current password is incorrect" });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    patient.password = await bcrypt.hash(newPassword, salt);

    await patient.save();
    res.json({ msg: "Password updated successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 4. DELETE ACCOUNT
router.delete("/delete-account", auth, async (req, res) => {
  try {
    await Patient.findByIdAndDelete(req.user.id);
    res.json({ msg: "Account deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
// GET Patient Dashboard Data
router.get("/dashboard", auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.user.id).select("-password");
    if (!patient) return res.status(404).json({ msg: "Patient not found" });

    // In the future, you will run queries here to count appointments, etc.
    // const appointmentCount = await Appointment.countDocuments({ patientId: req.user.id });

    res.json({
      name: patient.fullName,
      profileImage: patient.profileImage,
      // Sending mock stats for now until we build those tables
      stats: {
        appointments: 0,
        prescriptions: 0,
        reports: 0,
        vitals: "Normal"
      },
      // Mock activities
      activities: [
        { id: 1, description: "Profile updated", timestamp: new Date(patient.updatedAt).toLocaleDateString() },
        { id: 2, description: "Account created", timestamp: new Date(patient.createdAt).toLocaleDateString() }
      ]
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
export default router;