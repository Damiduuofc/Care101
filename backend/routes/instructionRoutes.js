import express from "express";
import Instruction from "../models/Instruction.js";
import { auth } from "../middleware/auth.js";
import multer from "multer"; 
import path from "path";     

const router = express.Router();

// ==========================================
// 1. MULTER CONFIG
// ==========================================
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "uploads/"); 
  },
  filename(req, file, cb) {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

// ==========================================
// 2. ROUTES
// ==========================================

// GET All Instructions
router.get("/", auth, async (req, res) => {
  try {
    const list = await Instruction.find({ doctor: req.user.id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) { res.status(500).send("Server Error"); }
});

// CREATE New Instruction (Limit Removed)
router.post("/", auth, async (req, res) => {
  try {
    const { surgeryName, description } = req.body;
    const newInstruction = new Instruction({
      doctor: req.user.id,
      surgeryName,
      description
    });
    const saved = await newInstruction.save();
    res.json(saved);
  } catch (err) { res.status(500).send("Server Error"); }
});

// GET Single Instruction
router.get("/:id", auth, async (req, res) => {
  try {
    const item = await Instruction.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: "Not found" });
    res.json(item);
  } catch (err) { res.status(500).send("Server Error"); }
});

// ✅ ADDED: DELETE ENTIRE INSTRUCTION
// This fixes the "Delete Surgery" button in your app
router.delete("/:id", auth, async (req, res) => {
  try {
    const instruction = await Instruction.findById(req.params.id);
    if (!instruction) return res.status(404).json({ msg: "Not found" });

    // Optional: Add logic here to delete the associated files from 'uploads/' folder using fs.unlink
    
    await Instruction.findByIdAndDelete(req.params.id);
    res.json({ msg: "Instruction deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// DELETE Specific File (Video/Audio/Doc)
router.delete("/:id/:section/:type", auth, async (req, res) => {
  try {
    const { id, section, type } = req.params;
    
    const updateField = section === "preOp" ? `preOp.${type}` : `postOp.${type}`;

    const updated = await Instruction.findByIdAndUpdate(
      id,
      { $set: { [updateField]: null } }, 
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// UPDATE: Upload Route
router.put("/:id/:section/:type", auth, upload.single("file"), async (req, res) => {
  try {
    const { id, section, type } = req.params;
    
    if (!req.file) return res.status(400).send("No file uploaded");

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    const updateField = section === "preOp" ? `preOp.${type}` : `postOp.${type}`;

    const updated = await Instruction.findByIdAndUpdate(
      id,
      { $set: { [updateField]: fileUrl } },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

export default router;