import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";

// Routes
import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patient.js";
import appointmentRoutes from "./routes/appointments.js";
import doctorsListRoutes from "./routes/doctors.js";
import doctorDashboardRoutes from "./routes/doctor.js";
import medicalRoutes from "./routes/medicalRecords.js";
import doctorRoutes from "./routes/doctors.js";
import notificationRoutes from "./routes/notifications.js";
import financeRoutes from "./routes/finance.js";
import surgeryRecordRoutes from "./routes/surgeryRecords.js";
import chatRoutes from "./routes/chatRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/payments.js"; // <--- Import this
import instructionRoutes from "./routes/instructionRoutes.js";
import patientsRoutes from "./routes/patients.js"; // <--- NEW: Patients management
import scheduleRequestRoutes from "./routes/scheduleRequests.js"; // <--- NEW: Schedule Requests
import labRequestRoutes from "./routes/labRequests.js"; // <--- NEW: Lab Requests
import queueRoutes from "./routes/queue.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});

// Attach Socket.io instance to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  socket.on("joinDoctorRoom", (doctorId) => {
    socket.join(`doctor:${doctorId}`);
    console.log(`📡 Client joined room: doctor:${doctorId}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

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
    "x-auth-token" // <--- ADD THIS LINE
  ]
}));

// Increase payload size (images, files)
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
app.use("/api/medical-records", medicalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/surgery-records", surgeryRecordRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/instructions", instructionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/patients", patientsRoutes); // <--- NEW: Patients management
app.use("/api/schedule-requests", scheduleRequestRoutes); // <--- NEW: Schedule requests
app.use("/api/lab-requests", labRequestRoutes); // <--- NEW: Lab Requests
app.use("/api/queue", queueRoutes);
/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("❌ Server error:", error.message);
    process.exit(1);
  }
};

startServer();