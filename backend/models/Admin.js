import mongoose from "mongoose";

const StaffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // load with "+password"
  
  role: { 
    type: String, 
    enum: ["system_admin", "receptionist", "nurse", "lab_assistant"], 
    default: "receptionist" 
  },
  
  department: { type: String, default: "General" },

  createdAt: { type: Date, default: Date.now },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false }
});

// Indexes for the dashboard / list queries
StaffSchema.index({ role: 1 });

export default mongoose.model("Admin", StaffSchema); 
