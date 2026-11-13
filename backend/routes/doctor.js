import express from "express";
import { isValidPhone, PHONE_HINT } from "../utils/phone.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs"; 
import Doctor from "../models/Doctor.js";
import { isArrivedToday, isSessionLive, clearStaleSession } from "../utils/doctorSession.js";
import HospitalFinance from "../models/Finance.js"; 
import Appointment from "../models/Appointment.js";
import SurgeryRecord from "../models/SurgeryRecord.js"; 
import { createNotification } from "../utils/notificationHelper.js";
import { auth, authorize } from "../middleware/auth.js";
import { emitAppointmentUpdated, emitNotification, emitDoctorQueueChanged, emitDoctorStatus } from "../utils/realtime.js";

const router = express.Router();

// Every route here acts on the logged-in doctor's own account
router.use(auth, authorize(["doctor"]));

// HELPER FUNCTION: Calculate Total Income from Finance Records
const calculateTotalIncome = async (doctorId) => {
  const hospitals = await HospitalFinance.find({ doctorId }).select("records.type records.income records.amount").lean();
  let totalIncome = 0;
  hospitals.forEach(hospital => {
    if (hospital.records && hospital.records.length > 0) {
      hospital.records.forEach(rec => {
        if (rec.type === 'channeling') totalIncome += (rec.income || 0);
        else if (rec.type === 'surgical') totalIncome += (rec.amount || 0);
      });
    }
  });
  return Math.round(totalIncome);
};

// ---------------------------------------------
// 1. DASHBOARD STATS
// ---------------------------------------------
router.get("/dashboard-stats", auth, async (req, res) => {
  try {
    const doctorId = req.user.id;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const today = { $gte: startOfDay, $lte: endOfDay };

    // Everything below is independent, so fetch it in one parallel round trip
    const [doctor, todaySchedule, recordCount, totalIncome, todayAppointmentsCount, todayArrivalsCount] = await Promise.all([
      Doctor.findById(doctorId)
        .select("name fullName specialization profileImage channelingTime isArrived channelingStatus currentQueueNumber allocatedRoom")
        .lean(),
      mongoose.model('ScheduleRequest')
        .findOne({ doctorId, status: 'approved', date: today })
        .select("startTime allocatedRoom")
        .sort({ startTime: 1 })
        .lean()
        .catch((err) => {
          console.error("Schedule search failed:", err.message);
          return null;
        }),
      SurgeryRecord.countDocuments({ doctorId }).catch(() => 0),
      calculateTotalIncome(doctorId),
      Appointment.countDocuments({ doctorId, date: today, status: { $ne: "cancelled" } }),
      Appointment.countDocuments({ doctorId, date: today, status: { $ne: "cancelled" }, arrived: true }),
    ]);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    let channelingTime = doctor.channelingTime;
    let allocatedRoom = doctor.allocatedRoom;
    if (todaySchedule && (!channelingTime || !allocatedRoom)) {
      channelingTime = channelingTime || new Date(todaySchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      allocatedRoom = allocatedRoom || todaySchedule.allocatedRoom;
    }

    res.json({
      name: doctor.name || doctor.fullName || "Doctor",
      specialization: doctor.specialization || "Specialist",
      profileImage: doctor.profileImage || "",
      channelingTime,
      channelingStatus: doctor.channelingStatus,
      currentQueueNumber: doctor.currentQueueNumber || 0,
      allocatedRoom: allocatedRoom || "TBA",
      isArrived: doctor.isArrived,
      income: totalIncome,
      records: recordCount,
      todayAppointmentsCount,
      todayArrivalsCount
    });

  } catch (err) {
    console.error("Dashboard Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 1.1 TODAY'S APPOINTMENTS (patients the doctor can open records for)
// ---------------------------------------------
router.get("/today-appointments", auth, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await Appointment.find({
      doctorId: req.user.id,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" },
      paymentStatus: "paid"
    })
      .populate("patientId", "fullName patientId nicNumber gender dateOfBirth profileImage")
      .sort({ queueNumber: 1 })
      .lean();

    const doctor = await Doctor.findById(req.user.id)
      .select("currentQueueNumber sessionStarted sessionEndedToday isArrived lastArrivalDate allocatedRoom")
      .lean();

    res.json({
      appointments: appointments.filter(a => a.patientId),
      session: {
        currentQueueNumber: doctor?.currentQueueNumber || 0,
        sessionStarted: isSessionLive(doctor),
        sessionEndedToday: Boolean(doctor?.sessionEndedToday),
        isArrived: isArrivedToday(doctor),
        allocatedRoom: doctor?.allocatedRoom || null
      }
    });
  } catch (err) {
    console.error("Today Appointments Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 2. GET PROFILE
// ---------------------------------------------
router.get("/profile", auth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select("-password");
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    const totalEarnings = await calculateTotalIncome(req.user.id);

    res.json({
      fullName: doctor.fullName || doctor.name,
      nameWithInitials: doctor.nameWithInitials || doctor.name,
      nic: doctor.nic || "N/A",
      phone: doctor.phone || "N/A",
      email: doctor.email,
      specialization: doctor.specialization || "General Physician",
      slmcReg: doctor.slmcReg || "",
      profileImage: doctor.profileImage || null,
      hospital: doctor.hospital || "SUWASEWANA HOSPITAL",
      subscription: doctor.subscription || { plan: 'free', status: 'active' },
      totalEarnings: totalEarnings
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 3. UPDATE PROFILE
// ---------------------------------------------
router.put("/profile", auth, async (req, res) => {
  try {
    const { fullName, nameWithInitials, nic, phone, profileImage, specialization } = req.body;
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ msg: PHONE_HINT, message: PHONE_HINT });
    }

    // Email and SLMC number are managed by the hospital, not the doctor
    const current = await Doctor.findById(req.user.id).select("email slmcReg");
    if (!current) return res.status(404).json({ msg: "Doctor not found" });
    const lockedChanged = ["email", "slmcReg"].some(
      (field) => req.body[field] !== undefined && req.body[field] !== current[field]
    );
    if (lockedChanged) {
      return res.status(403).json({ msg: "Email and SLMC number can only be changed by the hospital." });
    }
    if (fullName !== undefined && !String(fullName).trim()) {
      return res.status(400).json({ msg: "Full name is required." });
    }
    if (specialization !== undefined && !String(specialization).trim()) {
      return res.status(400).json({ msg: "Department is required." });
    }

    const updatedDoctor = await Doctor.findByIdAndUpdate(
      req.user.id,
      { $set: { fullName, nameWithInitials, nic, phone, profileImage, specialization } },
      { new: true }
    ).select("-password");

    res.json({ msg: "Profile Updated", doctor: updatedDoctor });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 4. CHANGE PASSWORD
// ---------------------------------------------
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const doctor = await Doctor.findById(req.user.id).select("+password");

    const isMatch = await bcrypt.compare(currentPassword, doctor.password);
    if (!isMatch) return res.status(400).json({ msg: "Incorrect current password" });

    const salt = await bcrypt.genSalt(10);
    doctor.password = await bcrypt.hash(newPassword, salt);

    await doctor.save();
    res.json({ msg: "Password Changed Successfully" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 5. UPDATE DELAY STATUS (Improved Notification Logic)
// ---------------------------------------------
router.put("/delay-status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    const previousStatus = doctor.channelingStatus;
    doctor.channelingStatus = status;
    await doctor.save();

    // Notify if status has changed to ANY delay or back to On Time
    if (status !== previousStatus) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const activeAppointments = await Appointment.find({
        doctorId: doctor._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ["confirmed", "Confirmed", "pending", "Pending", "completed", "Completed"] }
      });

      if (activeAppointments.length > 0) {
        const message = status === "On Time" 
            ? `Good news! Dr. ${doctor.name} is now on time.` 
            : `Dr. ${doctor.name} is now ${status.toLowerCase()}. Please plan accordingly.`;

        const notificationPromises = activeAppointments.map(async (app) => {
          const notif = await createNotification(
            app.patientId,
            'doctor_status',
            message,
            { doctorId: doctor._id, appointmentId: app._id, status: status },
            'Clinic Status Update'
          );
          if (req.io && notif) {
            emitNotification(req.io, notif);
          }
          return notif;
        });
        await Promise.all(notificationPromises);
      }
    }
    
    if (req.io) {
      emitDoctorStatus(req.io, doctor);
      emitDoctorQueueChanged(doctor._id);
      req.io.emit("doctorDelayAlert", {
        doctorId: doctor._id,
        doctorName: doctor.name,
        specialization: doctor.specialization,
        channelingStatus: doctor.channelingStatus,
        status: doctor.channelingStatus,
        previousStatus,
        allocatedNurse: doctor.allocatedNurse,
        allocatedRoom: doctor.allocatedRoom,
        channelingTime: doctor.channelingTime,
        timestamp: new Date()
      });
    }

    res.json({ msg: "Delay Status Updated", status: doctor.channelingStatus });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ---------------------------------------------
// 6. UPDATE ARRIVAL STATUS
// ---------------------------------------------
router.put("/arrival-status", auth, async (req, res) => {
  try {
    const { isArrived } = req.body;
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    const previousArrived = doctor.isArrived;
    doctor.isArrived = isArrived;
    if (isArrived === true) {
      clearStaleSession(doctor);
      doctor.lastArrivalDate = new Date();
      if (doctor.channelingStatus && doctor.channelingStatus.toLowerCase() !== "on time") {
        doctor.channelingStatus = "On Time";
      }
    }
    await doctor.save();

    if (isArrived === true && !previousArrived) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const activeAppointments = await Appointment.find({
        doctorId: doctor._id,
        date: { $gte: startOfDay, $lte: endOfDay },
        status: { $in: ["confirmed", "Confirmed", "pending", "Pending"] }
      });

      if (activeAppointments.length > 0) {
        const notificationPromises = activeAppointments.map(async (app) => {
          const timeInfo = doctor.channelingTime 
            ? `Sessions start around ${doctor.channelingTime}.` 
            : "Sessions will begin shortly.";

          const notif = await createNotification(
            app.patientId,
            'arrival',
            `Dr. ${doctor.name} has arrived at the clinic (${doctor.allocatedRoom || 'Room TBA'}). ${timeInfo}`,
            { doctorId: doctor._id, appointmentId: app._id },
            'Doctor Arrived'
          );
          if (req.io && notif) {
            emitNotification(req.io, notif);
          }
          return notif;
        });
        await Promise.all(notificationPromises);
      }
    }
    
    if (req.io) {
      emitDoctorStatus(req.io, doctor);
      emitDoctorQueueChanged(doctor._id);
      req.io.emit("doctorArrivalAlert", {
        doctorId: doctor._id,
        doctorName: doctor.name,
        specialization: doctor.specialization,
        isArrived: doctor.isArrived,
        allocatedNurse: doctor.allocatedNurse,
        allocatedRoom: doctor.allocatedRoom,
        channelingTime: doctor.channelingTime,
        timestamp: new Date()
      });
    }

    res.json({ msg: "Arrival Status Updated", isArrived: doctor.isArrived });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;
