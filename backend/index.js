import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import fs from "fs";
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
import Doctor from "./models/Doctor.js";
import ScheduleRequest from "./models/ScheduleRequest.js";

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

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

    // Automatic Room + Nurse Release Job (runs every 30 seconds)
    setInterval(async () => {
      try {
        const now = new Date();
        
        // Find all doctors who have active allocations in their live fields
        const activeDoctors = await Doctor.find({
          $or: [
            { allocatedRoom: { $ne: "" } },
            { allocatedNurse: { $ne: "" } }
          ]
        });

        for (const doctor of activeDoctors) {
          // Find any approved schedule requests for this doctor today that have already ended
          const endedSchedule = await ScheduleRequest.findOne({
            doctorId: doctor._id,
            status: "approved",
            endTime: { $lte: now }
          }).sort({ endTime: -1 });

          if (endedSchedule) {
            // Check if they have an active/ongoing schedule right now (to avoid releasing if back-to-back sessions are happening)
            const currentActive = await ScheduleRequest.findOne({
              doctorId: doctor._id,
              status: "approved",
              startTime: { $lte: now },
              endTime: { $gt: now }
            });

            if (!currentActive) {
              console.log(`[Auto-Release] Session for Dr. ${doctor.name} ended at ${endedSchedule.endTime}. Releasing Room ${doctor.allocatedRoom} and Nurse ${doctor.allocatedNurse}.`);
              doctor.allocatedRoom = "";
              doctor.allocatedNurse = "";
              await doctor.save();
            }
          }
        }
      } catch (err) {
        console.error("Auto-Release Job Error:", err);
      }
    }, 30000);

  } catch (error) {
    console.error("❌ Server error:", error.message);
    process.exit(1);
  }
};

startServer();