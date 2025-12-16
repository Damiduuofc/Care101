import express from "express";
import SurgeryRecord from "../models/SurgeryRecord.js"; 
import { auth } from "../middleware/auth.js";
import { checkPlanLimits } from "../utils/checkLimits.js"; // ✅ Import

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

// 2. CREATE NEW RECORD (Apply Limit: Max 4)
router.post("/create", auth, async (req, res) => {
  try {
    // 🛑 CHECK LIMIT
    try {
      await checkPlanLimits(req.user.id, 'create_record');
    } catch (limitErr) {
      return res.status(403).json({ msg: limitErr.message, upgradeRequired: true });
    }

    const { name, nic, hospital, surgeryCardImage } = req.body;

    if (!name || !surgeryCardImage) {
      return res.status(400).json({ msg: "Name and Surgery Card Image are required" });
    }

    const newRecord = new SurgeryRecord({
      doctorId: req.user.id,
      name,
      nic,
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
    const record = await SurgeryRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ msg: "Record not found" });
    res.json(record);
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

// 5. ADD PROGRESS ENTRY (Apply Limit: Max 3 per patient)
router.post("/:id/entry", auth, async (req, res) => {
  try {
    // 🛑 CHECK LIMIT
    try {
      await checkPlanLimits(req.user.id, 'add_entry', req.params.id);
    } catch (limitErr) {
      return res.status(403).json({ msg: limitErr.message, upgradeRequired: true });
    }

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

export default router;