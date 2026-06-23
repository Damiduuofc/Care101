import Doctor from "../models/Doctor.js";
import Patient from "../models/Patient.js";
import jwt from "jsonwebtoken";
import Notification from "../models/Notification.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

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
      fullName,
      email,
      password: hashedPassword,
      specialization,
      nic: nicNumber,
      phone: phoneNumber,
      slmcReg: slmcRegistrationNumber,
      nameWithInitials,
      isApproved: false
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

    // 1. Check uniqueness across Doctor collection
    const existingDoctor = await Doctor.findOne({ email: email.toLowerCase() });
    if (existingDoctor) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Check existing patients by email and NIC
    const existingPatientByEmail = await Patient.findOne({ email: email.toLowerCase() });
    const existingPatientByNic = await Patient.findOne({ nicNumber });

    let patientToUpgrade = null;

    if (existingPatientByEmail) {
      if (existingPatientByEmail.isRegistered === false) {
        patientToUpgrade = existingPatientByEmail;
      } else {
        return res.status(400).json({ message: "User with this email already exists" });
      }
    }

    if (existingPatientByNic) {
      if (existingPatientByNic.isRegistered === false) {
        if (patientToUpgrade && patientToUpgrade._id.toString() !== existingPatientByNic._id.toString()) {
          return res.status(400).json({ message: "NIC number is already in use by another account." });
        }
        patientToUpgrade = existingPatientByNic;
      } else {
        return res.status(400).json({ message: "User with this NIC number already exists" });
      }
    }

    // Check if username is already in use by another registered patient
    const existingUsername = await Patient.findOne({ username });
    if (existingUsername) {
      if (!patientToUpgrade || patientToUpgrade._id.toString() !== existingUsername._id.toString()) {
        return res.status(400).json({ message: "Username is already in use by another account." });
      }
    }

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let finalPatient;

    if (patientToUpgrade) {
      // Upgrade existing walk-in patient
      patientToUpgrade.fullName = fullName;
      patientToUpgrade.email = email.toLowerCase();
      patientToUpgrade.username = username;
      patientToUpgrade.nicNumber = nicNumber;
      patientToUpgrade.password = hashedPassword;
      patientToUpgrade.mobileNumber = mobileNumber;
      patientToUpgrade.dateOfBirth = new Date(dateOfBirth);
      patientToUpgrade.gender = gender;
      patientToUpgrade.district = district;
      patientToUpgrade.isRegistered = true; // Mark as fully registered

      await patientToUpgrade.save();
      finalPatient = patientToUpgrade;
    } else {
      // 3. Create new Patient
      const newPatient = new Patient({
        fullName,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        nicNumber,
        mobileNumber,
        email: email.toLowerCase(),
        district,
        username,
        password: hashedPassword,
        isRegistered: true
      });

      await newPatient.save();
      finalPatient = newPatient;
    }

    // 4. Create Token
    const token = jwt.sign(
      { id: finalPatient._id, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      token,
      user: {
        id: finalPatient._id,
        name: finalPatient.fullName,
        email: finalPatient.email,
        nicNumber: finalPatient.nicNumber,
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
      // Block unapproved doctors
      if (!doctor.isApproved) {
        return res.status(403).json({ message: "Your account is pending admin approval. Please wait for the administrator to activate your account." });
      }
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
        specialization: user.specialization || null,
        nicNumber: user.nicNumber || user.nic || null  // Include NIC for patients/doctors
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
    const hashedPassword = await bcrypt.hash("Damidu12.", salt);

    const doctorsWithHashedPassword = doctorsList.map(doc => ({
      ...doc,
      password: hashedPassword,
      isApproved: false
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


export const getMe = async (req, res) => {
  try {
    // req.user.id comes from the auth middleware decoding the token
    const patient = await Patient.findById(req.user.id).select("-password");

    if (!patient) {
      return res.status(404).json({ msg: "User not found" });
    }

    res.json(patient);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};


// 1. UPDATE PROFILE (Handles Text + Base64 Image)
export const updateProfile = async (req, res) => {
  try {
    const {
      fullName, mobileNumber, district,
      emergencyContact, medicalConditions, allergies,
      insuranceProvider, policyNumber, profileImage
    } = req.body;

    const patient = await Patient.findById(req.user.id);
    if (!patient) return res.status(404).json({ msg: "User not found" });

    // Update fields if provided
    if (fullName) patient.fullName = fullName;
    if (mobileNumber) patient.mobileNumber = mobileNumber;
    if (district) patient.district = district;
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (medicalConditions) patient.medicalConditions = medicalConditions;
    if (allergies) patient.allergies = allergies;
    if (insuranceProvider) patient.insuranceProvider = insuranceProvider;
    if (policyNumber) patient.policyNumber = policyNumber;
    if (profileImage) patient.profileImage = profileImage; // Expecting Base64 string

    await patient.save();
    res.json({ msg: "Profile updated successfully", patient });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// 2. CHANGE PASSWORD
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const patient = await Patient.findById(req.user.id);

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, patient.password);
    if (!isMatch) return res.status(400).json({ msg: "Incorrect current password" });

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    patient.password = await bcrypt.hash(newPassword, salt);

    await patient.save();
    res.json({ msg: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// 3. GET NOTIFICATIONS
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id }).sort({ timestamp: -1 });
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// ==========================================
// FORGOT PASSWORD (Generate & Send OTP)
// ==========================================
export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // 1. Search Patient DB first, then Doctor DB
    let user = await Patient.findOne({ email });
    let userType = 'Patient';

    if (!user) {
      user = await Doctor.findOne({ email });
      userType = 'Doctor';
    }

    if (!user) {
      // Security: Do not reveal if the email exists
      return res.json({ msg: "If the email is registered, an OTP has been sent." });
    }

    // 2. Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Save OTP and set expiration (10 minutes)
    user.resetPasswordOtp = otp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 4. Send Email using Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: '"Care101" <noreply@care101.com>',
      to: user.email,
      subject: "Your Password Reset Code",
      text: `Your password reset code is: ${otp}\n\nThis code will expire in 10 minutes.`,
    });

    res.json({ msg: "If the email is registered, an OTP has been sent." });

  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).send("Server Error");
  }
};

// ==========================================
// VERIFY OTP
// ==========================================
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    let user = await Patient.findOne({ email }) || await Doctor.findOne({ email });

    if (!user) return res.status(400).json({ msg: "Invalid request." });

    // Check if OTP matches and is not expired
    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ msg: "Invalid OTP." });
    }

    if (user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ msg: "OTP has expired. Please request a new one." });
    }

    res.json({ msg: "OTP verified successfully." });

  } catch (err) {
    console.error("Verify OTP Error:", err);
    res.status(500).send("Server Error");
  }
};

// ==========================================
// RESET PASSWORD (Set new password)
// ==========================================
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    let user = await Patient.findOne({ email }) || await Doctor.findOne({ email });

    if (!user) return res.status(400).json({ msg: "Invalid request." });

    // Final security check
    if (user.resetPasswordOtp !== otp || user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({ msg: "Invalid or expired OTP." });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Clear the OTP fields
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ msg: "Password reset successfully. You can now log in." });

  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).send("Server Error");
  }
};