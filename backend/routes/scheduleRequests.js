import express from 'express';
import ScheduleRequest from '../models/ScheduleRequest.js';
import Doctor from '../models/Doctor.js';
import Notification from '../models/Notification.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// 1. DOCTOR: Send a schedule request
router.post('/request', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, isUnlimited, queueLimit } = req.body;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ msg: 'Date, start time, and end time are required' });
    }
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) return res.status(404).json({ msg: 'Doctor not found' });

    const newRequest = new ScheduleRequest({
      doctorId: req.user.id,
      doctorName: doctor.name || doctor.fullName || 'Doctor',
      date: new Date(date),
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isUnlimited,
      queueLimit: isUnlimited ? null : queueLimit
    });

    const savedRequest = await newRequest.save();
    res.status(201).json({ msg: 'Schedule request sent successfully', request: savedRequest });
  } catch (err) {
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
// 5. RECEPTIONIST: Accept/Reject & Sync to Doctor Model
// ==========================================
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, allocatedRoom, allocatedNurse } = req.body; 
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status.' });
    }

    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    if (status === 'approved') {
      // ✅ CONFLICT CHECK
      if (allocatedRoom || allocatedNurse) {
        const conflict = await ScheduleRequest.findOne({
          _id: { $ne: request._id },
          status: 'approved',
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
            msg: `Conflict: ${type} is already booked by ${conflict.doctorName}.`
          });
        }
      }

      // ✅ UPDATE SCHEDULE REQUEST OBJECT
      if (allocatedRoom) request.allocatedRoom = allocatedRoom;
      if (allocatedNurse) request.allocatedNurse = allocatedNurse;

      // ✅ SYNC TO DOCTOR MODEL
      // This is the missing piece! Update the Doctor's own fields.
      await Doctor.findByIdAndUpdate(request.doctorId, {
        $set: {
          allocatedRoom: allocatedRoom || request.allocatedRoom,
          allocatedNurse: allocatedNurse || request.allocatedNurse
        }
      });
    }

    request.status = status;
    await request.save();

    // ✅ NOTIFY DOCTOR
    const doctorNotification = new Notification({
      userId: request.doctorId,
      type: 'schedule_request',
      message: status === 'approved' 
        ? `Your schedule for ${new Date(request.date).toDateString()} was APPROVED. Room: ${request.allocatedRoom || 'TBA'}`
        : `Your schedule request for ${new Date(request.date).toDateString()} was REJECTED.`,
      data: { 
        requestId: request._id,
        status: status,
        allocatedRoom: request.allocatedRoom || 'TBA',
        allocatedNurse: request.allocatedNurse || 'TBA'
      }
    });

    await doctorNotification.save();
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
          allocatedNurse: allocatedNurse || ""
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

    const savedRequest = await newRequest.save();

    // Create a Notification for the doctor
    const doctorNotification = new Notification({
      userId: doctorId,
      type: 'schedule_request',
      message: `A new schedule for ${parsedDate.toDateString()} was created and approved for you by the administration.`,
      data: { 
        requestId: savedRequest._id,
        status: 'approved',
        allocatedRoom: 'TBA',
        allocatedNurse: 'TBA'
      }
    });
    await doctorNotification.save();

    res.status(201).json({ msg: 'Schedule created and approved successfully', request: savedRequest });
  } catch (err) {
    console.error('Admin Create Schedule Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
