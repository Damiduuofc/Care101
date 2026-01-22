import express from "express";
import Doctor from "../models/Doctor.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. GET PUBLIC DIRECTORY (For Website)
// ==========================================
router.get("/public", async (req, res) => {
  try {
    // 1. Fetch data: Selecting specific fields to match your DB
    const doctors = await Doctor.find().select(
      "name fullName nameWithInitials specialization qualifications profileImage mobileNumber phone _id"
    );
    
    // 2. Format data
    const formattedDoctors = doctors.map(doc => {
      // Logic to pick the best name available
      const displayName = doc.fullName || doc.nameWithInitials || doc.name || "Unknown Doctor";

      // Logic to pick the phone number (DB has 'phone', code might look for 'mobileNumber')
      const displayPhone = doc.mobileNumber || doc.phone || "N/A";

      return {
        _id: doc._id,
        name: displayName,
        specialization: doc.specialization || "General",
        qualifications: doc.qualifications || "Medical Practitioner",
        
        // Pass the image string directly (whether it's base64 or a filename)
        profileImage: doc.profileImage ? doc.profileImage : "", 
        
        mobileNumber: displayPhone
      };
    });

    res.json(formattedDoctors);

  } catch (err) {
    console.error("Error fetching public doctors:", err.message);
    res.status(500).json({ msg: "Server Error: Unable to load directory" });
  }
});

// ==========================================
// 2. GET DOCTOR LIST (Authenticated)
// ==========================================
router.get("/list", auth, async (req, res) => {
  try {
    const doctors = await Doctor.find().select("name fullName nameWithInitials specialization qualifications profileImage _id");
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      name: doc.fullName || doc.nameWithInitials || doc.name || "Unknown Doctor", 
      specialization: doc.specialization || "General",
      qualifications: doc.qualifications || "",
      profileImage: doc.profileImage || "" 
    }));
    res.json(formattedDoctors);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// ==========================================
// 3. GET SINGLE DOCTOR (Public)
// ==========================================
router.get("/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select("-password");
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    res.json({
      _id: doctor._id,
      name: doctor.fullName || doctor.nameWithInitials || doctor.name,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      profileImage: doctor.profileImage || "",
      mobileNumber: doctor.mobileNumber || doctor.phone || "N/A",
    });
  } catch (err) {
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: "Doctor not found" });
    res.status(500).send("Server Error");
  }
});

export default router;