import "dotenv/config"; // ✅ MUST BE THE FIRST LINE
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth.js";

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Debugging: verify the key is loaded
console.log("Connecting to Database...");

// Routes
app.use("/api/auth", authRoutes);

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.log("❌ MongoDB Connection Error:", err.message);
    // process.exit(1); // Optional: Stop server if DB fails
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));