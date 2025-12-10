import express from "express";
import Doctor from "../models/Doctor.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. GET DOCTOR LIST (Authenticated - For Booking Form)
// ==========================================
router.get("/list", auth, async (req, res) => {
  try {
    // Fetch essential fields for dropdowns
    const doctors = await Doctor.find().select("name fullName specialization qualifications _id");
    
    // Normalize and format data
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      name: doc.name || doc.fullName || "Unknown Doctor", // Fallback if name is missing
      specialization: doc.specialization || "General",
      qualifications: doc.qualifications || ""
    }));

    res.json(formattedDoctors);

  } catch (err) {
    console.error("Error fetching doctor list:", err.message);
    res.status(500).json({ msg: "Server Error: Unable to fetch doctors" });
  }
});

// ==========================================
// 2. GET PUBLIC DIRECTORY (No Auth - For Home/Doctors Page)
// ==========================================
router.get("/public", async (req, res) => {
  try {
    // Fetch public profile fields
    const doctors = await Doctor.find().select(
      "name fullName specialization qualifications profileImage mobileNumber _id"
    );
    
    // Normalize and format data
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      name: doc.name || doc.fullName || "Unknown Doctor",
      specialization: doc.specialization || "General",
      qualifications: doc.qualifications || "Medical Practitioner",
      profileImage: doc.profileImage || "", // Send empty string if no image
      mobileNumber: doc.mobileNumber || "N/A"
    }));

    res.json(formattedDoctors);

  } catch (err) {
    console.error("Error fetching public doctors:", err.message);
    res.status(500).json({ msg: "Server Error: Unable to load directory" });
  }
});

// ==========================================
// 3. GET SINGLE DOCTOR DETAILS (Public)
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select("-password");
    
    if (!doctor) {
      return res.status(404).json({ msg: "Doctor not found" });
    }

    const formattedDoctor = {
      _id: doctor._id,
      name: doctor.name || doctor.fullName,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      profileImage: doctor.profileImage,
      mobileNumber: doctor.mobileNumber,
      // Add other public fields here if needed
    };

    res.json(formattedDoctor);

  } catch (err) {
    console.error("Error fetching doctor details:", err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: "Doctor not found" });
    }
    res.status(500).send("Server Error");
  }
});

export default router;