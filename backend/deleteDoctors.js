import mongoose from "mongoose";
import dotenv from "dotenv";
import Doctor from "./models/Notification.js"; 

// 1. Force load .env from the current directory
dotenv.config();

const deleteAllDoctors = async () => {
  try {
    // 🔍 DEBUG: Print the URI to see if it exists (Don't share this output if it contains passwords)
    console.log("🔍 Checking Environment Variables...");
    const dbUri = process.env.MONGO_URI || process.env.MONGO_URL; // Try both common names

    if (!dbUri) {
      console.error("❌ ERROR: Could not find MONGO_URI or MONGO_URL in your .env file.");
      console.log("   --> Please check your .env file and make sure the variable name matches.");
      process.exit(1);
    }

    console.log("✅ URI Found. Connecting to MongoDB...");
    
    // 2. Connect directly
    await mongoose.connect(dbUri);
    console.log("✅ Connected.");

    // 3. Delete
    const result = await Doctor.deleteMany({});
    console.log(`🗑️  DELETED ${result.deletedCount} doctors.`);

    process.exit();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
};

deleteAllDoctors();