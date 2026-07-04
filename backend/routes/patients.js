import express from "express";
import bcrypt from "bcryptjs";
import Patient from "../models/Patient.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// ==========================================
// 1. SEARCH PATIENT BY PATIENT ID (For Doctor)
// ==========================================
router.get("/search-by-patientid/:patientId", auth, async (req, res) => {
    try {
        const { patientId } = req.params;

        if (!patientId || patientId.trim().length === 0) {
            return res.status(400).json({ msg: "Patient ID is required" });
        }

        // Search for patient by PatientID
        const patient = await Patient.findOne({ patientId: patientId.trim().toUpperCase() })
            .select("-password")
            .lean();

        if (!patient) {
            return res.status(404).json({ msg: "Patient not found", found: false });
        }

        res.json({ found: true, patient });

    } catch (err) {
        console.error("Patient ID Search Error:", err);
        res.status(500).send("Server Error");
    }
});

// ==========================================
// 2. ADD PATIENT MANUALLY (For Doctor)
// ==========================================
router.post("/add-patient", auth, async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            fullName,
            nic,
            mobileNumber,
            dateOfBirth,
            gender,
            emergencyContact,
            medicalConditions,
            allergies
        } = req.body;

        // Validation
        if (!password || !fullName) {
            return res.status(400).json({
                msg: "Please provide password and full name"
            });
        }

        // Check if patient already exists
        if (username) {
            let existingPatient = await Patient.findOne({ username });
            if (existingPatient) {
                return res.status(400).json({
                    msg: "Patient already exists with this username"
                });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new patient
        const newPatient = new Patient({
            username: username || undefined,
            email: email ? email.toLowerCase() : undefined,
            password: hashedPassword,
            fullName,
            nicNumber: nic || undefined,
            mobileNumber: mobileNumber || "",
            dateOfBirth: dateOfBirth || null,
            gender: gender || "Other",
            emergencyContact: emergencyContact || "",
            medicalConditions: medicalConditions || [],
            allergies: allergies || [],
            role: "patient"
        });

        await newPatient.save();

        // Return patient without password
        const patientResponse = await Patient.findById(newPatient._id).select("-password");

        res.status(201).json({
            msg: "Patient added successfully",
            patient: patientResponse
        });

    } catch (err) {
        console.error("Add Patient Error:", err);
        res.status(500).send("Server Error");
    }
});

// ==========================================
// 3. GET ALL PATIENTS (For Doctor)
// ==========================================
router.get("/all-patients", auth, async (req, res) => {
    try {
        const patients = await Patient.find()
            .select("patientId username fullName nicNumber mobileNumber email dateOfBirth gender createdAt")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json(patients);

    } catch (err) {
        console.error("Get All Patients Error:", err);
        res.status(500).send("Server Error");
    }
});

export default router;
