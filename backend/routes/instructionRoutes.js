import express from "express";
import Instruction from "../models/Instruction.js";
import { auth } from "../middleware/auth.js";
import multer from "multer"; // ✅ IMPORTED
import path from "path";     // ✅ IMPORTED

const router = express.Router();

// ==========================================
// 1. MULTER CONFIG (Must be at the TOP)
// ==========================================
const storage = multer.diskStorage({
  destination(req, file, cb) {
    // Save to 'uploads' folder in the root directory
    cb(null, "uploads/"); 
  },
  filename(req, file, cb) {
    // Generate unique filename: fieldname-timestamp.ext
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// Initialize Multer Middleware
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

// CREATE New Instruction
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

// DELETE Instruction
router.delete("/:id/:section/:type", auth, async (req, res) => {
  try {
    const { id, section, type } = req.params;
    
    // Determine field to clear (e.g., preOp.video)
    const updateField = section === "preOp" ? `preOp.${type}` : `postOp.${type}`;

    const updated = await Instruction.findByIdAndUpdate(
      id,
      { $set: { [updateField]: null } }, // Set value to null
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// UPDATE: Upload Route (Now works because 'upload' is defined above)
router.put("/:id/:section/:type", auth, upload.single("file"), async (req, res) => {
  try {
    const { id, section, type } = req.params;
    
    // Check if file exists
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }

    // Construct the file URL
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    // Determine if it updates preOp or postOp
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