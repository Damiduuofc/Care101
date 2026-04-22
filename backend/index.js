import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";

// Routes
import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patient.js";
import appointmentRoutes from "./routes/appointments.js";
import doctorsListRoutes from "./routes/doctors.js";
import doctorDashboardRoutes from "./routes/doctor.js";
import doctorRoutes from "./routes/doctors.js";
import notificationRoutes from "./routes/notifications.js";
import financeRoutes from "./routes/finance.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/payments.js";
import patientsRoutes from "./routes/patients.js";
import scheduleRequestRoutes from "./routes/scheduleRequests.js"; 

const app = express();
const __dirname = path.resolve();

/* =========================
   MIDDLEWARE
========================= */

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "ngrok-skip-browser-warning",
    "x-auth-token" 
  ]
}));


app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.send("🚀 Care101 Backend is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/doctors", doctorsListRoutes);
app.use("/api/doctor", doctorDashboardRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/patients", patientsRoutes); 
app.use("/api/schedule-requests", scheduleRequestRoutes); 

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT;

const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server error:", error.message);
    process.exit(1);
  }
};

startServer();