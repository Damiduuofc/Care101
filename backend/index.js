import "dotenv/config"; 
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patient.js"; 
import appointmentRoutes from "./routes/appointments.js";
import doctorRoutes from "./routes/doctors.js"; 
import medicalRoutes from "./routes/medicalRecords.js";
import notificationRoutes from "./routes/notifications.js"; 
import billingRoutes from "./routes/billing.js";



const app = express();

// ✅ INCREASE UPLOAD LIMIT HERE (Add these two lines)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

// Debugging
console.log("Connecting to Database...");

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/doctors", doctorRoutes); 
app.use("/api/medical-records", medicalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/billing", billingRoutes);

// Database Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.log("❌ MongoDB Connection Error:", err.message);
  });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));