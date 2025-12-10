import express from "express";
import Doctor from "../models/Doctor.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. GET PUBLIC DIRECTORY (For Website)
// ==========================================
router.get("/public", async (req, res) => {
  try {
    // 1. Fetch data including profileImage
    const doctors = await Doctor.find().select(
      "name fullName specialization qualifications profileImage mobileNumber _id"
    );
    
    // 2. Format data
    const formattedDoctors = doctors.map(doc => {
      // Logic to pick the best name available
      const displayName = doc.fullName || doc.name || "Unknown Doctor";

      return {
        _id: doc._id,
        name: displayName,
        specialization: doc.specialization || "General",
        qualifications: doc.qualifications || "Medical Practitioner",
        
        // ✅ CRITICAL CHECK: Ensure image exists, otherwise send empty string
        // This prevents "undefined" errors on the frontend
        profileImage: doc.profileImage ? doc.profileImage : "", 
        
        mobileNumber: doc.mobileNumber || "N/A"
      };
    });

    res.json(formattedDoctors);

  } catch (err) {
    console.error("Error fetching public doctors:", err.message);
    res.status(500).json({ msg: "Server Error: Unable to load directory" });
  }
});

// ... (Keep your other routes /list, /:id, and PUT /:id exactly as they are) ...

// ==========================================
// 2. GET DOCTOR LIST (Authenticated)
// ==========================================
router.get("/list", auth, async (req, res) => {
  try {
    const doctors = await Doctor.find().select("name fullName specialization qualifications profileImage _id");
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      name: doc.fullName || doc.name || "Unknown Doctor", 
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
      name: doctor.fullName || doctor.name,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications,
      profileImage: doctor.profileImage || "",
      mobileNumber: doctor.mobileNumber,
    });
  } catch (err) {
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: "Doctor not found" });
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4. UPDATE DOCTOR (Admin/Manual)
// ==========================================
router.put("/:id", auth, async (req, res) => {
  try {
    const { fullName, specialization, qualifications, profileImage, mobileNumber } = req.body;
    let doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    if (fullName) doctor.fullName = fullName;
    if (specialization) doctor.specialization = specialization;
    if (qualifications) doctor.qualifications = qualifications;
    if (profileImage) doctor.profileImage = profileImage;
    if (mobileNumber) doctor.mobileNumber = mobileNumber;

    await doctor.save();
    res.json({ msg: "Doctor Updated Successfully", doctor });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;