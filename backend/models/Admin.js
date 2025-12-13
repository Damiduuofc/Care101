import mongoose from "mongoose";

const StaffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  role: { 
    type: String, 
    enum: ["system_admin", "receptionist", "nurse"], 
    default: "receptionist" 
  },
  
  department: { type: String, default: "General" },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Admin", StaffSchema); 
