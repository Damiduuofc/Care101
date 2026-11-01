import express from "express";
import { chatWithAI } from "../controllers/chatController.js";
import { protect, authorize } from "../middleware/authRole.js";
import { getPatientSummary } from "../services/patientSummaryService.js";

const router = express.Router();

router.post("/", protect, chatWithAI);

// AI pre-consultation summary card for nurses and doctors (?refresh=1 regenerates it)
router.get("/patient-summary/:patientId", protect, authorize(["doctor", "nurse", "system_admin"]), async (req, res) => {
  try {
    const summary = await getPatientSummary(req.params.patientId, { refresh: req.query.refresh === "1" });
    if (!summary) return res.status(404).json({ msg: "Patient not found" });
    res.json(summary);
  } catch (err) {
    console.error("Patient summary error:", err.message);
    res.status(500).json({ msg: "Could not generate patient summary" });
  }
});

export default router;
