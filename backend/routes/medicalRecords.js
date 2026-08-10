import express from "express";
import MedicalRecord from "../models/MedicalRecord.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. UPLOAD A RECORD
router.post("/upload", auth, async (req, res) => {
  try {
    const { patientId, type, title, doctorName, date, description, fileData, fileType } = req.body;

    const actualPatientId = patientId || req.user.id;

    const newRecord = new MedicalRecord({
      patientId: actualPatientId,
      type,
      title,
      doctorName,
      date,
      description,
      fileData, // Base64 string
      fileType
    });

    await newRecord.save();

    // ✅ CREATE NOTIFICATION based on record type
    try {
      const Notification = (await import("../models/Notification.js")).default;

      let notificationType = 'report';
      let notificationMessage = `New ${type} uploaded: ${title}`;

      if (type === 'prescriptions') {
        notificationType = 'prescription';
        notificationMessage = `New prescription added by ${doctorName || 'your doctor'}: ${title}`;
      } else if (type === 'lab_tests' || type === 'reports') {
        notificationType = 'lab_report';
        notificationMessage = `New lab report available: ${title}`;
      }

      await Notification.create({
        userId: actualPatientId,
        type: notificationType,
        message: notificationMessage,
        metadata: { recordId: newRecord._id, recordType: type }
      });
    } catch (notifError) {
      console.error("Notification Error:", notifError);
    }

    res.json(newRecord);
  } catch (err) {
    console.error("Upload Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. GET ALL MY RECORDS (Without the heavy file data)
router.get("/my-records", auth, async (req, res) => {
  try {
    const records = await MedicalRecord.find({ patientId: req.user.id })
      .select("-fileData") // ⚡ Optimization: Don't send the huge file string yet
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET RECORDS FOR A SPECIFIC PATIENT (For Doctors & Lab Assistants)
router.get("/patient/:patientId", auth, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "doctor" && role !== "lab_assistant" && role !== "system_admin") {
      return res.status(403).json({ msg: "Not authorized to view other patient records" });
    }
    const records = await MedicalRecord.find({ patientId: req.params.patientId })
      .select("-fileData")
      .sort({ date: -1 });
    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. DOWNLOAD SPECIFIC FILE
router.get("/download/:id", auth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ msg: "File not found" });

    // Security check
    const isOwner = record.patientId.toString() === req.user.id;
    const isAuthorized = ["doctor", "lab_assistant", "system_admin"].includes(req.user.role);

    if (!isOwner && !isAuthorized) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    res.json({ fileData: record.fileData, fileType: record.fileType, fileName: record.title });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.delete("/delete/:id", auth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);

    // Check if record exists
    if (!record) {
      return res.status(404).json({ msg: "Record not found" });
    }

    // Security Check: User must own the record or be authorized
    const isOwner = record.patientId.toString() === req.user.id;
    const isAuthorized = ["doctor", "system_admin"].includes(req.user.role);

    if (!isOwner && !isAuthorized) {
      return res.status(403).json({ msg: "Not authorized to delete" });
    }

    await MedicalRecord.findByIdAndDelete(req.params.id);
    res.json({ msg: "Record removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export default router;