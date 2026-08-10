import express from "express";
import LabRequest from "../models/LabRequest.js";
import MedicalRecord from "../models/MedicalRecord.js";
import Patient from "../models/Patient.js";
import Bill from "../models/Bill.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. Doctor creates a Lab Request
router.post("/create", auth, async (req, res) => {
  try {
    const { patientId, title, description } = req.body;
    
    // Check if user is a doctor
    if (req.user.role !== "doctor") {
      return res.status(403).json({ msg: "Only doctors can create lab requests" });
    }

    // Create associated Bill
    const newBill = new Bill({
      patientId,
      title: `Lab Report - ${title}`,
      type: "Lab",
      amount: 0, // Lab Assistant will update this price later
      status: "Pending"
    });
    await newBill.save();

    const newRequest = new LabRequest({
      patientId,
      doctorId: req.user.id,
      doctorName: req.user.name || "Doctor",
      title,
      description,
      status: "pending",
      billId: newBill._id
    });

    await newRequest.save();

    // Create Notification for Lab Assistant (Optional)
    try {
      const Notification = (await import("../models/Notification.js")).default;
      const patient = await Patient.findById(patientId);
      await Notification.create({
        userId: patientId,
        type: "lab_report",
        message: `New Lab Request: ${title} requested for ${patient?.fullName || 'a patient'} by ${req.user.name}.`,
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
     // Fetch requests and populate patient and bill info
     const requests = await LabRequest.find()
      .populate("patientId", "fullName nic email mobileNumber")
      .populate("billId")
      .sort({ createdAt: -1 });
     
     res.json(requests);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// 3. Get Lab Requests for a specific Patient
router.get("/patient/:patientId", auth, async (req, res) => {
  try {
    const requests = await LabRequest.find({ patientId: req.params.patientId })
      .populate("patientId", "fullName nic email")
      .populate("billId")
      .sort({ createdAt: -1 });
    res.json(requests);
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

    // Create a new MedicalRecord of type 'lab_tests'
    const newRecord = new MedicalRecord({
      patientId: labRequest.patientId,
      type: "lab_tests",
      title: labRequest.title,
      doctorName: labRequest.doctorName, // the one who requested
      date: new Date(),
      description: description || labRequest.description,
      fileData,
      fileType
    });

    await newRecord.save();

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
