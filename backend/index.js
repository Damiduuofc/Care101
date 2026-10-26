import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

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
import instructionRoutes, { handlePatientInstructionsView } from "./routes/instructionRoutes.js";
import patientsRoutes from "./routes/patients.js"; // <--- NEW: Patients management
import scheduleRequestRoutes from "./routes/scheduleRequests.js"; // <--- NEW: Schedule Requests
import labRequestRoutes from "./routes/labRequests.js"; // <--- NEW: Lab Requests
import labTestRoutes from "./routes/labTests.js";
import queueRoutes from "./routes/queue.js";
import Doctor from "./models/Doctor.js";
import ScheduleRequest from "./models/ScheduleRequest.js";
import LabTest from "./models/LabTest.js";
import labTests from "./config/labTests.js";

const app = express();
app.set("trust proxy", true);

// ==========================================
// 1. CORS CONFIGURATION (Strict Allowlist)
// ==========================================
const rawAllowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  "http://localhost:9002",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5002",
  "http://127.0.0.1:9002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:5002"
].filter(Boolean).map(o => o.trim().replace(/\/$/, ""));

const allowedOriginsSet = new Set(rawAllowedOrigins);

const corsOriginDelegate = (origin, callback) => {
  // Allow non-browser requests (mobile apps, Expo, curl/Postman, server-to-server) where origin header is absent
  if (!origin) {
    return callback(null, true);
  }
  
  const normalizedOrigin = origin.replace(/\/$/, "");
  if (
    allowedOriginsSet.has(normalizedOrigin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin) ||
    // Private LAN addresses (dev machine accessed from other devices on the network)
    /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(normalizedOrigin) ||
    /\.ngrok-free\.(app|dev)$/.test(normalizedOrigin) ||
    /\.ngrok\.(io|app|dev)$/.test(normalizedOrigin)
  ) {
    return callback(null, true);
  }

  return callback(new Error(`CORS policy: Origin ${origin} is not allowed.`));
};

const httpServer = createServer(app);

// ==========================================
// 2. SOCKET.IO WITH AUTHENTICATION MIDDLEWARE
// ==========================================
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginDelegate,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  }
});

// Socket.IO Handshake Authentication Middleware
io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.["authorization"] ||
    socket.handshake.headers?.["x-auth-token"] ||
    socket.handshake.query?.token;

  if (!token) {
    console.warn(`⚠️ Socket connection rejected: No token provided from socket ${socket.id}`);
    return next(new Error("Authentication error: Token required"));
  }

  try {
    const tokenString = token.startsWith("Bearer ") ? token.slice(7).trim() : token.trim();
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
    socket.user = decoded; // { id, role, ... }
    next();
  } catch (err) {
    console.error(`❌ Socket authentication error from socket ${socket.id}:`, err.message);
    return next(new Error("Authentication error: Invalid token"));
  }
});

// Attach Socket.io instance to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

io.on("connection", (socket) => {
  console.log(`🔌 Authenticated client connected: ${socket.id} (User: ${socket.user?.id || socket.user?.name || "unknown"}, Role: ${socket.user?.role || "patient"})`);
  
  socket.on("joinDoctorRoom", (doctorId) => {
    socket.join(`doctor:${doctorId}`);
    console.log(`📡 Authenticated client ${socket.id} joined room: doctor:${doctorId}`);
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
  origin: corsOriginDelegate,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "ngrok-skip-browser-warning",
    "x-auth-token"
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
app.use("/api/instructions", instructionRoutes);
app.get("/patient/instructions/:token", handlePatientInstructionsView);
app.use("/api/payments", paymentRoutes);
app.use("/api/patients", patientsRoutes); // <--- NEW: Patients management
app.use("/api/schedule-requests", scheduleRequestRoutes); // <--- NEW: Schedule requests
app.use("/api/lab-requests", labRequestRoutes); // <--- NEW: Lab Requests
app.use("/api/lab-tests", labTestRoutes);
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

    const seedResult = await LabTest.bulkWrite(
      labTests.map(test => ({
        updateOne: {
          filter: { name: test.name },
          update: { $setOnInsert: test },
          upsert: true
        }
      }))
    );
    if (seedResult.upsertedCount) {
      console.log(`✅ Seeded ${seedResult.upsertedCount} lab tests`);
    }

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