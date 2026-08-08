import express from "express";
import SurgeryRecord from "../models/SurgeryRecord.js";
import Patient from "../models/Patient.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. GET ALL RECORDS
router.get("/", auth, async (req, res) => {
  try {
    const records = await SurgeryRecord.find({ doctorId: req.user.id }).sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// 2. CREATE NEW RECORD
router.post("/create", auth, async (req, res) => {
  try {
    const { name, nic, patientId, hospital, surgeryCardImage } = req.body;

    if (!name || !patientId || !surgeryCardImage) {
      return res.status(400).json({ msg: "Name, Patient ID, and Surgery Card Image are required" });
    }

    // Verify patient exists
    const patient = await Patient.findOne({ patientId: patientId.trim().toUpperCase() });
    if (!patient) {
      return res.status(400).json({ msg: "Invalid Patient ID. Patient does not exist." });
    }

    const newRecord = new SurgeryRecord({
      doctorId: req.user.id,
      name,
      nic: nic || patient.nicNumber || "",
      patientId: patientId.trim().toUpperCase(),
      hospital,
      surgeryCardImage
    });

    await newRecord.save();
    res.json(newRecord);

  } catch (err) {
    console.error("Create Record Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// 3. GET SINGLE RECORD
router.get("/:id", auth, async (req, res) => {
  try {
    const record = await SurgeryRecord.findById(req.params.id)
      .populate('doctorId', 'name email specialization');

    if (!record) return res.status(404).json({ msg: "Record not found" });

    // Add doctor name to response
    const recordWithDoctor = {
      ...record.toObject(),
      doctorName: record.doctorId?.name || 'Unknown Doctor',
      doctorSpecialization: record.doctorId?.specialization || null
    };

    res.json(recordWithDoctor);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 4. DELETE RECORD
router.delete("/:id", auth, async (req, res) => {
  try {
    await SurgeryRecord.findByIdAndDelete(req.params.id);
    res.json({ msg: "Record Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 5. ADD PROGRESS ENTRY
router.post("/:id/entry", auth, async (req, res) => {
  try {
    const { notes, images } = req.body;
    const record = await SurgeryRecord.findById(req.params.id);

    if (!record) return res.status(404).json({ msg: "Record not found" });

    const newEntry = {
      date: new Date(),
      notes: notes || "",
      images: images || []
    };

    record.entries.unshift(newEntry);

    await record.save();
    res.json(record);

  } catch (err) {
    console.error("Add Entry Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// 6. GET PATIENT'S OWN RECORDS BY PATIENT ID OR NIC (For Patient App - Read Only)
router.get("/patient/my-records", auth, async (req, res) => {
  try {
    const { nic, patientId } = req.query;

    let query = {};
    if (patientId) {
      query.patientId = patientId.trim().toUpperCase();
    } else if (nic) {
      query.nic = { $regex: new RegExp(`^${nic.trim()}$`, 'i') };
    } else {
      return res.status(400).json({ msg: "Patient ID or NIC is required" });
    }

    // Find all surgery records matching query
    const records = await SurgeryRecord.find(query)
      .populate('doctorId', 'name email specialization profileImage')  // Populate doctor info including profileImage
      .select("name hospital surgeryCardImage entries createdAt doctorId patientId nic")
      .sort({ createdAt: -1 })
      .lean();

    // Transform to include doctor name, specialization, profile image
    const recordsWithDoctor = records.map(record => ({
      ...record,
      doctorName: record.doctorId?.name || 'Unknown Doctor',
      doctorSpecialization: record.doctorId?.specialization || 'General Practitioner',
      doctorProfileImage: record.doctorId?.profileImage || '',
      doctorEmail: record.doctorId?.email || ''
    }));

    res.json(recordsWithDoctor);

  } catch (err) {
    console.error("Get Patient Records Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;