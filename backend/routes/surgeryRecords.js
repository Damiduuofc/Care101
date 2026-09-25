import express from "express";
import mongoose from "mongoose";
import SurgeryRecord from "../models/SurgeryRecord.js";
import MedicalRecord from "../models/MedicalRecord.js";
import LabRequest from "../models/LabRequest.js";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import { syncPatientDoctorRecordBook } from "./medicalRecords.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Helper to resolve a Doctor document from doctorId or doctorName
const findDoctorForRecord = async (doctorId, doctorName) => {
  if (doctorId && mongoose.Types.ObjectId.isValid(doctorId)) {
    const d = await Doctor.findById(doctorId);
    if (d) return d;
  }
  if (doctorName && doctorName.trim() !== "" && doctorName !== "Self Uploaded" && !doctorName.toLowerCase().includes("lab assistant")) {
    const clean = doctorName.replace(/^(dr\.|dr)\s+/i, "").trim();
    if (clean && clean !== "Doctor" && clean !== "Medical Officer") {
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const d = await Doctor.findOne({
        $or: [
          { name: { $regex: new RegExp(escaped, "i") } },
          { fullName: { $regex: new RegExp(escaped, "i") } }
        ]
      });
      if (d) return d;
    }
  }
  return null;
};

// 1. GET ALL RECORDS (For Doctor or Nurse)
router.get("/", auth, async (req, res) => {
  try {
    let queryDoctorId = req.user.id;
    if (req.user.role === "nurse") {
      const Admin = (await import("../models/Admin.js")).default;
      const nurse = await Admin.findById(req.user.id);
      if (nurse) {
        const doctor = await Doctor.findOne({ allocatedNurse: nurse.name });
        if (doctor) {
          queryDoctorId = doctor._id;
        }
      }
    }
    const records = await SurgeryRecord.find({ doctorId: queryDoctorId }).sort({ updatedAt: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// 2. CREATE NEW RECORD
router.post("/create", auth, async (req, res) => {
  try {
    const { name, nic, patientId, hospital, surgeryCardImage, doctorId: bodyDoctorId } = req.body;

    if (!name || !patientId) {
      return res.status(400).json({ msg: "Name and Patient ID are required" });
    }

    // Verify patient exists (by patientId code, Mongo _id, or NIC)
    let patient = await Patient.findOne({ patientId: patientId.trim().toUpperCase() });
    if (!patient && mongoose.Types.ObjectId.isValid(patientId)) {
      patient = await Patient.findById(patientId);
    }
    if (!patient && nic) {
      patient = await Patient.findOne({ nicNumber: new RegExp(`^${nic.trim()}$`, "i") });
    }
    if (!patient) {
      return res.status(400).json({ msg: "Invalid Patient ID. Patient does not exist." });
    }

    let doctorId = bodyDoctorId || req.user.id;
    if (req.user.role === "nurse") {
      if (bodyDoctorId) {
        doctorId = bodyDoctorId;
      } else {
        const Admin = (await import("../models/Admin.js")).default;
        const nurse = await Admin.findById(req.user.id);
        if (nurse) {
          const doctor = await Doctor.findOne({ allocatedNurse: nurse.name });
          if (doctor) {
            doctorId = doctor._id;
          } else {
            return res.status(400).json({ msg: "No doctor is currently assigned to this nurse" });
          }
        } else {
          return res.status(404).json({ msg: "Nurse not found" });
        }
      }
    }

    const patCode = (patient.patientId || patientId.trim()).toUpperCase();

    const newRecord = new SurgeryRecord({
      doctorId,
      name: name || patient.fullName,
      nic: nic || patient.nicNumber || "",
      patientId: patCode,
      hospital,
      surgeryCardImage: surgeryCardImage || "",
      updatedAt: new Date()
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
      .populate('doctorId', 'name email specialization slmcReg hospital profileImage');

    if (!record) return res.status(404).json({ msg: "Record not found" });

    // Resolve patient Mongo _id so frontend/mobile can fetch MedicalRecords & LabRequests reliably
    let patientMongoId = null;
    if (record.patientId) {
      if (mongoose.Types.ObjectId.isValid(record.patientId)) {
        const pById = await Patient.findById(record.patientId).select("_id patientId");
        if (pById) patientMongoId = pById._id;
      }
      if (!patientMongoId) {
        const pByCode = await Patient.findOne({ patientId: record.patientId.trim().toUpperCase() }).select("_id patientId");
        if (pByCode) patientMongoId = pByCode._id;
      }
    }
    if (!patientMongoId && record.nic) {
      const pByNic = await Patient.findOne({ nicNumber: new RegExp(`^${record.nic.trim()}$`, "i") }).select("_id patientId");
      if (pByNic) patientMongoId = pByNic._id;
    }

    // Add doctor name to response
    const recordWithDoctor = {
      ...record.toObject(),
      patientMongoId,
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
    record.updatedAt = new Date();

    await record.save();
    res.json(record);

  } catch (err) {
    console.error("Add Entry Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

// 6. GET PATIENT'S OWN RECORDS BY PATIENT ID, NIC, OR AUTH TOKEN (For Patient App & Nurse)
router.get("/patient/my-records", auth, async (req, res) => {
  try {
    const { nic, patientId } = req.query;

    // 1. Resolve the Patient document using query params or logged-in patient token
    let patient = null;
    if (patientId) {
      patient = await Patient.findOne({ patientId: String(patientId).trim().toUpperCase() });
      if (!patient && mongoose.Types.ObjectId.isValid(String(patientId))) {
        patient = await Patient.findById(String(patientId));
      }
    }
    if (!patient && nic) {
      patient = await Patient.findOne({ nicNumber: { $regex: new RegExp(`^${String(nic).trim()}$`, 'i') } });
    }
    if (!patient && req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
      patient = await Patient.findById(req.user.id);
    }

    // 2. Auto-heal / ensure SurgeryRecord book exists for every doctor who has MedicalRecords or LabRequests for this patient
    if (patient) {
      try {
        const [medRecords, labReqs] = await Promise.all([
          MedicalRecord.find({ patientId: patient._id }).lean(),
          LabRequest.find({ patientId: patient._id }).lean()
        ]);

        const seenDoctorIds = new Set();

        for (const mr of medRecords) {
          if (mr.doctorName === "Self Uploaded" || mr.doctorName?.toLowerCase().includes("lab assistant")) continue;
          const doc = await findDoctorForRecord(mr.doctorId, mr.doctorName);
          if (doc && !seenDoctorIds.has(String(doc._id))) {
            seenDoctorIds.add(String(doc._id));
            await syncPatientDoctorRecordBook({
              patientId: patient._id,
              doctorId: doc._id,
              doctorDoc: doc,
              record: mr,
              isNew: false
            });
          }
        }

        for (const lr of labReqs) {
          if (lr.doctorName?.toLowerCase().includes("lab assistant")) continue;
          const doc = await findDoctorForRecord(lr.doctorId, lr.doctorName);
          if (doc && !seenDoctorIds.has(String(doc._id))) {
            seenDoctorIds.add(String(doc._id));
            await syncPatientDoctorRecordBook({
              patientId: patient._id,
              doctorId: doc._id,
              doctorDoc: doc,
              record: null,
              isNew: false
            });
          }
        }
      } catch (syncErr) {
        console.error("Auto-sync patient record books warning:", syncErr.message);
      }
    }

    // 3. Build flexible OR query so records matched by patientId, Mongo _id, or NIC are all found
    const orConditions = [];
    if (patient) {
      if (patient.patientId) {
        orConditions.push({ patientId: patient.patientId.trim().toUpperCase() });
      }
      orConditions.push({ patientId: String(patient._id) });
      if (patient.nicNumber) {
        orConditions.push({ nic: { $regex: new RegExp(`^${patient.nicNumber.trim()}$`, 'i') } });
      }
    }
    if (patientId) {
      orConditions.push({ patientId: String(patientId).trim().toUpperCase() });
    }
    if (nic) {
      orConditions.push({ nic: { $regex: new RegExp(`^${String(nic).trim()}$`, 'i') } });
    }

    if (orConditions.length === 0) {
      return res.status(400).json({ msg: "Patient ID or NIC is required" });
    }

    // Find all surgery records matching query
    const records = await SurgeryRecord.find({ $or: orConditions })
      .populate('doctorId', 'name email specialization profileImage slmcReg hospital')
      .select("name hospital surgeryCardImage entries createdAt updatedAt doctorId patientId nic")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();

    // Transform to include doctor name, specialization, profile image
    const recordsWithDoctor = records.map(record => ({
      ...record,
      patientMongoId: patient?._id || null,
      doctorName: record.doctorId?.name || 'Unknown Doctor',
      doctorSpecialization: record.doctorId?.specialization || 'General Practitioner',
      doctorProfileImage: record.doctorId?.profileImage || '',
      doctorEmail: record.doctorId?.email || '',
      doctorSlmc: record.doctorId?.slmcReg || 'N/A',
      doctorHospital: record.doctorId?.hospital || record.hospital || 'Care101 Hospital'
    }));

    res.json(recordsWithDoctor);

  } catch (err) {
    console.error("Get Patient Records Error:", err.message);
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;