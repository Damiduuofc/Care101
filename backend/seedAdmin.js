import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Admin from "./models/Admin.js";

dotenv.config();

const seedSystemAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");

    const email = "root@care101.com";
    const password = "Care@101"; 
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if user already exists
    let admin = await Admin.findOne({ email });

    if (admin) {
      // ✅ IF EXISTS: Update the password
      admin.password = hashedPassword;
      admin.role = "system_admin"; // Ensure role is correct
      await admin.save();
      console.log("✅ Admin Credentials UPDATED Successfully!");
    } else {
      // ✅ IF NEW: Create the account
      admin = new Admin({
        name: "System Administrator",
        email,
        password: hashedPassword,
        role: "system_admin",
        department: "IT"
      });
      await admin.save();
      console.log("✅ New Admin Account CREATED!");
    }

    console.log("-----------------------------------");
    console.log(`📧 Login Email: ${email}`);
    console.log(`🔑 Login Pass:  ${password}`);
    console.log("-----------------------------------");
    
    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

seedSystemAdmin();