import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Doctor from "../models/Doctor.js"; // ✅ Import Doctor Model
import { register, login, registerPatient } from "../controllers/authController.js";

const router = express.Router();

// Existing Routes
router.post("/register", register);
router.post("/login", login);
router.post("/register-patient", registerPatient);

// ==========================================
// ✅ NEW: REGISTER DOCTOR ROUTE
// ==========================================
router.post("/register-doctor", async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      specialization, 
      mobileNumber, 
      qualifications, 
      slmcCertificate,
      nic 
    } = req.body;

    // 1. Check if doctor already exists
    let user = await Doctor.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create Doctor
    user = new Doctor({
      name,
      email,
      password: hashedPassword,
      specialization,
      mobileNumber,
      qualifications, // SLMC Reg No
      slmcCertificate, // Base64 Image
      nic,
      role: "doctor"
    });

    await user.save();

    // 4. Create Token (Auto-login)
    const payload = { user: { id: user.id, role: "doctor" } };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET || "mysecrettoken", // Ensure Secret exists
      { expiresIn: "7d" },
      (err, token) => {
        if (err) throw err;
        // Send back token AND user data
        res.json({ 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                role: "doctor" 
            } 
        });
      }
    );

  } catch (err) {
    console.error("Register Doctor Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;