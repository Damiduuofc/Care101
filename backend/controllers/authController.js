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
    
    // 🔍 DEBUG LOG 1: Incoming Request
    console.log(`\n--- LOGIN ATTEMPT ---`);
    console.log(`Email provided: ${email}`);
    console.log(`Password provided: ${password}`);

    let user = null;
    let role = null;

    // 1. Check Doctor Collection
    const doctor = await Doctor.findOne({ email });
    if (doctor) {
      console.log("✅ Found in Doctor Collection");
      user = doctor;
      role = "doctor";
    } else {
      console.log("❌ Not found in Doctor Collection");
    }

    // 2. Check Patient Collection (if not found yet)
    if (!user) {
      const patient = await Patient.findOne({ email });
      if (patient) {
        console.log("✅ Found in Patient Collection");
        user = patient;
        role = "patient";
      } else {
        console.log("❌ Not found in Patient Collection");
      }
    }

    // 3. User Not Found
    if (!user) {
      console.log("🔴 ERROR: User does not exist in any database.");
      return res.status(400).json({ msg: "User not found" });
    }

    // 4. Check Password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password Match Result: ${isMatch}`);

    if (!isMatch) {
      console.log("🔴 ERROR: Password did not match hash.");
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // 5. Success
    console.log("🟢 SUCCESS: Login Authorized");
    
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
    console.error("🔥 CRITICAL LOGIN ERROR:", error);
    res.status(500).json({ msg: "Server Error" });
  }
};