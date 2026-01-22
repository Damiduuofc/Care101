import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// 1. REGISTER SINGLE DOCTOR
export const registerDoctor = async (req, res) => {
  try {
    const { fullName, email, password, specialization, nicNumber, phoneNumber, slmcRegistrationNumber, nameWithInitials } = req.body;

    const existingDoctor = await Doctor.findOne({ email });
    if (existingDoctor) return res.status(400).json({ message: "Doctor already exists." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newDoctor = new Doctor({
      name: fullName,
      email,
      password: hashedPassword,
      specialization,
      nic: nicNumber,
      phone: phoneNumber,
      slmcReg: slmcRegistrationNumber,
      nameWithInitials
    });

    await newDoctor.save();

    const token = jwt.sign({ id: newDoctor._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.status(201).json({ token, user: { id: newDoctor._id, name: newDoctor.name, role: "doctor" }, message: "Doctor registered successfully" });
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


// 2. REGISTER DOCTORS BULK (For your JSON list)
export const registerDoctorsBulk = async (req, res) => {
  try {
    const doctorsList = req.body;
    if (!Array.isArray(doctorsList)) return res.status(400).json({ message: "Input must be an array." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("Damidu12", salt);

    const doctorsWithHashedPassword = doctorsList.map(doc => ({
      ...doc,
      password: hashedPassword,
      // Map JSON fields to Schema if needed, assuming JSON matches Schema for bulk
    }));

    // ordered: false allows successful inserts even if some fail (duplicates)
    const result = await Doctor.insertMany(doctorsWithHashedPassword, { ordered: false });

    res.status(201).json({ message: "Bulk import successful!", count: result.length });
  } catch (error) {
    if (error.code === 11000) {
        return res.status(400).json({ message: "Import partial/failed: Some emails or NICs already exist." });
    }
    res.status(500).json({ message: error.message });
  }
};