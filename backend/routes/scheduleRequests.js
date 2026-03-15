import express from 'express';
import ScheduleRequest from '../models/ScheduleRequest.js';
import Doctor from '../models/Doctor.js';
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
// 3. RECEPTIONIST: Get all pending schedule requests
// ==========================================
router.get('/pending', auth, async (req, res) => {
  try {
    // Assuming auth middleware can verify if user is a receptionist
    // For now, getting all pending requests
    const pendingRequests = await ScheduleRequest.find({ status: 'pending' }).sort({ date: 1 });
    res.json(pendingRequests);
  } catch (err) {
    console.error('Fetch Pending Requests Error:', err.message);
    res.status(500).json({ msg: 'Server error while fetching pending requests' });
  }
});

// ==========================================
// 4. RECEPTIONIST: Accept/Reject a schedule request
// ==========================================
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status. Must be approved or rejected.' });
    }

    const request = await ScheduleRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: 'Request not found' });
    }

    request.status = status;
    await request.save();

    res.json({ msg: `Request has been ${status}`, request });

  } catch (err) {
    console.error('Update Request Status Error:', err.message);
    res.status(500).json({ msg: 'Server error while updating request status' });
  }
});

export default router;
