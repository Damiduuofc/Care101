import express from "express";
import mongoose from "mongoose";
import MedicalRecord from "../models/MedicalRecord.js";
import SurgeryRecord from "../models/SurgeryRecord.js";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import Admin from "../models/Admin.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

const resolveDoctorDisplay = (doc) => {
  if (!doc) return null;
  const name = doc.name || doc.fullName || doc.nameWithInitials;
  if (!name) return null;
  return name.startsWith("Dr.") ? name : `Dr. ${name}`;
};

const resolveMedicalRecordDoctor = async (reqDocId, reqDocName, patientId, user) => {
  if (user?.role === "patient") {
    return { finalDoctorId: null, finalDoctorName: "Self Uploaded", doctorDoc: null };
  }

  // 1. If doctorId is explicitly passed
  if (reqDocId && mongoose.Types.ObjectId.isValid(reqDocId)) {
    const doc = await Doctor.findById(reqDocId);
    if (doc) {
      return {
        finalDoctorId: doc._id,
        finalDoctorName: resolveDoctorDisplay(doc) || reqDocName || doc.name,
        doctorDoc: doc
      };
    }
  }

  // 2. If caller is a doctor
  if (user?.role === "doctor" && user.id) {
    const doc = await Doctor.findById(user.id);
    if (doc) {
      return {
        finalDoctorId: doc._id,
        finalDoctorName: resolveDoctorDisplay(doc) || doc.name,
        doctorDoc: doc
      };
    }
  }

  // 3. If reqDocName is provided and refers to a real doctor
  if (reqDocName && reqDocName.trim() !== "Doctor" && reqDocName.trim() !== "Self Uploaded" && reqDocName.trim() !== "Nurse" && !reqDocName.toLowerCase().includes("lab assistant")) {
    const clean = reqDocName.replace(/^(dr\.|dr)\s+/i, "").trim();
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const doc = await Doctor.findOne({
      $or: [
        { name: { $regex: new RegExp(escaped, "i") } },
        { fullName: { $regex: new RegExp(escaped, "i") } }
      ]
    });
    if (doc) {
      return {
        finalDoctorId: doc._id,
        finalDoctorName: resolveDoctorDisplay(doc) || reqDocName,
        doctorDoc: doc
      };
    }
  }

  // 4. If caller is a nurse, check their allocated doctor
  if (user?.role === "nurse" && user.id) {
    const nurse = await Admin.findById(user.id);
    if (nurse) {
      const doc = await Doctor.findOne({ allocatedNurse: nurse.name });
      if (doc) {
        return {
          finalDoctorId: doc._id,
          finalDoctorName: resolveDoctorDisplay(doc) || doc.name,
          doctorDoc: doc
        };
      }
    }
  }

  // 5. Fallback to patient's latest appointment doctor
  if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
    const appt = await Appointment.findOne({ patientId }).sort({ createdAt: -1 });
    if (appt) {
      if (appt.doctorId) {
        const doc = await Doctor.findById(appt.doctorId);
        if (doc) {
          return {
            finalDoctorId: doc._id,
            finalDoctorName: resolveDoctorDisplay(doc) || appt.doctorName,
            doctorDoc: doc
          };
        }
      }
      if (appt.doctorName && appt.doctorName.trim() !== "Doctor") {
        const formatted = appt.doctorName.startsWith("Dr.") ? appt.doctorName : `Dr. ${appt.doctorName}`;
        return { finalDoctorId: appt.doctorId || null, finalDoctorName: formatted, doctorDoc: null };
      }
    }
  }

  // 6. If lab assistant
  if (user?.role === "lab_assistant" || (reqDocName && reqDocName.toLowerCase().includes("lab assistant"))) {
    return { finalDoctorId: null, finalDoctorName: reqDocName || "Lab Assistant", doctorDoc: null };
  }

  // 7. Fallback to any doctor in system
  const defaultDoc = await Doctor.findOne();
  if (defaultDoc) {
    return {
      finalDoctorId: defaultDoc._id,
      finalDoctorName: resolveDoctorDisplay(defaultDoc),
      doctorDoc: defaultDoc
    };
  }

  return {
    finalDoctorId: null,
    finalDoctorName: reqDocName || "Dr. Medical Officer",
    doctorDoc: null
  };
};

export const syncPatientDoctorRecordBook = async ({ patientId, doctorId, doctorDoc, record, isNew = false }) => {
  try {
    if (!patientId || !doctorId) return null;
    const patient = mongoose.Types.ObjectId.isValid(patientId)
      ? await Patient.findById(patientId)
      : await Patient.findOne({ patientId: String(patientId).trim().toUpperCase() });
    if (!patient) return null;

    const doc = doctorDoc || (await Doctor.findById(doctorId));
    if (!doc) return null;

    const patCode = (patient.patientId || String(patient._id)).trim().toUpperCase();
    const matchOr = [
      { patientId: patCode },
      { patientId: String(patient._id) }
    ];
    if (patient.nicNumber) {
      matchOr.push({ nic: new RegExp(`^${patient.nicNumber.trim()}$`, "i") });
    }

    let book = await SurgeryRecord.findOne({
      doctorId: doc._id,
      $or: matchOr
    });

    const parts = [];
    if (record) {
      const typeMap = {
        consultations: "OPD Consultation",
        prescriptions: "Prescription",
        reports: "Clinical Report",
        lab_tests: "Lab Test Report"
      };
      const label = typeMap[record.type] || "Medical Record";
      parts.push(`[${label}] ${record.title || ""}`);
      if (record.diagnosis) parts.push(`Diagnosis: ${record.diagnosis}`);
      if (record.medications) parts.push(`Medications: ${record.medications}`);
      if (record.description) parts.push(`Notes: ${record.description}`);
    }
    const entryNotes = parts.join("\n").trim();
    const isImage = record?.fileType?.startsWith("image/") && record?.fileData;

    if (!book) {
      book = new SurgeryRecord({
        doctorId: doc._id,
        name: patient.fullName || "Patient",
        nic: patient.nicNumber || "",
        patientId: patCode,
        hospital: doc.hospital || "Care101 Hospital",
        surgeryCardImage: isImage ? record.fileData : "",
        entries: entryNotes
          ? [{
              date: record.date || new Date(),
              notes: entryNotes,
              images: isImage ? [record.fileData] : []
            }]
          : [],
        updatedAt: new Date()
      });
      await book.save();
    } else {
      if (isNew && entryNotes && record?.type !== "lab_tests") {
        book.entries.unshift({
          date: record.date || new Date(),
          notes: entryNotes,
          images: isImage ? [record.fileData] : []
        });
      }
      if (!book.surgeryCardImage && isImage) {
        book.surgeryCardImage = record.fileData;
      }
      if (!book.patientId || book.patientId === String(patient._id)) {
        book.patientId = patCode;
      }
      if (!book.nic && patient.nicNumber) {
        book.nic = patient.nicNumber;
      }
      book.updatedAt = new Date();
      await book.save();
    }
    return book;
  } catch (err) {
    console.error("syncPatientDoctorRecordBook Error:", err.message);
    return null;
  }
};

// 1. UPLOAD A RECORD
router.post("/upload", auth, async (req, res) => {
  try {
    const { patientId, doctorId, type, title, doctorName, date, description, diagnosis, medications, fileData, fileType } = req.body;

    let actualPatientId = patientId || req.user.id;
    if (actualPatientId && !mongoose.Types.ObjectId.isValid(actualPatientId)) {
      const p = await Patient.findOne({ patientId: String(actualPatientId).trim().toUpperCase() });
      if (p) actualPatientId = p._id;
    }

    const { finalDoctorId, finalDoctorName, doctorDoc } = await resolveMedicalRecordDoctor(
      doctorId,
      doctorName,
      actualPatientId,
      req.user
    );

    const newRecord = new MedicalRecord({
      patientId: actualPatientId,
      doctorId: finalDoctorId,
      type: type || "consultations",
      title: title || "OPD Consultation",
      doctorName: finalDoctorName,
      date: date || new Date(),
      description,
      diagnosis,
      medications,
      fileData, // Base64 string
      fileType,
      updatedAt: new Date()
    });

    await newRecord.save();

    if (finalDoctorId) {
      await syncPatientDoctorRecordBook({
        patientId: actualPatientId,
        doctorId: finalDoctorId,
        doctorDoc,
        record: newRecord,
        isNew: true
      });
    }

    // ✅ CREATE NOTIFICATION based on record type
    try {
      const Notification = (await import("../models/Notification.js")).default;

      let notificationType = 'report';
      let notificationMessage = `New ${type} uploaded by ${finalDoctorName || 'your doctor'}: ${title}`;

      if (type === 'prescriptions') {
        notificationType = 'prescription';
        notificationMessage = `New prescription added by ${finalDoctorName || 'your doctor'}: ${title}`;
      } else if (type === 'lab_tests' || type === 'reports') {
        notificationType = 'lab_report';
        notificationMessage = `New clinical/lab report available (${finalDoctorName || 'Hospital'}): ${title}`;
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

// 1.1 UPDATE AN EXISTING RECORD (For Nurse / Doctor / Lab Assistant)
router.put("/:id", auth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ msg: "Record not found" });
    }

    const isOwner = record.patientId.toString() === req.user.id;
    const isAuthorized = ["doctor", "nurse", "lab_assistant", "system_admin"].includes(req.user.role);
    if (!isOwner && !isAuthorized) {
      return res.status(403).json({ msg: "Not authorized to update this record" });
    }

    const { title, type, date, description, diagnosis, medications, fileData, fileType, doctorId, doctorName } = req.body;

    if (title !== undefined) record.title = title;
    if (type !== undefined) record.type = type;
    if (date !== undefined) record.date = date;
    if (description !== undefined) record.description = description;
    if (diagnosis !== undefined) record.diagnosis = diagnosis;
    if (medications !== undefined) record.medications = medications;
    if (fileData !== undefined && fileData !== "") record.fileData = fileData;
    if (fileType !== undefined && fileType !== "") record.fileType = fileType;

    if (doctorId || doctorName || !record.doctorId) {
      const { finalDoctorId, finalDoctorName, doctorDoc } = await resolveMedicalRecordDoctor(
        doctorId || record.doctorId,
        doctorName || record.doctorName,
        record.patientId,
        req.user
      );
      if (finalDoctorId) record.doctorId = finalDoctorId;
      if (finalDoctorName) record.doctorName = finalDoctorName;
      record.updatedAt = new Date();
      await record.save();

      if (finalDoctorId) {
        await syncPatientDoctorRecordBook({
          patientId: record.patientId,
          doctorId: finalDoctorId,
          doctorDoc,
          record,
          isNew: false
        });
      }
    } else {
      record.updatedAt = new Date();
      await record.save();
    }

    res.json(record);
  } catch (err) {
    console.error("Update Record Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. GET ALL MY RECORDS (Without the heavy file data)
router.get("/my-records", auth, async (req, res) => {
  try {
    let targetPatientId = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(targetPatientId) && req.user.patientId) {
      const p = await Patient.findOne({ patientId: String(req.user.patientId).trim().toUpperCase() });
      if (p) targetPatientId = p._id;
    }
    const records = await MedicalRecord.find({ patientId: targetPatientId })
      .populate("doctorId", "name fullName specialization slmcReg hospital")
      .select("-fileData") // ⚡ Optimization: Don't send the huge file string yet
      .sort({ date: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET RECORDS FOR A SPECIFIC PATIENT (For Doctors, Nurses & Lab Assistants)
router.get("/patient/:patientId", auth, async (req, res) => {
  try {
    const { role } = req.user;
    if (role !== "doctor" && role !== "lab_assistant" && role !== "system_admin" && role !== "nurse" && role !== "patient") {
      return res.status(403).json({ msg: "Not authorized to view patient records" });
    }
    let targetPatientId = req.params.patientId;
    if (!mongoose.Types.ObjectId.isValid(targetPatientId)) {
      const p = await Patient.findOne({ patientId: String(targetPatientId).trim().toUpperCase() });
      if (p) targetPatientId = p._id;
    }
    const records = await MedicalRecord.find({ patientId: targetPatientId })
      .populate("doctorId", "name fullName specialization slmcReg hospital")
      .select("-fileData")
      .sort({ date: -1, createdAt: -1 });
    res.json(records);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. DOWNLOAD / VIEW SPECIFIC RECORD DETAILS & FILE
router.get("/download/:id", auth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ msg: "File not found" });

    // Security check
    const isOwner = record.patientId.toString() === req.user.id;
    const isAuthorized = ["doctor", "lab_assistant", "system_admin", "nurse"].includes(req.user.role);

    if (!isOwner && !isAuthorized) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    res.json({
      _id: record._id,
      title: record.title,
      type: record.type,
      doctorId: record.doctorId,
      doctorName: record.doctorName,
      date: record.date,
      description: record.description,
      diagnosis: record.diagnosis,
      medications: record.medications,
      fileData: record.fileData,
      fileType: record.fileType,
      fileName: record.title
    });
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
    const isAuthorized = ["doctor", "nurse", "system_admin"].includes(req.user.role);

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