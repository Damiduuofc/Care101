import express from "express";
// ✅ IMPORT CORRECT NAMES (Matches Controller)
import { registerDoctor, registerPatient, login } from "../controllers/authController.js";

const router = express.Router();

// ==========================================
// AUTH ROUTES
// ==========================================

// 1. Register Doctor
// Endpoint: POST /api/auth/register-doctor
router.post("/register-doctor", registerDoctor);

// 2. Register Patient
// Endpoint: POST /api/auth/register-patient
router.post("/register-patient", registerPatient);

// 3. Login
// Endpoint: POST /api/auth/login
router.post("/login", login);

export default router;