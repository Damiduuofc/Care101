import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ==========================================
// 1. REGISTER DOCTOR
// ==========================================
export const registerDoctor = async (req, res) => {
  try {
    // 1. Destructure with Frontend Field Names
    const { 
      fullName,              // Frontend sends 'fullName'
      email, 
      password, 
      specialization,
      nicNumber,             // Frontend sends 'nicNumber'
      phoneNumber, 
      slmcRegistrationNumber,// Frontend sends 'slmcRegistrationNumber'
      nameWithInitials
    } = req.body;

    // 2. Check if user exists in EITHER collection
    const existingDoctor = await Doctor.findOne({ email });
    const existingPatient = await Patient.findOne({ email });

    if (existingDoctor || existingPatient) {
      return res.status(400).json({ message: "User with this email already exists." });
    }

    // 3. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create Doctor (Map Frontend fields to Schema fields)
    const newDoctor = new Doctor({
      name: fullName,                // Map fullName -> name
      email,
      password: hashedPassword,
      specialization,
      nic: nicNumber,                // Map nicNumber -> nic
      phone: phoneNumber,            // Map phoneNumber -> phone
      slmcReg: slmcRegistrationNumber, // Map -> slmcReg
      nameWithInitials,
      // Subscription defaults are handled by the Mongoose Schema
    });

    await newDoctor.save();

    // 5. Create Token
    const token = jwt.sign(
      { id: newDoctor._id, role: 'doctor' }, 
      process.env.JWT_SECRET, 
      { expiresIn: "30d" }
    );

    res.status(201).json({ 
      token, 
      user: { 
        id: newDoctor._id, 
        name: newDoctor.name, 
        email: newDoctor.email,
        role: "doctor"
      },
      message: "Doctor registered successfully"
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ==========================================
// 2. REGISTER PATIENT
// ==========================================
export const registerPatient = async (req, res) => {
  try {
    const { 
      fullName, dateOfBirth, gender, nicNumber,
      mobileNumber, email, district, username, password 
    } = req.body;

    // 1. Check uniqueness across BOTH collections
    const existingPatient = await Patient.findOne({ email });
    const existingDoctor = await Doctor.findOne({ email });

    if (existingPatient || existingDoctor) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create Patient
    const newPatient = new Patient({
      fullName,
      dateOfBirth,
      gender,
      nicNumber,
      mobileNumber,
      email,
      district,
      username,
      password: hashedPassword
    });

    await newPatient.save();

    // 4. Create Token
    const token = jwt.sign(
      { id: newPatient._id, role: 'patient' }, 
      process.env.JWT_SECRET, 
      { expiresIn: "30d" }
    );

    res.status(201).json({ 
      token, 
      user: { 
        id: newPatient._id, 
        name: newPatient.fullName, 
        email: newPatient.email,
        role: "patient"
      } 
    });

  } catch (error) {
    console.error("Patient Register Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ==========================================
// 3. UNIFIED LOGIN
// ==========================================
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    let user = null;
    let role = null;

    // 1. Check Doctor Collection
    const doctor = await Doctor.findOne({ email });
    if (doctor) {
      user = doctor;
      role = "doctor";
    }

    // 2. Check Patient Collection (if not found in Doctor)
    if (!user) {
      const patient = await Patient.findOne({ email });
      if (patient) {
        user = patient;
        role = "patient";
      }
    }

    // 3. User Not Found
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // 4. Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 5. Generate Token
    const token = jwt.sign(
      { id: user._id, role: role }, 
      process.env.JWT_SECRET, 
      { expiresIn: "30d" }
    );

    res.json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name || user.fullName, 
        email: user.email, 
        role: role,
        specialization: user.specialization || null 
      } 
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};