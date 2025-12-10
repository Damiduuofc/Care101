import express from "express";
import Doctor from "../models/Doctor.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. GET DOCTOR LIST (Authenticated - For Booking Form)
// ==========================================
router.get("/list", auth, async (req, res) => {
  try {
    // ✅ Added profileImage to select so avatars update
    const doctors = await Doctor.find().select("name fullName specialization qualifications profileImage _id");
    
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      // ✅ FIX: Check fullName FIRST, then fallback to name
      name: doc.fullName || doc.name || "Unknown Doctor", 
      specialization: doc.specialization || "General",
      qualifications: doc.qualifications || "",
      profileImage: doc.profileImage || "" 
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
    const doctors = await Doctor.find().select(
      "name fullName specialization qualifications profileImage mobileNumber _id"
    );
    
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      // ✅ FIX: Prioritize fullName so updates show immediately
      name: doc.fullName || doc.name || "Unknown Doctor",
      specialization: doc.specialization || "General",
      qualifications: doc.qualifications || "Medical Practitioner",
      profileImage: doc.profileImage || "", 
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
      // ✅ FIX: Prioritize fullName
      name: doctor.fullName || doctor.name,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      profileImage: doctor.profileImage,
      mobileNumber: doctor.mobileNumber,
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

// ==========================================
// 4. ✅ NEW: UPDATE DOCTOR (Admin/Manual Update)
// ==========================================
router.put("/:id", auth, async (req, res) => {
  try {
    const { fullName, specialization, qualifications, profileImage, mobileNumber } = req.body;

    // Find doctor by ID
    let doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    // Update fields if provided
    if (fullName) doctor.fullName = fullName;
    if (specialization) doctor.specialization = specialization;
    if (qualifications) doctor.qualifications = qualifications;
    if (profileImage) doctor.profileImage = profileImage;
    if (mobileNumber) doctor.mobileNumber = mobileNumber;

    await doctor.save();
    
    res.json({ msg: "Doctor Updated Successfully", doctor });

  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;