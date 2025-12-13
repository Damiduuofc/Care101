import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken"; // ✅ Added missing import
import Admin from "../models/Admin.js";
import Doctor from "../models/Doctor.js"; // Needed for stats
import { protect, authorize } from "../middleware/authRole.js"; 

const router = express.Router();

// ==========================================
// 1. ADMIN LOGIN (This was missing!)
// ==========================================
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid Credentials" });
    }

    // Create Token
    const payload = {
      id: admin.id,
      role: admin.role 
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });

    // Return User Data
    res.json({
      token,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department
      }
    });

  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. DASHBOARD STATS
// ==========================================
router.get("/stats", protect, async (req, res) => {
  try {
    const doctorCount = await Doctor.countDocuments();
    const pendingDoctors = await Doctor.countDocuments({ isApproved: false });

    // Placeholder data until you have real patients/revenue
    res.json({
      doctors: doctorCount,
      patients: 120, // Fake number for now
      pendingDoctors: pendingDoctors,
      revenue: 250000 // Fake number for now
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. CREATE NEW STAFF (System Admin Only)
// ==========================================
router.post("/create-staff", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;

    if (!["receptionist", "nurse", "system_admin"].includes(role)) {
      return res.status(400).json({ msg: "Invalid Role" });
    }

    let user = await Admin.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new Admin({
      name,
      email,
      password: hashedPassword,
      role,
      department
    });

    await user.save();
    res.json({ msg: `New ${role} created successfully` });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 4. GET ALL STAFF (System Admin Only)
// ==========================================
router.get("/staff", protect, authorize(["system_admin"]), async (req, res) => {
  try {
    const staff = await Admin.find().select("-password");
    res.json(staff);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;