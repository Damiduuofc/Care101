import express from "express";
// ✅ FIXED: Added all missing controller functions to the import
import { 
  registerDoctor, 
  registerPatient, 
  login, 
  registerDoctorsBulk,
  getMe,             // <--- Added
  updateProfile,     // <--- Added
  changePassword,    // <--- Added
  getNotifications   // <--- Added
} from "../controllers/authController.js";

import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// AUTH ROUTES
// ==========================================

// 1. Register Doctor (Single)
router.post("/register-doctor", registerDoctor);

// 2. Register Doctors (Bulk)
router.post("/register-doctors-bulk", registerDoctorsBulk);

// 3. Register Patient
router.post("/register-patient", registerPatient);

// 4. Login
router.post("/login", login);

// ==========================================
// PROTECTED ROUTES (Require Token)
// ==========================================

// 5. Get Current User Profile
router.get("/me", auth, getMe);

// 6. Update Profile
router.put("/update-profile", auth, updateProfile);

// 7. Change Password
router.put("/change-password", auth, changePassword);

// 8. Get Notifications
router.get("/notifications", auth, getNotifications);

export default router;