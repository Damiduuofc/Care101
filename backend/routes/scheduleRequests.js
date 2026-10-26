import express from 'express';
import ScheduleRequest from '../models/ScheduleRequest.js';
import Doctor from '../models/Doctor.js';
import Notification from '../models/Notification.js';
import { auth } from '../middleware/auth.js';
import { findAutoAllocation, ROOM_DEPARTMENTS, getDoctorDept } from '../utils/autoAllocate.js';

const router = express.Router();

// Bookable hours for doctor sessions (matches OPD hours: 8 AM - 11 PM)
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;

const formatHour = (h) => {
  const period = h >= 12 && h < 24 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:00 ${period}`;
};

// Build an hour-by-hour timeline for a date in a doctor's department.
// An hour is blocked only when every room in that department is already used
// (or the hour is in the past). No doctor names or room counts are exposed.
const buildDeptTimeline = async (dateInput, specialization) => {
  const dept = getDoctorDept(specialization || 'General Medicine');
  const totalDeptRooms = Object.values(ROOM_DEPARTMENTS).filter(d => d === dept).length;

  const dateOnlyStr = String(dateInput).split('T')[0];
  const [year, month, day] = dateOnlyStr.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  const approvedSchedules = await ScheduleRequest.find({
    status: 'approved',
    sessionEnded: { $ne: true },
    startTime: { $lt: endOfDay },
    endTime: { $gt: startOfDay }
  }).populate('doctorId', 'specialization');

  const deptSchedules = approvedSchedules.filter(s => {
    if (s.allocatedRoom && ROOM_DEPARTMENTS[s.allocatedRoom]) {
      return ROOM_DEPARTMENTS[s.allocatedRoom] === dept;
    }
    return getDoctorDept(s.doctorId?.specialization) === dept;
  });

  const now = new Date();
  const timeline = [];
  for (let hour = DAY_START_HOUR; hour < DAY_END_HOUR; hour++) {
    const slotStart = new Date(year, month - 1, day, hour, 0, 0, 0);
    const slotEnd = new Date(year, month - 1, day, hour + 1, 0, 0, 0);
    const isPast = slotEnd <= now;
    const used = deptSchedules.filter(s => new Date(s.startTime) < slotEnd && new Date(s.endTime) > slotStart).length;
    const isFull = used >= totalDeptRooms;

    timeline.push({
      hour,
      startLabel: formatHour(hour),
      endLabel: formatHour(hour + 1),
      startHourStr: `${String(hour).padStart(2, '0')}:00`,
      endHourStr: `${String(hour + 1).padStart(2, '0')}:00`,
      isAvailable: !isPast && !isFull,
      isPast
    });
  }

  return { dept, dateOnlyStr, year, month, day, timeline };
};

// Returns an error message if [start, end) touches a blocked hour, otherwise null.
const validateRangeAgainstTimeline = async (dateInput, specialization, start, end) => {
  if (end <= start) return 'End time must be after start time.';
  const { dept, year, month, day, timeline } = await buildDeptTimeline(dateInput, specialization);
  const dayStart = new Date(year, month - 1, day, DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(year, month - 1, day, DAY_END_HOUR, 0, 0, 0);
  if (start < dayStart || end > dayEnd) {
    return `Sessions must be between ${formatHour(DAY_START_HOUR)} and ${formatHour(DAY_END_HOUR)}.`;
  }
  const blocked = timeline.find(slot => {
    const slotStart = new Date(year, month - 1, day, slot.hour, 0, 0, 0);
    const slotEnd = new Date(year, month - 1, day, slot.hour + 1, 0, 0, 0);
    return !slot.isAvailable && start < slotEnd && end > slotStart;
  });
  if (blocked) {
    return `${blocked.startLabel} – ${blocked.endLabel} is not available in ${dept}. Please pick free hours only.`;
  }
  return null;
};

// 0. AVAILABILITY: hour-by-hour timeline for a date (doctor = self, receptionist passes doctorId)
router.get('/availability', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ msg: 'Date parameter is required' });

    const targetDoctorId = req.query.doctorId || req.user?.id;
    let specialization = req.query.specialization;
    if (!specialization && targetDoctorId) {
      const doc = await Doctor.findById(targetDoctorId).select('specialization').catch(() => null);
      if (doc) specialization = doc.specialization;
    }

    const { dept, dateOnlyStr, timeline } = await buildDeptTimeline(date, specialization);
    res.json({ date: dateOnlyStr, department: dept, timeline });
  } catch (err) {
    console.error('Availability Error:', err);
    res.status(500).json({ msg: 'Server error fetching availability' });
  }
});

// 1. DOCTOR: Send a schedule request
router.post('/request', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, isUnlimited, queueLimit } = req.body;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ msg: 'Date, start time, and end time are required' });
    }
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) return res.status(404).json({ msg: 'Doctor not found' });

    const pStart = new Date(startTime);
    const pEnd = new Date(endTime);
    if (pEnd <= pStart) {
      return res.status(400).json({ msg: 'End time must be after start time' });
    }

    if (!isUnlimited && !(Number(queueLimit) >= 1)) {
      return res.status(400).json({ msg: 'Queue limit must be at least 1, or choose unlimited.' });
    }

    const rangeError = await validateRangeAgainstTimeline(date, doctor.specialization, pStart, pEnd);
    if (rangeError) return res.status(400).json({ msg: rangeError });

    const newRequest = new ScheduleRequest({
      doctorId: req.user.id,
      doctorName: doctor.name || doctor.fullName || 'Doctor',
      date: new Date(date),
      startTime: pStart,
      endTime: pEnd,
      isUnlimited,
      queueLimit: isUnlimited ? null : queueLimit
    });

    const savedRequest = await newRequest.save();
    res.status(201).json({ msg: 'Schedule request sent successfully', request: savedRequest });
  } catch (err) {
    console.error('Doctor Schedule Request Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 3. RECEPTIONIST: Get pending requests
router.get('/pending', auth, async (req, res) => {
  try {
    let query = { status: 'pending' };

    if (req.query.date) {
      const startOfDay = new Date(req.query.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(req.query.date);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const pendingRequests = await ScheduleRequest.find(query)
      .populate('doctorId', 'name specialization profileImage')
      .sort({ date: 1 });

    res.json(pendingRequests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// 4. RECEPTIONIST: Get all requests
router.get('/all', auth, async (req, res) => {
  try {
    const requests = await ScheduleRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 5. RECEPTIONIST/ADMIN: Accept/Reject/Cancel & Sync to Doctor Model
// ==========================================
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    let { allocatedRoom, allocatedNurse } = req.body;
    
    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status. Must be approved, rejected, or cancelled.' });
    }

    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    const userRole = req.user?.role;
    const isOwner = req.user?.id === request.doctorId.toString();
    const isAdmin = ['receptionist', 'system_admin', 'admin'].includes(userRole);

    if (status === 'approved' && !isAdmin) {
      return res.status(403).json({ msg: 'Only receptionists and administrators can approve schedule requests.' });
    }

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ msg: 'Not authorized to change this schedule.' });
    }

    const wasApproved = request.status === 'approved';

    if (status === 'approved') {
      // ✅ AUTO-ASSIGN any room/nurse the approver didn't pick
      if (!allocatedRoom || !allocatedNurse) {
        const doctor = await Doctor.findById(request.doctorId).select('specialization');
        const auto = await findAutoAllocation(request, doctor?.specialization);
        allocatedRoom = allocatedRoom || auto.room;
        allocatedNurse = allocatedNurse || auto.nurse;
      }

      // ✅ CONFLICT CHECK
      if (allocatedRoom || allocatedNurse) {
        const conflict = await ScheduleRequest.findOne({
          _id: { $ne: request._id },
          status: 'approved',
          sessionEnded: { $ne: true },
          $or: [
            { allocatedRoom: allocatedRoom || "NEVER_MATCH" },
            { allocatedNurse: allocatedNurse || "NEVER_MATCH" }
          ],
          startTime: { $lt: request.endTime },
          endTime: { $gt: request.startTime }
        });

        if (conflict) {
          const type = conflict.allocatedRoom === allocatedRoom ? 'Room' : 'Nurse';
          return res.status(409).json({ 
            msg: `Conflict: ${type} is already booked by ${conflict.doctorName}.`
          });
        }
      }

      // ✅ UPDATE SCHEDULE REQUEST OBJECT
      if (allocatedRoom !== undefined) request.allocatedRoom = allocatedRoom;
      if (allocatedNurse !== undefined) request.allocatedNurse = allocatedNurse;

      // ✅ SYNC TO DOCTOR MODEL
      const now = new Date();
      const isToday = new Date(request.date).toDateString() === now.toDateString();
      if (isToday) {
        await Doctor.findByIdAndUpdate(request.doctorId, {
          $set: {
            allocatedRoom: allocatedRoom || request.allocatedRoom,
            allocatedNurse: allocatedNurse || request.allocatedNurse,
            sessionEndedToday: false
          }
        });
      }
    } else {
      // ✅ WHEN REJECTING OR CANCELLING
      request.allocatedRoom = "";
      request.allocatedNurse = "";

      // Release Doctor's live room if no other approved schedule exists for today
      const now = new Date();
      const isToday = new Date(request.date).toDateString() === now.toDateString();
      if (isToday || wasApproved) {
        const otherApproved = await ScheduleRequest.findOne({
          _id: { $ne: request._id },
          doctorId: request.doctorId,
          status: 'approved',
          date: request.date
        });

        if (!otherApproved) {
          await Doctor.findByIdAndUpdate(request.doctorId, {
            $set: {
              allocatedRoom: "",
              allocatedNurse: "",
              channelingTime: ""
            }
          });
        } else {
          await Doctor.findByIdAndUpdate(request.doctorId, {
            $set: {
              allocatedRoom: otherApproved.allocatedRoom || "",
              allocatedNurse: otherApproved.allocatedNurse || ""
            }
          });
        }
      }

      // If this schedule was previously approved, cancel any booked appointments and notify patients
      if (wasApproved) {
        try {
          const Appointment = (await import('../models/Appointment.js')).default;
          const startOfDay = new Date(request.date);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(request.date);
          endOfDay.setHours(23, 59, 59, 999);

          const affectedAppointments = await Appointment.find({
            doctorId: request.doctorId,
            date: { $gte: startOfDay, $lte: endOfDay },
            status: { $ne: 'cancelled' }
          });

          for (const appt of affectedAppointments) {
            appt.status = 'cancelled';
            await appt.save();
            await Notification.create({
              userId: appt.patientId,
              type: 'cancellation',
              message: `Your appointment #${appt.queueNumber || ''} with Dr. ${request.doctorName} on ${new Date(appt.date).toLocaleDateString()} has been cancelled because the doctor's schedule was cancelled.`,
              data: { appointmentId: appt._id }
            });
            if (req.io) {
              req.io.emit("appointmentUpdated", appt);
            }
          }
        } catch (apptErr) {
          console.error("Failed to cancel associated appointments on schedule cancellation:", apptErr);
        }
      }
    }

    request.status = status;
    await request.save();

    // ✅ NOTIFY DOCTOR
    const actionLabel = status === 'approved' ? 'APPROVED' : status === 'cancelled' ? 'CANCELLED' : 'REJECTED';
    const doctorNotification = new Notification({
      userId: request.doctorId,
      type: 'schedule_request',
      message: status === 'approved' 
        ? `Your schedule for ${new Date(request.date).toDateString()} was APPROVED. Room: ${request.allocatedRoom || 'TBA'}, Nurse: ${request.allocatedNurse || 'TBA'}`
        : `Your schedule for ${new Date(request.date).toDateString()} was ${actionLabel}.`,
      data: { 
        requestId: request._id,
        status: status,
        allocatedRoom: request.allocatedRoom || 'TBA',
        allocatedNurse: request.allocatedNurse || 'TBA'
      }
    });

    await doctorNotification.save();

    if (req.io) {
      req.io.emit("scheduleUpdated", request);
    }

    res.json({ msg: `Request has been ${status}`, request });

  } catch (err) {
    console.error('Update Status Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 2. DOCTOR: Get my requests (Finalized Population)
// ==========================================
router.get('/my-requests', auth, async (req, res) => {
  try {
    const requests = await ScheduleRequest.find({ doctorId: req.user.id })
      .populate('doctorId', 'allocatedRoom allocatedNurse') 
      .sort({ createdAt: -1 });

    const formattedRequests = requests.map(reqObj => {
      const schedule = reqObj.toObject();
      return {
        ...schedule,
        // Check schedule first, then doctor model, then default to TBD/TBA
        allocatedRoom: schedule.allocatedRoom || schedule.doctorId?.allocatedRoom || 'TBA',
        allocatedNurse: schedule.allocatedNurse || schedule.doctorId?.allocatedNurse || 'TBD'
      };
    });

    res.json(formattedRequests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});
// 6. PATIENT: Get approved schedules
router.get('/doctor/:doctorId/approved', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const approvedSchedules = await ScheduleRequest.find({
      doctorId: req.params.doctorId,
      status: 'approved',
      date: { $gte: today }
    }).sort({ date: 1 });
    res.json(approvedSchedules);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});


// 7. RECEPTIONIST: Today's Approved or by specified Date
router.get('/approved/today', auth, async (req, res) => {
  try {
    let query = { status: 'approved' };

    if (req.query.all !== 'true') {
      let startOfDay = new Date();
      let endOfDay = new Date();

      if (req.query.date) {
        startOfDay = new Date(req.query.date);
        endOfDay = new Date(req.query.date);
      }

      startOfDay.setHours(0, 0, 0, 0);
      endOfDay.setHours(23, 59, 59, 999);

      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const schedules = await ScheduleRequest.find(query)
      .populate('doctorId', 'name specialization profileImage')
      .sort({ startTime: 1 });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// 7.0 RECEPTIONIST: Suggest an available room and nurse for a request
router.get('/:id/auto-allocation', auth, async (req, res) => {
  try {
    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    const doctor = await Doctor.findById(request.doctorId).select('specialization');
    const { room, nurse } = await findAutoAllocation(request, doctor?.specialization);
    res.json({ allocatedRoom: room, allocatedNurse: nurse });
  } catch (err) {
    console.error('Auto Allocation Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 7.1 RECEPTIONIST: Allocate room and nurse to an approved schedule
router.put('/:id/allocate', auth, async (req, res) => {
  try {
    const { allocatedRoom, allocatedNurse } = req.body;

    // Check authorization (Only receptionist or system_admin)
    if (!['receptionist', 'system_admin'].includes(req.user?.role)) {
      return res.status(403).json({ msg: 'Not authorized. Only receptionists and system admins can allocate rooms.' });
    }

    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    // Enforce overlapping conflicts
    if (allocatedRoom || allocatedNurse) {
      const conflict = await ScheduleRequest.findOne({
        _id: { $ne: request._id },
        status: 'approved',
        sessionEnded: { $ne: true },
        date: request.date,
        $or: [
          { allocatedRoom: allocatedRoom || "NEVER_MATCH" },
          { allocatedNurse: allocatedNurse || "NEVER_MATCH" }
        ],
        startTime: { $lt: request.endTime },
        endTime: { $gt: request.startTime }
      });

      if (conflict) {
        const type = conflict.allocatedRoom === allocatedRoom ? 'Room' : 'Nurse';
        return res.status(409).json({ 
          msg: `Conflict: ${type} is already booked by ${conflict.doctorName} at this time.`
        });
      }
    }

    request.allocatedRoom = allocatedRoom || "";
    request.allocatedNurse = allocatedNurse || "";
    await request.save();

    // Sync to Doctor model if the schedule is today
    const now = new Date();
    const isToday = new Date(request.date).toDateString() === now.toDateString();
    if (isToday) {
      await Doctor.findByIdAndUpdate(request.doctorId, {
        $set: {
          allocatedRoom: allocatedRoom || "",
          allocatedNurse: allocatedNurse || "",
          sessionEndedToday: false
        }
      });
    }

    res.json({ msg: 'Allocation successful', request });
  } catch (err) {
    console.error('Allocation Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 8. RECEPTIONIST/ADMIN: Create a schedule on behalf of a doctor
router.post('/admin/create', auth, async (req, res) => {
  try {
    const { doctorId, date, startTime, endTime, isUnlimited, queueLimit } = req.body;

    // Check authorization (Only receptionist or system_admin)
    if (!['receptionist', 'system_admin'].includes(req.user?.role)) {
      return res.status(403).json({ msg: 'Not authorized. Only receptionists and system admins can perform this action.' });
    }

    if (!doctorId || !date || !startTime || !endTime) {
      return res.status(400).json({ msg: 'Doctor ID, date, start time, and end time are required.' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ msg: 'Doctor not found.' });

    const parsedDate = new Date(date);
    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (parsedEndTime <= parsedStartTime) {
      return res.status(400).json({ msg: 'End time must be after start time.' });
    }

    const rangeError = await validateRangeAgainstTimeline(date, doctor.specialization, parsedStartTime, parsedEndTime);
    if (rangeError) return res.status(400).json({ msg: rangeError });

    const newRequest = new ScheduleRequest({
      doctorId,
      doctorName: doctor.name || doctor.fullName || 'Doctor',
      date: parsedDate,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      isUnlimited,
      queueLimit: isUnlimited ? null : queueLimit,
      status: 'approved' // Automatically approved
    });

    const auto = await findAutoAllocation(newRequest, doctor.specialization);
    newRequest.allocatedRoom = auto.room;
    newRequest.allocatedNurse = auto.nurse;

    const savedRequest = await newRequest.save();

    if (parsedDate.toDateString() === new Date().toDateString()) {
      await Doctor.findByIdAndUpdate(doctorId, {
        $set: { allocatedRoom: auto.room, allocatedNurse: auto.nurse, sessionEndedToday: false }
      });
    }

    // Create a Notification for the doctor
    const doctorNotification = new Notification({
      userId: doctorId,
      type: 'schedule_request',
      message: `A new schedule for ${parsedDate.toDateString()} was created and approved for you by the administration. Room: ${savedRequest.allocatedRoom || 'TBA'}`,
      data: { 
        requestId: savedRequest._id,
        status: 'approved',
        allocatedRoom: savedRequest.allocatedRoom || 'TBA',
        allocatedNurse: savedRequest.allocatedNurse || 'TBA'
      }
    });
    await doctorNotification.save();

    res.status(201).json({ msg: 'Schedule created and approved successfully', request: savedRequest });
  } catch (err) {
    console.error('Admin Create Schedule Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 9. DELETE SCHEDULE REQUEST (Full Deletion)
// ==========================================
router.delete('/:id', auth, async (req, res) => {
  try {
    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Schedule request not found' });
    }

    const userRole = req.user?.role;
    const isOwner = req.user?.id === request.doctorId.toString();
    const isAdmin = ['receptionist', 'system_admin', 'admin'].includes(userRole);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ msg: 'Not authorized to delete this schedule request.' });
    }

    const wasApproved = request.status === 'approved';

    // 1. Release doctor's allocatedRoom and allocatedNurse if needed
    const now = new Date();
    const isToday = new Date(request.date).toDateString() === now.toDateString();
    if (isToday || wasApproved) {
      const otherApproved = await ScheduleRequest.findOne({
        _id: { $ne: request._id },
        doctorId: request.doctorId,
        status: 'approved',
        date: request.date
      });

      if (!otherApproved) {
        await Doctor.findByIdAndUpdate(request.doctorId, {
          $set: {
            allocatedRoom: "",
            allocatedNurse: "",
            channelingTime: ""
          }
        });
      } else {
        await Doctor.findByIdAndUpdate(request.doctorId, {
          $set: {
            allocatedRoom: otherApproved.allocatedRoom || "",
            allocatedNurse: otherApproved.allocatedNurse || ""
          }
        });
      }
    }

    // 2. If was approved, cancel associated appointments and notify patients
    let cancelledAppointmentsCount = 0;
    if (wasApproved) {
      try {
        const Appointment = (await import('../models/Appointment.js')).default;
        const startOfDay = new Date(request.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(request.date);
        endOfDay.setHours(23, 59, 59, 999);

        const affectedAppointments = await Appointment.find({
          doctorId: request.doctorId,
          date: { $gte: startOfDay, $lte: endOfDay },
          status: { $ne: 'cancelled' }
        });

        cancelledAppointmentsCount = affectedAppointments.length;
        for (const appt of affectedAppointments) {
          appt.status = 'cancelled';
          await appt.save();
          await Notification.create({
            userId: appt.patientId,
            type: 'cancellation',
            title: 'Appointment Cancelled',
            message: `Your appointment with Dr. ${request.doctorName} on ${new Date(appt.date).toLocaleDateString()} has been cancelled because the doctor schedule was deleted.`,
            data: { appointmentId: appt._id }
          });
          if (req.io) {
            req.io.emit("appointmentUpdated", appt);
          }
        }
      } catch (apptErr) {
        console.error("Failed to cancel associated appointments on delete:", apptErr);
      }
    }

    // 3. Delete the schedule request completely
    await ScheduleRequest.findByIdAndDelete(req.params.id);

    // 4. Notify doctor if deleted by admin
    if (isAdmin && !isOwner) {
      try {
        await Notification.create({
          userId: request.doctorId,
          type: 'schedule_request',
          message: `Your schedule for ${new Date(request.date).toDateString()} (${new Date(request.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}) was deleted by administration.`,
          data: { requestId: request._id, status: 'deleted' }
        });
      } catch (notifErr) {
        console.error("Notification Error on Delete:", notifErr);
      }
    }

    // 5. Emit socket event
    if (req.io) {
      req.io.emit("scheduleDeleted", { id: req.params.id, doctorId: request.doctorId });
    }

    res.json({
      msg: 'Schedule request deleted successfully',
      id: req.params.id,
      cancelledAppointmentsCount
    });

  } catch (err) {
    console.error('Delete Schedule Request Error:', err);
    res.status(500).json({ msg: 'Server error deleting schedule request' });
  }
});

export default router;
