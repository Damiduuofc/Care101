import express from "express";
import Doctor from "../models/Doctor.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/list", auth, async (req, res) => {
  try {
    // Fetch all doctors but only get ID, Name, and Specialization
    const doctors = await Doctor.find().select("name fullName specialization qualifications");
    
    // Normalize names (handle name vs fullName inconsistency)
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      name: doc.name || doc.fullName || "Doctor",
      specialization: doc.specialization || "General"
    }));

    res.json(formattedDoctors);
  } catch (err) {
    console.error("Doctor List Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. GET PUBLIC DIRECTORY (For Home Page / Doctors Page)
router.get("/public", async (req, res) => {
  try {
    const doctors = await Doctor.find().select("name fullName specialization qualifications profileImage mobileNumber");
    
    // Normalize names here too
    const formattedDoctors = doctors.map(doc => ({
      _id: doc._id,
      name: doc.name || doc.fullName || "Doctor",
      specialization: doc.specialization,
      qualifications: doc.qualifications,
      profileImage: doc.profileImage,
      mobileNumber: doc.mobileNumber
    }));

    res.json(formattedDoctors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export default router;