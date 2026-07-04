import mongoose from "mongoose";

const PatientSchema = new mongoose.Schema({
patientId: { 
    type: String, 
    required: true, 
    unique: true 
  },

  fullName: { 
    type: String, 
    required: true,
    trim: true 
  },

  username: { 
    type: String, 
    trim: true 
  },

  email: { 
    type: String, 
    lowercase: true,
    trim: true 
  },
  nicNumber: { 
    type: String, 
    trim: true 
  },

  password: { 
    type: String, 
    required: true 
  },

  // --- DEMOGRAPHICS ---
  mobileNumber: { 
    type: String, 
    required: true 
  },
  dateOfBirth: { 
    type: Date, // Better to store as Date object (frontend sends ISO string)
    required: true 
  },
  gender: { 
    type: String, 
    enum: ["Male", "Female", "Other"],
    required: true 
  },
  district: { 
    type: String, 
    required: true 
  },

  // --- OPTIONAL MEDICAL DATA ---
  emergencyContact: { type: String, default: "" },
  medicalConditions: { type: String, default: "" },
  allergies: { type: String, default: "" },
  insuranceProvider: { type: String, default: "" },
  policyNumber: { type: String, default: "" },
  profileImage: { type: String, default: "" },
  
  isRegistered: {
    type: Boolean,
    default: true
  },

  role: { 
    type: String, 
    default: "patient" 
  },
  
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  resetPasswordOtp: { type: String },
  resetPasswordExpire: { type: Date }
});

PatientSchema.pre("validate", async function() {
  if (!this.patientId) {
    try {
      const lastPatient = await mongoose.model("Patient").findOne(
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
      this.patientId = `SHP${paddedNum}`;
      
      if (!this.username) {
        this.username = this.patientId;
      }
    } catch (err) {
      throw err;
    }
  } else if (!this.username) {
    this.username = this.patientId;
  }
});

export default mongoose.model("Patient", PatientSchema);