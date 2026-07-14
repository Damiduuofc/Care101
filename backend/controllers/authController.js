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

    // Email uniqueness check removed to allow duplicate emails

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
      mobileNumber, email, district, password
    } = req.body;

    if (!email || email.trim() === "") {
      return res.status(400).json({ message: "Email is required" });
    }

    // Email uniqueness check removed to allow duplicate emails

    // 2. Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Create new Patient
    const newPatient = new Patient({
      fullName,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      nicNumber: nicNumber || undefined,
      mobileNumber,
      email: email.toLowerCase(),
      district,
      password: hashedPassword,
      isRegistered: true
    });

    await newPatient.save();
    const finalPatient = newPatient;

    // 4. Create Token
    const token = jwt.sign(
      { id: finalPatient._id, role: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Send Welcome Email if patient has an email address
    if (finalPatient.email) {
      try {
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
          to: finalPatient.email,
          subject: "Welcome to Care101 - Your Patient ID Details",
          text: `Hello ${finalPatient.fullName},\n\nWelcome to Care101! Your patient account has been successfully created.\n\nYour Patient ID is: ${finalPatient.patientId}\n\nYou should use this Patient ID (along with your password) to log in to the Care101 mobile application.\n\nBest regards,\nThe Care101 Team`
        });
      } catch (emailErr) {
        console.error("Welcome email failed to send:", emailErr);
      }
    }

    res.status(201).json({
      token,
      user: {
        id: finalPatient._id,
        name: finalPatient.fullName,
        email: finalPatient.email,
        nicNumber: finalPatient.nicNumber,
        role: "patient",
        patientId: finalPatient.patientId
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
    const { identifier, password } = req.body;

    let user = null;
    let role = null;

    if (!identifier) {
      return res.status(400).json({ message: "Identifier is required" });
    }

    const trimmedIdentifier = identifier.trim();

    // Check if the identifier is a numeric string (valid SLMC registration number)
    const isNumeric = /^\d+$/.test(trimmedIdentifier);

    if (isNumeric) {
      // 1. Check Doctor Collection by SLMC Registration Number
      const slmcNumber = parseInt(trimmedIdentifier, 10);
      const doctor = await Doctor.findOne({ slmcReg: slmcNumber });
      if (doctor) {
        // Block unapproved doctors
        if (!doctor.isApproved) {
          return res.status(403).json({ message: "Your account is pending admin approval. Please wait for the administrator to activate your account." });
        }
        user = doctor;
        role = "doctor";
      }
    } else {
      // 2. Check Patient Collection by Patient ID
      const patient = await Patient.findOne({
        patientId: trimmedIdentifier.toUpperCase()
      });
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
        nicNumber: user.nicNumber || user.nic || null,  // Include NIC for patients/doctors
        patientId: user.patientId || null
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
      insuranceProvider, policyNumber, profileImage, email
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
    if (email) patient.email = email.toLowerCase().trim();

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

// Helper to mask email address: e.g. john.doe@example.com -> j***@example.com
const maskEmail = (email) => {
  if (!email) return "";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  const firstChar = localPart.charAt(0);
  return `${firstChar}***@${domain}`;
};

// Helper to find patient or doctor by various identifiers
const findUserByIdentifier = async (identifier) => {
  if (!identifier) return null;
  const searchStr = identifier.toString().trim();

  // 1. Try finding patient by patientId (case-insensitive/uppercase) or email
  let user = await Patient.findOne({
    $or: [
      { patientId: searchStr.toUpperCase() },
      { email: searchStr.toLowerCase() }
    ]
  });
  if (user) return { user, userType: "Patient" };

  // 2. Try finding doctor by slmcReg or email
  if (/^\d+$/.test(searchStr)) {
    const slmcNum = parseInt(searchStr, 10);
    user = await Doctor.findOne({ slmcReg: slmcNum });
    if (user) return { user, userType: "Doctor" };
  }

  user = await Doctor.findOne({ email: searchStr.toLowerCase() });
  if (user) return { user, userType: "Doctor" };

  return null;
};

// ==========================================
// FORGOT PASSWORD (Generate & Send OTP)
// ==========================================
export const forgotPassword = async (req, res) => {
  const { email } = req.body; // email parameter acts as the identifier input from user (email, slmcReg, or patientId)

  try {
    const result = await findUserByIdentifier(email);
    if (!result) {
      // Security: Do not reveal if the account exists
      return res.json({ msg: "If the account is registered, an OTP has been sent." });
    }

    const { user } = result;

    if (!user.email) {
      return res.status(400).json({ msg: "This account has no associated email address for password reset. Please contact administration." });
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

    const maskedEmail = maskEmail(user.email);

    res.json({ 
      msg: "If the account is registered, an OTP has been sent.", 
      maskedEmail,
      email: user.email
    });

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
    const result = await findUserByIdentifier(email);
    if (!result) return res.status(400).json({ msg: "Invalid request." });

    const { user } = result;

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
    const result = await findUserByIdentifier(email);
    if (!result) return res.status(400).json({ msg: "Invalid request." });

    const { user } = result;

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

export const getNextPatientId = async (req, res) => {
  try {
    const lastPatient = await Patient.findOne(
      { patientId: /^SHP\d+$/ },
      {},
      { sort: { patientId: -1 } }
    );
    
    let nextNum = 1;
    if (lastPatient && lastPatient.patientId) {
      const match = lastPatient.patientId.match(/^SHP(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    
    const paddedNum = String(nextNum).padStart(3, '0');
    res.json({ patientId: `SHP${paddedNum}` });
  } catch (error) {
    console.error("Error getting next patient ID:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
