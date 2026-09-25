import express from "express";
import mongoose from "mongoose";
import LabRequest from "../models/LabRequest.js";
import MedicalRecord from "../models/MedicalRecord.js";
import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import Admin from "../models/Admin.js";
import { syncPatientDoctorRecordBook } from "./medicalRecords.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

const resolveDoctorDisplay = (doc) => {
  if (!doc) return null;
  const name = doc.name || doc.fullName || doc.nameWithInitials;
  if (!name) return null;
  return name.startsWith("Dr.") ? name : `Dr. ${name}`;
};

const resolveDoctorName = async (reqDocId, reqDocName, patientId, user) => {
  // 1. If doctorId is provided, resolve from Doctor collection first
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

  // 2. If explicitly provided valid doctor name, try to also resolve Doctor document
  if (reqDocName && reqDocName.trim() !== "Doctor" && reqDocName.trim() !== "Nurse Requested" && !reqDocName.toLowerCase().includes("lab assistant")) {
    const clean = reqDocName.replace(/^(dr\.|dr)\s+/i, "").trim();
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matchedDoc = await Doctor.findOne({
      $or: [
        { name: { $regex: new RegExp(escaped, "i") } },
        { fullName: { $regex: new RegExp(escaped, "i") } }
      ]
    });
    if (matchedDoc) {
      return {
        finalDoctorId: matchedDoc._id,
        finalDoctorName: resolveDoctorDisplay(matchedDoc) || reqDocName,
        doctorDoc: matchedDoc
      };
    }
    if (reqDocName.startsWith("Dr.") || reqDocName.startsWith("Nurse") || reqDocName.startsWith("Lab")) {
      return { finalDoctorId: reqDocId || null, finalDoctorName: reqDocName, doctorDoc: null };
    }
    return { finalDoctorId: reqDocId || null, finalDoctorName: `Dr. ${reqDocName}`, doctorDoc: null };
  }

  // 3. If caller is doctor
  if (user?.role === "doctor" && user.id) {
    const doc = await Doctor.findById(user.id);
    const resolvedName = resolveDoctorDisplay(doc);
    if (resolvedName) {
      return { finalDoctorId: doc._id, finalDoctorName: resolvedName, doctorDoc: doc };
    }
  }

  // 4. If caller is nurse, check allocated doctor
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

  // 5. Check patient's latest appointment
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
        const formattedApptDoc = appt.doctorName.startsWith("Dr.") ? appt.doctorName : `Dr. ${appt.doctorName}`;
        return { finalDoctorId: appt.doctorId || null, finalDoctorName: formattedApptDoc, doctorDoc: null };
      }
    }
  }

  // 6. If lab assistant explicitly requested
  if (user?.role === "lab_assistant" && reqDocName && reqDocName.toLowerCase().includes("lab assistant")) {
    return { finalDoctorId: null, finalDoctorName: "Lab Assistant", doctorDoc: null };
  }

  // 7. Fallback to first doctor in system
  const defaultDoc = await Doctor.findOne();
  if (defaultDoc) {
    const resolvedName = resolveDoctorDisplay(defaultDoc);
    if (resolvedName) {
      return { finalDoctorId: defaultDoc._id, finalDoctorName: resolvedName, doctorDoc: defaultDoc };
    }
  }

  return {
    finalDoctorId: reqDocId || null,
    finalDoctorName: user?.role === "lab_assistant" ? "Lab Assistant" : "Dr. Medical Officer",
    doctorDoc: null
  };
};

// 1. Doctor, Nurse or Lab Assistant creates a Lab Request
router.post("/create", auth, async (req, res) => {
  try {
    const { patientId, title, description, doctorId, doctorName, amount, type } = req.body;
    
    // Check if user is a doctor, nurse, or lab assistant
    if (req.user.role !== "doctor" && req.user.role !== "nurse" && req.user.role !== "lab_assistant") {
      return res.status(403).json({ msg: "Only doctors, nurses, and lab assistants can create lab requests" });
    }

    let actualPatientId = patientId;
    if (actualPatientId && !mongoose.Types.ObjectId.isValid(actualPatientId)) {
      const p = await Patient.findOne({ patientId: String(actualPatientId).trim().toUpperCase() });
      if (p) actualPatientId = p._id;
    }

    // Create associated Bill
    const newBill = new Bill({
      patientId: actualPatientId,
      title: `Lab Report - ${title}`,
      type: "Lab",
      amount: amount || 0, // Use set price if provided
      status: "Pending"
    });
    await newBill.save();

    const { finalDoctorId, finalDoctorName, doctorDoc } = await resolveDoctorName(doctorId, doctorName, actualPatientId, req.user);

    const newRequest = new LabRequest({
      patientId: actualPatientId,
      doctorId: finalDoctorId,
      doctorName: finalDoctorName,
      title,
      description,
      type: type || 'lab_tests',
      status: "pending",
      billId: newBill._id
    });

    await newRequest.save();

    // Ensure patient has a Medical Record Book (SurgeryRecord) for this doctor so the request is visible to the patient
    if (finalDoctorId) {
      await syncPatientDoctorRecordBook({
        patientId: actualPatientId,
        doctorId: finalDoctorId,
        doctorDoc,
        record: null,
        isNew: false
      });
    }

    // Create Notification for Patient & Lab Assistant
    try {
      const Notification = (await import("../models/Notification.js")).default;
      const patient = await Patient.findById(actualPatientId);
      await Notification.create({
        userId: actualPatientId,
        type: "lab_report",
        message: `New Lab Request: ${title} requested for ${patient?.fullName || 'you'} by ${finalDoctorName}.`,
        metadata: { requestId: newRequest._id }
      });
    } catch (err) {
      console.error("Notification Error:", err);
    }

    res.json(newRequest);
  } catch (err) {
    console.error("Create Lab Request Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. Get all Pending/Completed Requests (For Lab Assistants or System Admins)
router.get("/all", auth, async (req, res) => {
  try {
     // Fetch requests and populate patient, doctor, and bill info
     const requests = await LabRequest.find()
      .populate("patientId", "patientId fullName nicNumber email mobileNumber gender dateOfBirth")
      .populate("doctorId", "name fullName nameWithInitials specialization")
      .populate("billId")
      .sort({ createdAt: -1 });
     
     const enrichedRequests = await Promise.all(requests.map(async (r) => {
       const obj = r.toObject();
       let docName = obj.doctorName;

       // If docName is missing or generic "Doctor"
       if (!docName || docName.trim() === "Doctor" || docName.trim() === "Nurse Requested") {
         if (obj.doctorId && typeof obj.doctorId === "object") {
           const dName = resolveDoctorDisplay(obj.doctorId);
           if (dName) docName = dName;
         }

         if (!docName || docName.trim() === "Doctor") {
           const patId = obj.patientId?._id || obj.patientId;
           if (patId) {
             const appt = await Appointment.findOne({ patientId: patId }).sort({ createdAt: -1 });
             if (appt && appt.doctorName && appt.doctorName.trim() !== "Doctor") {
               docName = appt.doctorName.startsWith("Dr.") ? appt.doctorName : `Dr. ${appt.doctorName}`;
             }
           }
         }

         if (!docName || docName.trim() === "Doctor") {
           const anyDoc = await Doctor.findOne();
           if (anyDoc) {
             const dName = resolveDoctorDisplay(anyDoc);
             if (dName) docName = dName;
           }
         }

         if (!docName || docName.trim() === "Doctor") {
           docName = "Dr. Medical Officer";
         }

         // Heal DB record asynchronously
         LabRequest.updateOne({ _id: r._id }, { doctorName: docName }).exec().catch(() => {});
       } else if (!docName.startsWith("Dr.") && !docName.startsWith("Nurse") && !docName.startsWith("Lab")) {
         docName = `Dr. ${docName}`;
       }

       obj.doctorName = docName;
       return obj;
     }));

     res.json(enrichedRequests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. Get Lab Requests for a specific Patient
router.get("/patient/:patientId", auth, async (req, res) => {
  try {
    let targetPatientId = req.params.patientId;
    if (!mongoose.Types.ObjectId.isValid(targetPatientId)) {
      const p = await Patient.findOne({ patientId: String(targetPatientId).trim().toUpperCase() });
      if (p) targetPatientId = p._id;
    }
    const requests = await LabRequest.find({ patientId: targetPatientId })
      .populate("patientId", "patientId fullName nicNumber email mobileNumber gender dateOfBirth")
      .populate("doctorId", "name fullName nameWithInitials specialization")
      .populate("billId")
      .sort({ createdAt: -1 });

    const enrichedRequests = await Promise.all(requests.map(async (r) => {
      const obj = r.toObject();
      let docName = obj.doctorName;

      if (!docName || docName.trim() === "Doctor" || docName.trim() === "Nurse Requested") {
        if (obj.doctorId && typeof obj.doctorId === "object") {
          const dName = resolveDoctorDisplay(obj.doctorId);
          if (dName) docName = dName;
        }

        if (!docName || docName.trim() === "Doctor") {
          const appt = await Appointment.findOne({ patientId: targetPatientId }).sort({ createdAt: -1 });
          if (appt && appt.doctorName && appt.doctorName.trim() !== "Doctor") {
            docName = appt.doctorName.startsWith("Dr.") ? appt.doctorName : `Dr. ${appt.doctorName}`;
          }
        }

        if (!docName || docName.trim() === "Doctor") {
          const anyDoc = await Doctor.findOne();
          if (anyDoc) {
            const dName = resolveDoctorDisplay(anyDoc);
            if (dName) docName = dName;
          }
        }

        if (!docName || docName.trim() === "Doctor") {
          docName = "Dr. Medical Officer";
        }

        LabRequest.updateOne({ _id: r._id }, { doctorName: docName }).exec().catch(() => {});
      } else if (!docName.startsWith("Dr.") && !docName.startsWith("Nurse") && !docName.startsWith("Lab")) {
        docName = `Dr. ${docName}`;
      }

      obj.doctorName = docName;
      return obj;
    }));

    res.json(enrichedRequests);
  } catch(err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 4. Lab Assistant Uploads a Record & Completes Request
router.post("/upload/:requestId", auth, async (req, res) => {
  try {
    const { fileData, fileType, description } = req.body;
    
    const labRequest = await LabRequest.findById(req.params.requestId);
    if (!labRequest) return res.status(404).json({ msg: "Request not found" });

    // Ensure it's not already completed
    if (labRequest.status === "completed") {
      return res.status(400).json({ msg: "This request has already been completed" });
    }

    // Verify payment is completed before uploading
    if (labRequest.billId) {
      const bill = await Bill.findById(labRequest.billId);
      if (bill && bill.status !== "Paid") {
        return res.status(400).json({ msg: "Cannot upload report. Payment is pending for this lab request." });
      }
    } else {
      // Fallback: search for a matching bill if billId is not linked directly
      const bill = await Bill.findOne({
        patientId: labRequest.patientId,
        title: `Lab Report - ${labRequest.title}`,
        status: "Pending"
      });
      if (bill) {
        return res.status(400).json({ msg: "Cannot upload report. Payment is pending for this lab request." });
      }
    }

    // Create a new MedicalRecord using the request's type
    const newRecord = new MedicalRecord({
      patientId: labRequest.patientId,
      doctorId: labRequest.doctorId || null,
      type: labRequest.type || "lab_tests",
      title: labRequest.title,
      doctorName: labRequest.doctorName, // the one who requested
      date: new Date(),
      description: description || labRequest.description,
      fileData,
      fileType
    });

    await newRecord.save();

    if (labRequest.doctorId) {
      await syncPatientDoctorRecordBook({
        patientId: labRequest.patientId,
        doctorId: labRequest.doctorId,
        record: newRecord,
        isNew: false
      });
    }

    // Mark as completed
    labRequest.status = "completed";
    labRequest.recordId = newRecord._id;
    await labRequest.save();

    // Notify Doctor and Patient
    try {
      const Notification = (await import("../models/Notification.js")).default;
      const patient = await Patient.findById(labRequest.patientId);

      // Notify Doctor
      if (labRequest.doctorId) {
        await Notification.create({
          userId: labRequest.doctorId, // Assuming notifications support doctor ID
          type: "lab_report",
          message: `Lab Request Completed: ${labRequest.title} for patient ${patient?.fullName || ''}.`,
          metadata: { recordId: newRecord._id, patientId: labRequest.patientId }
        });
      }

      // Notify Patient
      await Notification.create({
        userId: labRequest.patientId,
        type: "lab_report",
        message: `Your lab result for ${labRequest.title} is now available.`,
        metadata: { recordId: newRecord._id }
      });
    } catch(err) {
      console.error("Notification Error:", err);
    }

    res.json({ msg: "Report uploaded successfully", record: newRecord, request: labRequest });
  } catch(err) {
    console.error("Upload Lab Report Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 5. Lab Assistant Updates Lab Request Bill Price
router.put("/update-price/:requestId", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    
    // Check if user is a lab assistant or system admin
    if (req.user.role !== "lab_assistant" && req.user.role !== "system_admin") {
      return res.status(403).json({ msg: "Not authorized to update price" });
    }

    const labRequest = await LabRequest.findById(req.params.requestId);
    if (!labRequest) return res.status(404).json({ msg: "Request not found" });

    if (!labRequest.billId) {
      return res.status(400).json({ msg: "No associated bill found for this request" });
    }

    const bill = await Bill.findById(labRequest.billId);
    if (!bill) return res.status(404).json({ msg: "Associated bill not found" });

    if (bill.status === "Paid") {
      return res.status(400).json({ msg: "Cannot change price of a paid bill" });
    }

    bill.amount = Number(amount);
    await bill.save();

    res.json({ msg: "Price updated successfully", bill, request: labRequest });
  } catch (err) {
    console.error("Update Price Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;
