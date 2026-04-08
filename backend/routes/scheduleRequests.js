import express from 'express';
import ScheduleRequest from '../models/ScheduleRequest.js';
import Doctor from '../models/Doctor.js';
import Notification from '../models/Notification.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// ==========================================
// 1. DOCTOR: Send a schedule request to receptionist
// ==========================================
router.post('/request', auth, async (req, res) => {
  try {
    const { date, startTime, endTime, isUnlimited, queueLimit } = req.body;
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ msg: 'Date, start time, and end time are required' });
    }

    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) {
      return res.status(404).json({ msg: 'Doctor not found' });
    }

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
    console.error('Schedule Request Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 2. DOCTOR: Get my requests
// ==========================================
router.get('/my-requests', auth, async (req, res) => {
  try {
    const requests = await ScheduleRequest.find({ doctorId: req.user.id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 3. RECEPTIONIST: Get pending requests
// ==========================================
router.get('/pending', auth, async (req, res) => {
  try {
    const pendingRequests = await ScheduleRequest.find({ status: 'pending' }).sort({ date: 1 });
    res.json(pendingRequests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 4. RECEPTIONIST: Get all requests
// ==========================================
router.get('/all', auth, async (req, res) => {
  try {
    const requests = await ScheduleRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 5. RECEPTIONIST: Accept/Reject (FIXED VALIDATION)
// ==========================================
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, allocatedRoom, allocatedNurse } = req.body; 
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status.' });
    }

    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ msg: 'Request not found' });

    // ✅ FIXED: Validation only triggers if BOTH room and nurse are provided.
    // If they are missing, the status is updated but fields remain empty for later allocation.
    if (status === 'approved' && allocatedRoom && allocatedNurse) {
      
      // ✅ CONFLICT CHECK
      const conflict = await ScheduleRequest.findOne({
        _id: { $ne: request._id },
        status: 'approved',
        date: request.date,
        $or: [
          { allocatedRoom: allocatedRoom },
          { allocatedNurse: allocatedNurse }
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

      request.allocatedRoom = allocatedRoom;
      request.allocatedNurse = allocatedNurse;
    }

    request.status = status;
    await request.save();

    // ✅ NOTIFY DOCTOR
    const doctorNotification = new Notification({
      userId: request.doctorId,
      type: 'schedule_request',
      message: status === 'approved' 
        ? `Your schedule for ${new Date(request.date).toDateString()} has been APPROVED.`
        : `Your schedule request for ${new Date(request.date).toDateString()} was REJECTED.`,
      metadata: {
        requestId: request._id,
        status: status,
        allocatedRoom: request.allocatedRoom || 'TBA',
        allocatedNurse: request.allocatedNurse || 'TBA'
      }
    });

    await doctorNotification.save();

    res.json({ msg: `Request has been ${status}`, request });

  } catch (err) {
    console.error('Update Request Status Error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==========================================
// 6. PATIENT: Get approved schedules
// ==========================================
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

// ==========================================
// 7. RECEPTIONIST: Today's Approved
// ==========================================
router.get('/approved/today', auth, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const schedules = await ScheduleRequest.find({
      status: 'approved',
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ startTime: 1 });

    res.json(schedules);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;