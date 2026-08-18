import express from "express";
import { auth } from "../middleware/auth.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import ConsultationHistory from "../models/ConsultationHistory.js";
import { calculatePrediction, updateDoctorAverageDuration } from "../services/predictionService.js";

const router = express.Router();

// ==========================================
// 1. UPDATE QUEUE (POST /api/queue/update)
// ==========================================
router.post("/update", auth, async (req, res) => {
  try {
    const { doctorId, currentServingNumber, action, appointmentId } = req.body;
    
    let doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    const prevServing = doctor.currentQueueNumber || 0;

    if (action === "start") {
      if (!doctor.isArrived) {
        return res.status(400).json({ msg: "Cannot start session until the doctor has been marked as arrived." });
      }
      if (doctor.sessionEndedToday) {
        return res.status(400).json({ msg: "Doctor session has already been completed today and cannot be restarted." });
      }
      doctor.sessionStarted = true;
      doctor.currentQueueNumber = 1;
    } else if (action === "end") {
      doctor.sessionStarted = false;
      doctor.currentQueueNumber = 0;
      doctor.sessionEndedToday = true;
    } else if (currentServingNumber !== undefined) {
      doctor.currentQueueNumber = currentServingNumber;
    }

    if (action === "increment") {
      doctor.currentQueueNumber = prevServing + 1;
    } else if (action === "decrement") {
      doctor.currentQueueNumber = Math.max(0, prevServing - 1);
    }

    await doctor.save();

    // Log consultation history on completion
    if (appointmentId && action === "complete") {
      const appt = await Appointment.findById(appointmentId);
      if (appt) {
        appt.status = "completed";
        appt.consultationEndTime = new Date();
        await appt.save();

        const startTime = appt.consultationStartTime || appt.checkInTime || appt.date;
        const duration = Math.round((new Date().getTime() - startTime.getTime()) / (60 * 1000));
        
        await ConsultationHistory.create({
          doctorId: appt.doctorId,
          patientId: appt.patientId,
          appointmentId: appt._id,
          actualDuration: duration > 0 ? duration : 10,
          startHour: startTime.getHours(),
          dayOfWeek: startTime.getDay(),
          delayMinutes: Math.max(0, Math.round((startTime.getTime() - appt.date.getTime()) / (60 * 1000)))
        });

        // Recalculate average
        await updateDoctorAverageDuration(appt.doctorId);
      }
    }

    // Emit live updates to connected socket client rooms
    if (req.io) {
      req.io.emit("doctorStatusUpdated", doctor);
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const activeAppointments = await Appointment.find({
        doctorId: doctor._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ["confirmed", "Confirmed", "pending", "Pending", "Waiting"] }
      });

      for (const appt of activeAppointments) {
        const pred = await calculatePrediction(doctor._id, doctor.currentQueueNumber, appt.queueNumber);
        
        req.io.to(`doctor:${doctor._id}`).emit("queueUpdated", {
          doctorId: doctor._id,
          currentServingNumber: doctor.currentQueueNumber,
          currentToken: doctor.currentQueueNumber,
          patientQueueNumber: appt.queueNumber,
          estimatedWaitingMinutes: pred.estimatedWaitingMinutes,
          estimatedArrivalTime: pred.estimatedArrivalTime,
          lastUpdated: new Date()
        });
      }
    }

    res.json(doctor);
  } catch (err) {
    console.error("Queue Update Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. GET PATIENT ESTIMATION (GET /api/queue/patient/:patientId)
// ==========================================
router.get("/patient/:patientId", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appt = await Appointment.findOne({
      patientId: req.params.patientId,
      date: { $gte: today },
      status: { $in: ["confirmed", "Confirmed", "pending", "Pending", "Waiting"] }
    });

    if (!appt) {
      return res.status(404).json({ msg: "No active appointment found for today" });
    }

    const doctor = await Doctor.findById(appt.doctorId);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    const currentServing = doctor.currentQueueNumber || 0;
    const pred = await calculatePrediction(doctor._id, currentServing, appt.queueNumber);

    res.json({
      doctorName: doctor.name,
      queueNumber: appt.queueNumber,
      currentServingNumber: currentServing,
      currentToken: currentServing,
      ...pred,
      lastUpdated: new Date()
    });
  } catch (err) {
    console.error("Patient Prediction Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. GET DOCTOR LIVE QUEUE (GET /api/queue/doctor/:doctorId/live)
// ==========================================
router.get("/doctor/:doctorId/live", auth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const activeAppts = await Appointment.find({
      doctorId: doctor._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ["confirmed", "Confirmed", "pending", "Pending", "Waiting"] }
    }).sort({ queueNumber: 1 });

    res.json({
      doctorId: doctor._id,
      doctorName: doctor.name,
      currentServingNumber: doctor.currentQueueNumber || 0,
      sessionStarted: doctor.sessionStarted || false,
      averageConsultationDuration: doctor.averageConsultationDuration || 10,
      activeAppointmentsCount: activeAppts.length
    });
  } catch (err) {
    console.error("Doctor Live Queue Error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;
