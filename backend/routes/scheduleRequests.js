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
    
    // Validate inputs
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ msg: 'Date, start time, and end time are required' });
    }

    // Ensure the doctor exists
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) {
      return res.status(404).json({ msg: 'Doctor not found' });
    }

    // Create a new request
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

    res.status(201).json({ 
      msg: 'Schedule request sent to receptionist successfully', 
      request: savedRequest 
    });

  } catch (err) {
    console.error('Schedule Request Error:', err.message);
    res.status(500).json({ msg: 'Server error while sending request' });
  }
});

// ==========================================
// 2. DOCTOR: Get my past/current requests
// ==========================================
router.get('/my-requests', auth, async (req, res) => {
  try {
    const requests = await ScheduleRequest.find({ doctorId: req.user.id }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error('Fetch Requests Error:', err.message);
    res.status(500).json({ msg: 'Server error while fetching requests' });
  }
});

// ==========================================
// 3. RECEPTIONIST: Get pending schedule requests
// ==========================================
router.get('/pending', auth, async (req, res) => {
  try {
    const pendingRequests = await ScheduleRequest.find({ status: 'pending' }).sort({ date: 1 });
    res.json(pendingRequests);
  } catch (err) {
    console.error('Fetch Pending Requests Error:', err.message);
    res.status(500).json({ msg: 'Server error while fetching pending requests' });
  }
});

// ==========================================
// 4. RECEPTIONIST: Get all schedule requests (for history)
// ==========================================
router.get('/all', auth, async (req, res) => {
  try {
    const requests = await ScheduleRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    console.error('Fetch All Requests Error:', err.message);
    res.status(500).json({ msg: 'Server error while fetching requests' });
  }
});

// ==========================================
// 5. RECEPTIONIST: Accept/Reject a schedule request
// ==========================================
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, allocatedRoom, allocatedNurse } = req.body; // 'approved' or 'rejected'
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status. Must be approved or rejected.' });
    }

    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Request not found' });
    }

    if (status === 'approved') {
      if (!allocatedRoom || !allocatedNurse) {
        return res.status(400).json({ msg: 'Room and Nurse must be allocated for approval' });
      }

      // ✅ CONFLICT CHECK: Prevents double-booking same room or nurse at the same time
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
          msg: `Conflict detected: ${type} "${type === 'Room' ? allocatedRoom : allocatedNurse}" is already booked by ${conflict.doctorName} during this time.`,
          conflictWith: conflict.doctorName
        });
      }

      request.allocatedRoom = allocatedRoom;
      request.allocatedNurse = allocatedNurse;
    }

    request.status = status;
    await request.save();

    console.log('--- NOTIFYING DOCTOR ---');
    console.log('Doctor ID:', request.doctorId);

    // ✅ NOTIFY THE DOCTOR
    const doctorNotification = new Notification({
      userId: request.doctorId,
      type: 'schedule_request',
      message: status === 'approved' 
        ? `Your channeling schedule for ${new Date(request.date).toDateString()} has been APPROVED. Room: ${allocatedRoom}, Nurse: ${allocatedNurse}.`
        : `Your channeling schedule request for ${new Date(request.date).toDateString()} has been REJECTED.`,
      metadata: {
        requestId: request._id,
        status: status,
        date: request.date,
        startTime: request.startTime,
        endTime: request.endTime,
        allocatedRoom: request.allocatedRoom,
        allocatedNurse: request.allocatedNurse
      }
    });

    console.log('Notification Obj:', doctorNotification);
    await doctorNotification.save();

    res.json({ msg: `Request has been ${status}`, request });

  } catch (err) {
    console.error('Update Request Status Error:', err.message);
    res.status(500).json({ msg: 'Server error while updating request status' });
  }
});

// ==========================================
// 6. PATIENT: Get approved schedules for a specific doctor
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
    console.error('Fetch Approved Schedules Error:', err.message);
    res.status(500).json({ msg: 'Server error while fetching approved schedules' });
  }
});

// ==========================================
// 7. RECEPTIONIST: Get all approved schedules for today
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
    console.error('Fetch Today Approved Error:', err.message);
    res.status(500).json({ msg: 'Server error while fetching today\'s schedules' });
  }
});

export default router;
