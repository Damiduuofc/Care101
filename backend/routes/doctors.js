import express from "express";
import Doctor from "../models/Doctor.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. GET ALL DOCTORS (Public Directory - No Auth Required)
router.get("/public", async (req, res) => {
  try {
    // Select specific fields to send to the frontend
    const doctors = await Doctor.find()
      .select("name specialization qualifications profileImage mobileNumber"); 
    res.json(doctors);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// ... keep your existing routes (like /list) ...

export default router;