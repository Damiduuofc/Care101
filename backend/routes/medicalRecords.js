import express from "express";
import MedicalRecord from "../models/MedicalRecord.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. UPLOAD A RECORD
router.post("/upload", auth, async (req, res) => {
  try {
    const { type, title, doctorName, date, description, fileData, fileType } = req.body;

    const newRecord = new MedicalRecord({
      patientId: req.user.id,
      type,
      title,
      doctorName,
      date,
      description,
      fileData, // Base64 string
      fileType
    });

    await newRecord.save();
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

// 3. DOWNLOAD SPECIFIC FILE
router.get("/download/:id", auth, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ msg: "File not found" });

    // Security check
    if (record.patientId.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
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

    // Security Check: User must own the record
    if (record.patientId.toString() !== req.user.id) {
      return res.status(401).json({ msg: "Not authorized" });
    }

    await MedicalRecord.findByIdAndDelete(req.params.id);
    res.json({ msg: "Record removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

export default router;