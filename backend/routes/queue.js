import express from "express";
import { protect, authorize } from "../middleware/authRole.js";
import Doctor from "../models/Doctor.js";

import Appointment from "../models/Appointment.js";
import ScheduleRequest from "../models/ScheduleRequest.js";
import ConsultationHistory from "../models/ConsultationHistory.js";
import Notification from "../models/Notification.js";
import { calculatePrediction, updateDoctorAverageDuration } from "../services/predictionService.js";
import { countPaidAhead, firstPaidToken } from "../utils/queueToken.js";

const router = express.Router();

// ==========================================
// 1. UPDATE QUEUE (POST /api/queue/update)
// ==========================================
router.post("/update", protect, authorize(["doctor", "nurse", "receptionist", "system_admin"]), async (req, res) => {
  try {
    const { doctorId, currentServingNumber, action, appointmentId } = req.body;
    
    let doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    const prevServing = doctor.currentQueueNumber || 0;
    let releasedNurse = "";

    // Ensure doctor's allocated nurse and room are preserved from today's schedule if currently empty and session not ended
    if ((!doctor.allocatedNurse || !doctor.allocatedRoom) && !doctor.sessionEndedToday) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const activeSched = await ScheduleRequest.findOne({
        doctorId: doctor._id,
        status: "approved",
        sessionEnded: { $ne: true },
        date: { $gte: startOfDay, $lte: endOfDay }
      });

      if (activeSched) {
        if (!doctor.allocatedNurse && activeSched.allocatedNurse) {
          doctor.allocatedNurse = activeSched.allocatedNurse;
        }
        if (!doctor.allocatedRoom && activeSched.allocatedRoom) {
          doctor.allocatedRoom = activeSched.allocatedRoom;
        }
      }
    }

    if (action === "start") {
      if (!doctor.isArrived) {
        return res.status(400).json({ msg: "Cannot start session until the doctor has been marked as arrived." });
      }
      if (doctor.sessionEndedToday) {
        return res.status(400).json({ msg: "Doctor session has already been completed today and cannot be restarted." });
      }
      doctor.sessionStarted = true;
      // Start on the first paid token; unpaid tokens are skipped
      doctor.currentQueueNumber = await firstPaidToken(doctor._id);
      if (!doctor.lastArrivalDate) {
        doctor.lastArrivalDate = new Date();
      }
    } else if (action === "end") {
      doctor.sessionStarted = false;
      doctor.currentQueueNumber = 0;
      doctor.sessionEndedToday = true;
      releasedNurse = doctor.allocatedNurse;
      doctor.allocatedNurse = ""; // Nurse is released immediately!

      // Mark today's approved schedule as sessionEnded: true and free the nurse allocation
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const todaySchedules = await ScheduleRequest.find({
        doctorId: doctor._id,
        status: "approved",
        date: { $gte: startOfDay, $lte: endOfDay }
      });

      for (const sched of todaySchedules) {
        sched.sessionEnded = true;
        sched.allocatedNurse = ""; // Release nurse so other doctor sessions can allocate this nurse
        await sched.save();
        if (req.io) {
          req.io.emit("scheduleUpdated", sched);
        }
      }
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

        if (req.io) {
          req.io.emit("appointmentUpdated", appt);
        }

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

    // Emit live updates to connected socket client rooms & globally for widgets
    if (req.io) {
      req.io.emit("doctorStatusUpdated", doctor);
      if (action === "end" && releasedNurse) {
        req.io.emit("nurseReleased", {
          doctorId: doctor._id,
          doctorName: doctor.name,
          nurseName: releasedNurse,
          timestamp: new Date()
        });
      }
      req.io.emit("queueUpdated", {
        doctorId: doctor._id,
        currentServingNumber: doctor.currentQueueNumber,
        currentToken: doctor.currentQueueNumber,
        isArrived: doctor.isArrived,
        sessionStarted: doctor.sessionStarted,
        sessionEndedToday: doctor.sessionEndedToday,
        allocatedRoom: doctor.allocatedRoom,
        allocatedNurse: doctor.allocatedNurse,
        lastUpdated: new Date()
      });
      
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const activeAppointments = await Appointment.find({
        doctorId: doctor._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ["confirmed", "Confirmed", "pending", "Pending", "Waiting"] },
        paymentStatus: "paid"
      });

      for (const appt of activeAppointments) {
        const peopleAhead = await countPaidAhead(appt, doctor.currentQueueNumber);
        req.io.to(`doctor:${doctor._id}`).emit("queueUpdated", {
          doctorId: doctor._id,
          currentServingNumber: doctor.currentQueueNumber,
          currentToken: doctor.currentQueueNumber,
          patientQueueNumber: appt.queueNumber,
          peopleAhead,
          lastUpdated: new Date()
        });

        // Create & emit real-time notifications for session start and queue progress
        try {
          const patientToken = appt.queueNumber || 0;
          // Paid patients ahead (unpaid tokens are skipped); 0 when it's this patient's turn
          const diff = patientToken === doctor.currentQueueNumber ? 0 : patientToken > doctor.currentQueueNumber ? peopleAhead : -1;

          if (action === "start") {
            const notif = await Notification.create({
              userId: appt.patientId,
              type: "reminder",
              title: "Channeling Session Started",
              message: `Dr. ${doctor.name} has started the session in ${doctor.allocatedRoom || "Room TBA"}. Your Token: #${patientToken} (Ongoing: #${doctor.currentQueueNumber}).`,
              metadata: { doctorId: doctor._id, appointmentId: appt._id, currentQueue: doctor.currentQueueNumber }
            });
            req.io.emit("newNotification", notif);
          } else if (doctor.currentQueueNumber > prevServing) {
            if (diff === 3) {
              const notif = await Notification.create({
                userId: appt.patientId,
                type: "reminder",
                title: "Queue Alert: 3 Patients Ahead",
                message: `Only 3 patients ahead of you (Token #${patientToken}) for Dr. ${doctor.name}. Please get ready.`,
                metadata: { doctorId: doctor._id, appointmentId: appt._id, currentQueue: doctor.currentQueueNumber }
              });
              req.io.emit("newNotification", notif);
            } else if (diff === 1) {
              const notif = await Notification.create({
                userId: appt.patientId,
                type: "reminder",
                title: "You Are Next in Queue!",
                message: `Token #${doctor.currentQueueNumber} is ongoing. Please proceed to ${doctor.allocatedRoom || "the consultation room"} for Dr. ${doctor.name}.`,
                metadata: { doctorId: doctor._id, appointmentId: appt._id, currentQueue: doctor.currentQueueNumber }
              });
              req.io.emit("newNotification", notif);
            } else if (diff === 0) {
              const notif = await Notification.create({
                userId: appt.patientId,
                type: "reminder",
                title: "Your Turn Now!",
                message: `Token #${patientToken} is now being called by Dr. ${doctor.name} in ${doctor.allocatedRoom || "the consultation room"}.`,
                metadata: { doctorId: doctor._id, appointmentId: appt._id, currentQueue: doctor.currentQueueNumber }
              });
              req.io.emit("newNotification", notif);
            }
          }
        } catch (notifErr) {
          console.error("Queue update notification error:", notifErr);
        }
      }
    }

    res.json(doctor);
  } catch (err) {
    console.error("Queue Update Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. GET PATIENT QUEUE STATUS (GET /api/queue/patient/:patientId)
// ==========================================
router.get("/patient/:patientId", protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let appt = null;
    if (req.query.appointmentId) {
      appt = await Appointment.findById(req.query.appointmentId);
    }

    if (!appt) {
      const candidatePatientIds = [req.params.patientId, req.user?.id].filter(Boolean);
      appt = await Appointment.findOne({
        patientId: { $in: candidatePatientIds },
        date: { $gte: today },
        status: { $ne: "cancelled" }
      }).sort({ date: 1 });
    }

    if (!appt) {
      return res.status(404).json({ msg: "No active appointment found" });
    }

    const doctor = appt.doctorId ? await Doctor.findById(appt.doctorId) : null;
    const currentServing = doctor?.currentQueueNumber || 0;
    // Unpaid patients keep their token but are not in the live queue until they pay
    const awaitingPayment = appt.paymentStatus !== "paid";
    const myQueueNumber = appt.queueNumber || null;
    const peopleAhead = awaitingPayment ? null : await countPaidAhead(appt, currentServing);

    res.json({
      appointmentId: appt._id,
      doctorName: doctor?.name || appt.doctorName || "Doctor",
      department: appt.department || doctor?.specialization || "General",
      allocatedRoom: doctor?.allocatedRoom || "Room TBA",
      appointmentStatus: appt.status || "confirmed",
      paymentStatus: appt.paymentStatus || "pending",
      awaitingPayment,
      appointmentDate: appt.date,
      isArrived: Boolean(doctor?.isArrived),
      sessionStarted: Boolean(doctor?.sessionStarted),
      queueNumber: myQueueNumber,
      currentServingNumber: currentServing,
      currentToken: currentServing,
      peopleAhead,
      lastUpdated: new Date()
    });
  } catch (err) {
    console.error("Patient Queue Status Error:", err);
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 3. GET DOCTOR LIVE QUEUE (GET /api/queue/doctor/:doctorId/live)
// ==========================================
router.get("/doctor/:doctorId/live", protect, async (req, res) => {
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
      status: { $in: ["confirmed", "Confirmed", "pending", "Pending", "Waiting"] },
      paymentStatus: "paid"
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
