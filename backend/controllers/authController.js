import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// --- REGISTER DOCTOR ---
export const register = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      specialization,
      nic, 
      phoneNumber, 
      slmcRegistrationNumber, 
      nameWithInitials
    } = req.body;

    // 1. Check if doctor exists
    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) {
      return res.status(400).json({ msg: "Doctor already exists" });
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create Doctor
    const newDoctor = new Doctor({
      name,
      email,
      password: hashedPassword,
      specialization,
      nic,
      phone: phoneNumber,
      slmcReg: slmcRegistrationNumber,
      nameWithInitials
    });

    await newDoctor.save();

    // 4. Create Token (Added role: 'doctor')
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
      } 
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
};

// --- REGISTER PATIENT ---
export const registerPatient = async (req, res) => {
  try {
    const { 
      fullName, dateOfBirth, gender, nicNumber,
      mobileNumber, email, district, username, password 
    } = req.body;

    // 1. Check if patient exists
    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) {
      return res.status(400).json({ msg: "Patient already exists with this email" });
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

    // 4. Create Token (Added role: 'patient')
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
    res.status(500).json({ msg: "Server Error" });
  }
};

// --- UNIFIED LOGIN (WORKS FOR BOTH) ---
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = null;
    let role = null;

    // 1. FIRST: Check Doctor Collection
    const doctor = await Doctor.findOne({ email });
    
    if (doctor) {
      user = doctor;
      role = "doctor";
    } else {
      // 2. SECOND: If not a doctor, check Patient Collection
      const patient = await Patient.findOne({ email });
      if (patient) {
        user = patient;
        role = "patient";
      }
    }

    // 3. If user is still null, they don't exist in EITHER table
    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    // 4. Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // 5. Generate Token
    const token = jwt.sign(
      { id: user._id, role: role }, 
      process.env.JWT_SECRET, 
      { expiresIn: "30d" }
    );

    // 6. Send Response (Dynamic name handling)
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        // Doctors use 'name', Patients use 'fullName'. This handles both:
        name: user.name || user.fullName, 
        email: user.email,
        role: role,
        specialization: user.specialization || null // Only send if it exists
      } 
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ msg: "Server Error" });
  }
};