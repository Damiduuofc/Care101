import "dotenv/config"; 
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

// 1. Import Routes
import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patient.js"; 
import appointmentRoutes from "./routes/appointments.js";
import doctorsListRoutes from "./routes/doctors.js"; 
import doctorDashboardRoutes from "./routes/doctor.js"; 
import medicalRoutes from "./routes/medicalRecords.js";
import notificationRoutes from "./routes/notifications.js"; 
import billingRoutes from "./routes/billing.js";
import financeRoutes from "./routes/finance.js";
import surgeryRecordRoutes from "./routes/surgeryRecords.js";
const app = express();

// 2. Middleware (Increase limit for images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Allow Mobile & Web Access
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

console.log("Connecting to Database...");

// 3. Register Routes
app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/doctors", doctorsListRoutes); 
app.use("/api/doctor", doctorDashboardRoutes); 
app.use("/api/medical-records", medicalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/surgery-records", surgeryRecordRoutes); 

// 4. Database Connection & Server Start
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    const PORT = process.env.PORT || 5000;
    
    app.listen(PORT, "0.0.0.0", () => 
      console.log(`🚀 Server running on port ${PORT}`)
    );

  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1); 
  }
};

startServer();