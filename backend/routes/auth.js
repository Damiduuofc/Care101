import express from "express";
import { 
  registerDoctor, 
  registerPatient, 
  login, 
  registerDoctorsBulk,
  getMe,             
  updateProfile,     
  changePassword,    
  getNotifications,
  forgotPassword,    
  verifyOtp,
  resetPassword,
  getNextPatientId
} from "../controllers/authController.js";

import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// AUTH ROUTES (Public)
// ==========================================

// 1. Register Doctor (Single)
router.post("/register-doctor", registerDoctor);

// 2. Register Doctors (Bulk)
router.post("/register-doctors-bulk", registerDoctorsBulk);

// 3. Register Patient
router.post("/register-patient", registerPatient);

// 4. Login
router.post("/login", login);

// 5. Password Reset Flow (OTP)
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);
router.get("/next-patient-id", getNextPatientId);


// ==========================================
// PROTECTED ROUTES (Require Token)
// ==========================================

// 6. Get Current User Profile
router.get("/me", auth, getMe);

// 7. Update Profile
router.put("/update-profile", auth, updateProfile);

// 8. Change Password
router.put("/change-password", auth, changePassword);

// 9. Get Notifications
router.get("/notifications", auth, getNotifications);

export default router;
