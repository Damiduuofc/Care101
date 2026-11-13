import express from 'express';
import { escapeRegex } from '../utils/access.js';
import ScheduleRequest from '../models/ScheduleRequest.js';
import Doctor from '../models/Doctor.js';
import Admin from '../models/Admin.js';
import Notification from '../models/Notification.js';
import { auth, authorize, ROLES } from '../middleware/auth.js';
import { findAutoAllocation, ROOM_DEPARTMENTS, getDoctorDept } from '../utils/autoAllocate.js';
import { emitAppointmentUpdated, emitNotification } from '../utils/realtime.js';
import { describeSession, cancelAppointment } from '../utils/bookingService.js';
import { dayRange } from '../utils/queueToken.js';
import { syncDoctorLiveAllocation } from '../utils/liveAllocation.js';

const router = express.Router();

// Bookable hours for doctor sessions (matches OPD hours: 8 AM - 11 PM)
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 23;

const formatHour = (h) => {
  const period = h >= 12 && h < 24 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:00 ${period}`;
};

// Approved, still-running sessions in `dept` that overlap [from, to).
const fetchDeptSchedules = async (dept, from, to) => {
  const approvedSchedules = await ScheduleRequest.find({
    status: 'approved',
    sessionEnded: { $ne: true },
    startTime: { $lt: to },
    endTime: { $gt: from }
  }).populate('doctorId', 'specialization');

  return approvedSchedules.filter(s => {
    if (s.allocatedRoom && ROOM_DEPARTMENTS[s.allocatedRoom]) {
      return ROOM_DEPARTMENTS[s.allocatedRoom] === dept;
    }
    return getDoctorDept(s.doctorId?.specialization) === dept;
  });
};

const countDeptRooms = (dept) => Object.values(ROOM_DEPARTMENTS).filter(d => d === dept).length;

// Hour-by-hour slots for one calendar day, given the department's sessions.
const computeDayTimeline = (year, month, day, deptSchedules, totalDeptRooms, now = new Date()) => {
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
  return timeline;
};

// Build an hour-by-hour timeline for a date in a doctor's department.
// An hour is blocked only when every room in that department is already used
// (or the hour is in the past). No doctor names or room counts are exposed.
const buildDeptTimeline = async (dateInput, specialization) => {
  const dept = getDoctorDept(specialization || 'General Medicine');
  const totalDeptRooms = countDeptRooms(dept);

  const dateOnlyStr = String(dateInput).split('T')[0];
  const [year, month, day] = dateOnlyStr.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  const deptSchedules = await fetchDeptSchedules(dept, startOfDay, endOfDay);
  const timeline = computeDayTimeline(year, month, day, deptSchedules, totalDeptRooms);

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

const resolveSpecialization = async (req) => {
  const targetDoctorId = req.query.doctorId || req.user?.id;
  let specialization = req.query.specialization;
  if (!specialization && targetDoctorId) {
    const doc = await Doctor.findById(targetDoctorId).select('specialization').catch(() => null);
    if (doc) specialization = doc.specialization;
  }
  return specialization;
};

// 0a. AVAILABILITY CALENDAR: free-hour count per day, so the doctor can see
// which days are open before picking one. ?from=YYYY-MM-DD&days=N (max 90)
router.get('/availability/summary', auth, authorize(["doctor", ...ROLES.SCHEDULING]), async (req, res) => {
  try {
    const now = new Date();
    const fromStr = String(req.query.from || '').split('T')[0];
    const [fy, fm, fd] = /^\d{4}-\d{2}-\d{2}$/.test(fromStr)
      ? fromStr.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 60, 1), 90);

    const specialization = await resolveSpecialization(req);
    const dept = getDoctorDept(specialization || 'General Medicine');
    const totalDeptRooms = countDeptRooms(dept);

    const rangeStart = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
    const rangeEnd = new Date(fy, fm - 1, fd + days, 0, 0, 0, 0);
    const deptSchedules = await fetchDeptSchedules(dept, rangeStart, rangeEnd);

    const totalHours = DAY_END_HOUR - DAY_START_HOUR;
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(fy, fm - 1, fd + i);
      const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      const dayStart = new Date(y, m - 1, day, 0, 0, 0, 0);
      const dayEnd = new Date(y, m - 1, day + 1, 0, 0, 0, 0);
      const daySchedules = deptSchedules.filter(s => new Date(s.startTime) < dayEnd && new Date(s.endTime) > dayStart);
      const timeline = computeDayTimeline(y, m, day, daySchedules, totalDeptRooms, now);
      result.push({
        date: `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        freeHours: timeline.filter(t => t.isAvailable).length,
        totalHours,
      });
    }

    res.json({ department: dept, days: result });
  } catch (err) {
    console.error('Availability Summary Error:', err);
    res.status(500).json({ msg: 'Server error fetching availability summary' });
  }
});

// 0. AVAILABILITY: hour-by-hour timeline for a date (doctor = self, receptionist passes doctorId)
router.get('/availability', auth, authorize(["doctor", ...ROLES.SCHEDULING]), async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ msg: 'Date parameter is required' });

    const specialization = await resolveSpecialization(req);
    const { dept, dateOnlyStr, timeline } = await buildDeptTimeline(date, specialization);
    res.json({ date: dateOnlyStr, department: dept, timeline });
  } catch (err) {
    console.error('Availability Error:', err);
    res.status(500).json({ msg: 'Server error fetching availability' });
  }
});

// 1. DOCTOR: Send a schedule request
router.post('/request', auth, authorize(["doctor"]), async (req, res) => {
  try {
    const { date, startTime, endTime, isUnlimited, queueLimit, contactHospital, note } = req.body;
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

    if (contactHospital) {
      // Department is full: skip the department check, reception will find a room
      // in any department. Only hospital hours and "not in the past" apply here.
      const dateOnlyStr = String(date).split('T')[0];
      const [y, m, d] = dateOnlyStr.split('-').map(Number);
      const dayStart = new Date(y, m - 1, d, DAY_START_HOUR, 0, 0, 0);
      const dayEnd = new Date(y, m - 1, d, DAY_END_HOUR, 0, 0, 0);
      if (pStart < dayStart || pEnd > dayEnd) {
        return res.status(400).json({ msg: `Sessions must be between ${formatHour(DAY_START_HOUR)} and ${formatHour(DAY_END_HOUR)}.` });
      }
      if (pStart < new Date()) {
        return res.status(400).json({ msg: 'Start time has already passed.' });
      }
    } else {
      const rangeError = await validateRangeAgainstTimeline(date, doctor.specialization, pStart, pEnd);
      if (rangeError) return res.status(400).json({ msg: rangeError });
    }

    // A doctor can't run two sessions at once
    const ownOverlap = await ScheduleRequest.findOne({
      doctorId: req.user.id,
      status: { $in: ['pending', 'approved'] },
      sessionEnded: { $ne: true },
      startTime: { $lt: pEnd },
      endTime: { $gt: pStart }
    });
    if (ownOverlap) {
      return res.status(400).json({ msg: 'You already have a session or request at this time.' });
    }

    const newRequest = new ScheduleRequest({
      doctorId: req.user.id,
      doctorName: doctor.name || doctor.fullName || 'Doctor',
      date: new Date(date),
      startTime: pStart,
      endTime: pEnd,
      isUnlimited,
      queueLimit: isUnlimited ? null : queueLimit,
      requestType: contactHospital ? 'hospital_contact' : 'normal',
      note: typeof note === 'string' ? note.trim().slice(0, 500) : ''
    });

    const savedRequest = await newRequest.save();
    // Reception screens refresh on this event
    if (req.io) req.io.emit("scheduleUpdated", savedRequest);
    res.status(201).json({ msg: 'Schedule request sent successfully', request: savedRequest });
  } catch (err) {
    console.error('Doctor Schedule Request Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 3. RECEPTIONIST: Get pending requests
router.get('/pending', auth, authorize(ROLES.STAFF), async (req, res) => {
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
router.get('/all', auth, authorize(ROLES.STAFF), async (req, res) => {
  try {
    const { scope } = req.query;

    // ?scope=pending -> every request still waiting for a decision
    if (scope === 'pending') {
      return res.json(await ScheduleRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).lean());
    }

    // ?scope=history&skip=0&limit=50&q=<doctor> -> one page of decided requests (there are thousands)
    if (scope === 'history') {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
      const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
      const filter = { status: { $ne: 'pending' } };
      const q = String(req.query.q || '').trim();
      if (q) filter.doctorName = { $regex: escapeRegex(q), $options: 'i' };
      const [items, total] = await Promise.all([
        ScheduleRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        ScheduleRequest.countDocuments(filter),
      ]);
      return res.json({ items, total, hasMore: skip + items.length < total });
    }

    // No scope: everything (kept for older clients)
    const requests = await ScheduleRequest.find().sort({ createdAt: -1 }).lean();
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

      // The doctor's live room/nurse is re-derived once the request is saved (below)
    } else {
      // ✅ WHEN REJECTING OR CANCELLING
      request.allocatedRoom = "";
      request.allocatedNurse = "";

      // If this schedule was previously approved, cancel any booked appointments and notify patients
      if (wasApproved) {
        try {
          const Appointment = (await import('../models/Appointment.js')).default;
          // Only this session's bookings (older ones without a session are matched by day)
          const affectedAppointments = await Appointment.find({
            status: { $nin: ['cancelled', 'completed'] },
            $or: [
              { scheduleId: request._id },
              { scheduleId: { $exists: false }, doctorId: request.doctorId, date: dayRange(request.date) }
            ]
          });

          // Cancels each booking, refunds what was paid and notifies the patient
          for (const appt of affectedAppointments) {
            await cancelAppointment(appt, { byStaff: true, reason: "the doctor's session was cancelled", io: req.io });
          }
        } catch (apptErr) {
          console.error("Failed to cancel associated appointments on schedule cancellation:", apptErr);
        }
      }
    }

    request.status = status;
    await request.save();

    // ✅ SYNC TO DOCTOR MODEL: the live room/nurse follows today's session in progress (or next)
    await syncDoctorLiveAllocation(request.doctorId, req.io);

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
router.get('/my-requests', auth, authorize(["doctor"]), async (req, res) => {
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
      date: { $gte: today },
      endTime: { $gt: new Date() },
      sessionEnded: { $ne: true }
    }).sort({ startTime: 1 });
    // Each session carries its places left, next token, estimated time and fees
    res.json(await Promise.all(approvedSchedules.map(describeSession)));
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});


// 7. RECEPTIONIST: Today's Approved or by specified Date
router.get('/approved/today', auth, authorize(ROLES.STAFF), async (req, res) => {
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

// Rooms (every department) and nurses, each marked free/busy for [start, end).
const computeFreeResources = async (start, end, specialization, excludeId) => {
  const overlapping = await ScheduleRequest.find({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    status: 'approved',
    sessionEnded: { $ne: true },
    startTime: { $lt: end },
    endTime: { $gt: start }
  }).select('allocatedRoom allocatedNurse');
  const busyRooms = new Set(overlapping.map(s => s.allocatedRoom).filter(Boolean));
  const busyNurses = new Set(overlapping.map(s => s.allocatedNurse).filter(Boolean));

  const doctorDept = getDoctorDept(specialization);
  const rooms = Object.entries(ROOM_DEPARTMENTS).map(([room, department]) => ({
    room,
    department,
    isDoctorDept: department === doctorDept,
    free: !busyRooms.has(room)
  }));
  const nurseDocs = await Admin.find({ role: 'nurse' }).select('name');
  const nurses = nurseDocs
    .map(n => n.name)
    .filter(Boolean)
    .map(name => ({ name, free: !busyNurses.has(name) }));

  return { doctorDept, rooms, nurses };
};

// Free rooms/nurses for a time the receptionist is about to schedule.
// ?doctorId=&startTime=ISO&endTime=ISO
router.get('/free-resources', auth, authorize(ROLES.SCHEDULING), async (req, res) => {
  try {
    const start = new Date(req.query.startTime);
    const end = new Date(req.query.endTime);
    if (isNaN(start) || isNaN(end) || end <= start) {
      return res.status(400).json({ msg: 'Valid startTime and endTime are required.' });
    }
    const doctor = req.query.doctorId
      ? await Doctor.findById(req.query.doctorId).select('specialization').catch(() => null)
      : null;
    res.json(await computeFreeResources(start, end, doctor?.specialization));
  } catch (err) {
    console.error('Free Resources Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Free rooms (every department) and nurses for an existing request's time slot.
// Used by reception to place a "contact hospital" request outside the doctor's department.
router.get('/:id/free-resources', auth, authorize(ROLES.SCHEDULING), async (req, res) => {
  try {
    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });
    const doctor = await Doctor.findById(request.doctorId).select('specialization');
    res.json(await computeFreeResources(request.startTime, request.endTime, doctor?.specialization, request._id));
  } catch (err) {
    console.error('Free Resources Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 7.0 RECEPTIONIST: Suggest an available room and nurse for a request
router.get('/:id/auto-allocation', auth, authorize(ROLES.SCHEDULING), async (req, res) => {
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
router.put('/:id/allocate', auth, authorize(ROLES.SCHEDULING), async (req, res) => {
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
        // Overlap by actual times: the stored "date" differs by booking path (midnight UTC vs noon)
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
    // Nurse screens list today's sessions by their nurse: refresh them for the old and new nurse
    if (req.io) req.io.emit("scheduleUpdated", request);

    // Sync to Doctor model. Only changes the live nurse when this is the doctor's current session
    // today; editing a later session must not take the queue away from the nurse running this one.
    await syncDoctorLiveAllocation(request.doctorId, req.io);

    res.json({ msg: 'Allocation successful', request });
  } catch (err) {
    console.error('Allocation Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// 8. RECEPTIONIST/ADMIN: Create a schedule on behalf of a doctor
router.post('/admin/create', auth, async (req, res) => {
  try {
    const { doctorId, date, startTime, endTime, isUnlimited, queueLimit, anyDepartment, allocatedRoom, allocatedNurse } = req.body;

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

    if (anyDepartment) {
      // Doctor's department is full: reception places the session in a room of any
      // department. Only hospital hours, "not in the past" and room/nurse clashes apply.
      if (!allocatedRoom || !ROOM_DEPARTMENTS[allocatedRoom] || !allocatedNurse) {
        return res.status(400).json({ msg: 'Choose a room and a nurse for this session.' });
      }
      const [y, m, d] = String(date).split('T')[0].split('-').map(Number);
      const dayStart = new Date(y, m - 1, d, DAY_START_HOUR, 0, 0, 0);
      const dayEnd = new Date(y, m - 1, d, DAY_END_HOUR, 0, 0, 0);
      if (parsedStartTime < dayStart || parsedEndTime > dayEnd) {
        return res.status(400).json({ msg: `Sessions must be between ${formatHour(DAY_START_HOUR)} and ${formatHour(DAY_END_HOUR)}.` });
      }
      if (parsedStartTime < new Date()) {
        return res.status(400).json({ msg: 'Start time has already passed.' });
      }
      const clash = await ScheduleRequest.findOne({
        status: 'approved',
        sessionEnded: { $ne: true },
        $or: [{ allocatedRoom }, { allocatedNurse }],
        startTime: { $lt: parsedEndTime },
        endTime: { $gt: parsedStartTime }
      });
      if (clash) {
        const type = clash.allocatedRoom === allocatedRoom ? 'Room' : 'Nurse';
        return res.status(409).json({ msg: `Conflict: ${type} is already booked by ${clash.doctorName} at this time.` });
      }
    } else {
      const rangeError = await validateRangeAgainstTimeline(date, doctor.specialization, parsedStartTime, parsedEndTime);
      if (rangeError) return res.status(400).json({ msg: rangeError });
    }

    const doctorOverlap = await ScheduleRequest.findOne({
      doctorId,
      status: { $in: ['pending', 'approved'] },
      sessionEnded: { $ne: true },
      startTime: { $lt: parsedEndTime },
      endTime: { $gt: parsedStartTime }
    });
    if (doctorOverlap) {
      return res.status(400).json({ msg: 'This doctor already has a session or request at this time.' });
    }

    const newRequest = new ScheduleRequest({
      doctorId,
      doctorName: doctor.name || doctor.fullName || 'Doctor',
      date: parsedDate,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      isUnlimited,
      queueLimit: isUnlimited ? null : queueLimit,
      status: 'approved', // Automatically approved
      requestType: anyDepartment ? 'hospital_contact' : 'normal'
    });

    if (anyDepartment) {
      newRequest.allocatedRoom = allocatedRoom;
      newRequest.allocatedNurse = allocatedNurse;
    } else {
      const auto = await findAutoAllocation(newRequest, doctor.specialization);
      newRequest.allocatedRoom = auto.room;
      newRequest.allocatedNurse = auto.nurse;
    }

    const savedRequest = await newRequest.save();

    await syncDoctorLiveAllocation(doctorId, req.io);

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

// 8.1 RECEPTIONIST/ADMIN: Create approved daily schedules for every doctor
router.post('/admin/create-daily', auth, async (req, res) => {
  try {
    if (!['receptionist', 'system_admin'].includes(req.user?.role)) {
      return res.status(403).json({ msg: 'Not authorized. Only receptionists and system admins can perform this action.' });
    }

    const {
      startDate,
      endDate,
      isUnlimited = true,
      queueLimit = 20,
      doctorIds,
      includeDetails = false
    } = req.body;

    if (!endDate) {
      return res.status(400).json({ msg: 'endDate is required.' });
    }
    if (!isUnlimited && Number(queueLimit) < 1) {
      return res.status(400).json({ msg: 'queueLimit must be at least 1, or choose unlimited.' });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ msg: 'startDate and endDate must be valid dates.' });
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    if (end < start) {
      return res.status(400).json({ msg: 'endDate must be on or after startDate.' });
    }

    const doctorQuery = doctorIds?.length
      ? { _id: { $in: doctorIds } }
      : { isApproved: true };
    const doctors = await Doctor.find(doctorQuery).sort({ _id: 1 });
    const result = { created: [], skipped: [], doctors: doctors.length };
    const rangeSchedules = await ScheduleRequest.find({
      date: { $gte: start, $lte: end },
      status: { $nin: ['rejected', 'cancelled'] }
    }).populate('doctorId', 'specialization');
    const nurses = (await Admin.find({ role: 'nurse' }).select('name'))
      .map(nurse => nurse.name)
      .filter(Boolean);
    const newRequests = [];

    const scheduleDateKey = schedule => {
      const scheduleDate = new Date(schedule.date);
      return `${scheduleDate.getFullYear()}-${String(scheduleDate.getMonth() + 1).padStart(2, '0')}-${String(scheduleDate.getDate()).padStart(2, '0')}`;
    };

    for (const doctor of doctors) {
      for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const date = new Date(day);
        date.setHours(12, 0, 0, 0);
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const existing = rangeSchedules.find(schedule =>
          schedule.doctorId?._id?.toString() === doctor._id.toString() && scheduleDateKey(schedule) === dateKey
        );

        if (existing) {
          result.skipped.push({ doctorId: doctor._id, date: dateKey, reason: 'already scheduled' });
          continue;
        }

        const department = getDoctorDept(doctor.specialization);
        const departmentRooms = Object.keys(ROOM_DEPARTMENTS).filter(room => ROOM_DEPARTMENTS[room] === department);
        const overlappingSchedules = hour => rangeSchedules.filter(schedule => {
          if (schedule.status !== 'approved' || schedule.sessionEnded) return false;
          if (scheduleDateKey(schedule) !== dateKey) return false;
          const scheduleDepartment = schedule.allocatedRoom && ROOM_DEPARTMENTS[schedule.allocatedRoom]
            ? ROOM_DEPARTMENTS[schedule.allocatedRoom]
            : getDoctorDept(schedule.doctorId?.specialization);
          if (scheduleDepartment !== department) return false;
          const slotStart = new Date(day);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(day);
          slotEnd.setHours(hour + 1, 0, 0, 0);
          return new Date(schedule.startTime) < slotEnd && new Date(schedule.endTime) > slotStart;
        });
        const freeSlot = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => DAY_START_HOUR + index)
          .map(hour => ({ hour, schedules: overlappingSchedules(hour) }))
          .find(slot => {
            const usedRooms = new Set(slot.schedules.map(schedule => schedule.allocatedRoom).filter(Boolean));
            const usedNurses = new Set(slot.schedules.map(schedule => schedule.allocatedNurse).filter(Boolean));
            return usedRooms.size < departmentRooms.length && nurses.some(nurse => !usedNurses.has(nurse));
          });
        const selectedHour = freeSlot?.hour ?? DAY_START_HOUR;

        const dayStart = new Date(day);
        dayStart.setHours(selectedHour, 0, 0, 0);
        const dayEnd = new Date(day);
        dayEnd.setHours(selectedHour + 1, 0, 0, 0);
        const usedRooms = new Set(freeSlot?.schedules.map(schedule => schedule.allocatedRoom).filter(Boolean) || []);
        const usedNurses = new Set(freeSlot?.schedules.map(schedule => schedule.allocatedNurse).filter(Boolean) || []);
        const allocatedRoom = [
          ...departmentRooms,
          ...Object.keys(ROOM_DEPARTMENTS).filter(room => ROOM_DEPARTMENTS[room] !== department)
        ].find(room => !usedRooms.has(room));
        const allocatedNurse = nurses.find(nurse => !usedNurses.has(nurse));

        const request = new ScheduleRequest({
          doctorId: doctor._id,
          doctorName: doctor.name || doctor.fullName || 'Doctor',
          date,
          startTime: dayStart,
          endTime: dayEnd,
          isUnlimited,
          queueLimit: isUnlimited ? null : Number(queueLimit),
          status: 'approved'
        });
        request.allocatedRoom = allocatedRoom || '';
        request.allocatedNurse = allocatedNurse || '';
        newRequests.push(request);
        rangeSchedules.push({
          ...request.toObject(),
          doctorId: { _id: doctor._id, specialization: doctor.specialization }
        });
      }
    }

    if (newRequests.length) {
      const savedRequests = await ScheduleRequest.insertMany(newRequests);
      result.created.push(...savedRequests);
      const today = new Date().toDateString();
      const todayDoctorIds = new Set(savedRequests
        .filter(r => new Date(r.date).toDateString() === today)
        .map(r => String(r.doctorId)));
      for (const id of todayDoctorIds) await syncDoctorLiveAllocation(id, req.io);
      await Notification.insertMany(savedRequests.map(savedRequest => ({
        userId: savedRequest.doctorId,
        type: 'schedule_request',
        message: `A new schedule for ${new Date(savedRequest.date).toDateString()} was created and approved for you by the administration. Room: ${savedRequest.allocatedRoom || 'TBA'}`,
        metadata: {
          requestId: savedRequest._id,
          status: 'approved',
          allocatedRoom: savedRequest.allocatedRoom || 'TBA',
          allocatedNurse: savedRequest.allocatedNurse || 'TBD'
        }
      })));
    }

    const response = {
      msg: 'Daily schedule batch completed.',
      createdCount: result.created.length,
      skippedCount: result.skipped.length,
      doctors: result.doctors
    };
    if (includeDetails) {
      response.created = result.created;
      response.skipped = result.skipped;
    }
    res.status(201).json(response);
  } catch (err) {
    console.error('Admin Create Daily Schedules Error:', err);
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

    // 2. If was approved, cancel associated appointments and notify patients
    let cancelledAppointmentsCount = 0;
    if (wasApproved) {
      try {
        const Appointment = (await import('../models/Appointment.js')).default;
        // Only this session's bookings (older ones without a session are matched by day)
        const affectedAppointments = await Appointment.find({
          status: { $nin: ['cancelled', 'completed'] },
          $or: [
            { scheduleId: request._id },
            { scheduleId: { $exists: false }, doctorId: request.doctorId, date: dayRange(request.date) }
          ]
        });

        cancelledAppointmentsCount = affectedAppointments.length;
        // Cancels each booking, refunds what was paid and notifies the patient
        for (const appt of affectedAppointments) {
          await cancelAppointment(appt, { byStaff: true, reason: "the doctor's session was removed", io: req.io });
        }
      } catch (apptErr) {
        console.error("Failed to cancel associated appointments on delete:", apptErr);
      }
    }

    // 3. Delete the schedule request completely
    await ScheduleRequest.findByIdAndDelete(req.params.id);

    // Release the doctor's live room/nurse, or hand it to their next session today
    await syncDoctorLiveAllocation(request.doctorId, req.io);

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
