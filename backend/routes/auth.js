import express from "express";
// ✅ FIXED: Added 'registerDoctorsBulk' to the import list
import { 
  registerDoctor, 
  registerPatient, 
  login, 
  registerDoctorsBulk 
} from "../controllers/authController.js";

const router = express.Router();

// ==========================================
// AUTH ROUTES
// ==========================================

// 1. Register Doctor (Single)
// Endpoint: POST /api/auth/register-doctor
router.post("/register-doctor", registerDoctor);

// 2. Register Doctors (Bulk - 150+ List)
// Endpoint: POST /api/auth/register-doctors-bulk
router.post("/register-doctors-bulk", registerDoctorsBulk);

// 3. Register Patient
// Endpoint: POST /api/auth/register-patient
router.post("/register-patient", registerPatient);

// 4. Login
// Endpoint: POST /api/auth/login
router.post("/login", login);

export default router;