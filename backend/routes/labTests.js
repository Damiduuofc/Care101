import express from "express";
import LabTest from "../models/LabTest.js";
import { protect, authorize } from "../middleware/authRole.js";

const router = express.Router();

const parseTest = (body) => {
  const name = String(body.name || "").trim();
  const price = Number(body.price);
  if (!name) return { error: "Test name is required" };
  if (body.price === undefined || body.price === "" || isNaN(price) || price < 0) {
    return { error: "A valid price is required" };
  }
  return {
    test: {
      name,
      code: body.code ? String(body.code).trim() : undefined,
      description: body.description,
      price,
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {})
    }
  };
};

// 1. List lab tests (active only, or all with ?all=true for the system admin)
router.get("/", protect, async (req, res) => {
  try {
    const showAll = req.query.all === "true" && req.user.role === "system_admin";
    const tests = await LabTest.find(showAll ? {} : { isActive: true }).sort({ name: 1 });
    res.json(tests);
  } catch (err) {
    console.error("List Lab Tests Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. System admin adds a lab test with its price
router.post("/", protect, authorize("system_admin"), async (req, res) => {
  try {
    const { test, error } = parseTest(req.body);
    if (error) return res.status(400).json({ msg: error });

    const exists = await LabTest.findOne({ name: new RegExp(`^${test.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    if (exists) return res.status(400).json({ msg: "A lab test with this name already exists" });

    const created = await LabTest.create(test);
    res.json(created);
  } catch (err) {
    console.error("Create Lab Test Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 3. System admin updates a lab test (price changes apply to new requests only)
router.put("/:id", protect, authorize("system_admin"), async (req, res) => {
  try {
    const { test, error } = parseTest(req.body);
    if (error) return res.status(400).json({ msg: error });

    const updated = await LabTest.findByIdAndUpdate(req.params.id, test, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ msg: "Lab test not found" });
    res.json(updated);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ msg: "A lab test with this name already exists" });
    console.error("Update Lab Test Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 4. System admin removes a lab test (existing requests keep their copied name and price)
router.delete("/:id", protect, authorize("system_admin"), async (req, res) => {
  try {
    const deleted = await LabTest.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ msg: "Lab test not found" });
    res.json({ msg: "Lab test removed" });
  } catch (err) {
    console.error("Delete Lab Test Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;
