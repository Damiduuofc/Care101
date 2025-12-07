import express from "express";
import { register, login, registerPatient } from "../controllers/authController.js";
const router = express.Router();

router.post("/register", register);
router.post("/login", login);

// Patient Route
router.post("/register-patient", registerPatient); 
export default router;