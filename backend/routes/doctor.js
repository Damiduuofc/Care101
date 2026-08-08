import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs"; 
import Doctor from "../models/Doctor.js";
import HospitalFinance from "../models/Finance.js"; 
import Appointment from "../models/Appointment.js";
import SurgeryRecord from "../models/SurgeryRecord.js"; 
import { createNotification } from "../utils/notificationHelper.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// HELPER FUNCTION: Calculate Total Income from Finance Records
const calculateTotalIncome = async (doctorId) => {
  const hospitals = await HospitalFinance.find({ doctorId });
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

    let doctor = await Doctor.findById(doctorId).select("name fullName specialization channelingTime isArrived channelingStatus currentQueueNumber allocatedRoom");
    if (!doctor) return res.status(404).json({ msg: "Doctor not found" });

    let channelingTime = doctor.channelingTime;
    let allocatedRoom = doctor.allocatedRoom;

    if (!channelingTime || !allocatedRoom) {
      try {
        const ScheduleRequest = mongoose.model('ScheduleRequest');
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const todaySchedule = await ScheduleRequest.findOne({
          doctorId,
          status: 'approved',
          date: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ startTime: 1 });

        if (todaySchedule) {
          channelingTime = channelingTime || new Date(todaySchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          allocatedRoom = allocatedRoom || todaySchedule.allocatedRoom;
        }
      } catch (err) {
        console.error("Schedule search failed:", err.message);
      }
    }

    const recordCount = await SurgeryRecord.countDocuments({ doctorId }).catch(() => 0);
    const totalIncome = await calculateTotalIncome(doctorId);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayAppointmentsCount = await Appointment.countDocuments({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" }
    });

    const todayArrivalsCount = await Appointment.countDocuments({
      doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: "cancelled" },
      arrived: true
    });

    res.json({
      name: doctor.name || doctor.fullName || "Doctor",
      specialization: doctor.specialization || "Specialist",
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
    const { fullName, nameWithInitials, nic, phone, profileImage } = req.body;
    const updatedDoctor = await Doctor.findByIdAndUpdate(
      req.user.id,
      { $set: { fullName, nameWithInitials, nic, phone, profileImage } },
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
    const doctor = await Doctor.findById(req.user.id);

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

        const notificationPromises = activeAppointments.map(app => 
          createNotification(
            app.patientId,
            'doctor_status',
            message,
            { doctorId: doctor._id, appointmentId: app._id, status: status },
            'Clinic Status Update'
          )
        );
        await Promise.all(notificationPromises);
      }
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
        const notificationPromises = activeAppointments.map(app => {
          const timeInfo = doctor.channelingTime 
            ? `Sessions start around ${doctor.channelingTime}.` 
            : "Sessions will begin shortly.";

          return createNotification(
            app.patientId,
            'arrival',
            `Dr. ${doctor.name} has arrived at the clinic. ${timeInfo}`,
            { doctorId: doctor._id, appointmentId: app._id },
            'Doctor Arrived'
          );
        });
        await Promise.all(notificationPromises);
      }
    }
    
    res.json({ msg: "Arrival Status Updated", isArrived: doctor.isArrived });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;
