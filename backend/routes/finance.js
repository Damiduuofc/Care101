import express from "express";
import HospitalFinance from "../models/Finance.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// 1. GET ALL HOSPITALS (Main Finance Screen)
router.get("/", auth, async (req, res) => {
  try {
    const hospitals = await HospitalFinance.find({ doctorId: req.user.id });
    
    // Calculate totals for each hospital dynamically
    const data = hospitals.map(hospital => {
      let channelingIncome = 0;
      let surgicalIncome = 0;

      hospital.records.forEach(rec => {
        if (rec.type === 'channeling') channelingIncome += (rec.income || 0);
        if (rec.type === 'surgical') surgicalIncome += (rec.amount || 0);
      });

      let total = channelingIncome + surgicalIncome;
      if (hospital.whtEnabled) total = total * 0.95; // Deduct 5% WHT

      return {
        id: hospital._id,
        name: hospital.name,
        whtEnabled: hospital.whtEnabled,
        channelingIncome,
        surgicalIncome,
        totalPayable: total
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 2. ADD NEW HOSPITAL
router.post("/add-hospital", auth, async (req, res) => {
  try {
    const { name, whtEnabled } = req.body;
    const newHospital = new HospitalFinance({
      doctorId: req.user.id,
      name,
      whtEnabled
    });
    await newHospital.save();
    res.json(newHospital);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 3. DELETE HOSPITAL
router.delete("/:id", auth, async (req, res) => {
  try {
    await HospitalFinance.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 4. GET SINGLE HOSPITAL DETAILS (Inside [id].tsx)
router.get("/:id", auth, async (req, res) => {
  let total = channelingIncome + surgicalIncome;
  if (hospital.whtEnabled) {
    total = total * 0.95; // 5% Deduction
}
  try {
    const hospital = await HospitalFinance.findById(req.params.id);
    if (!hospital) return res.status(404).json({ msg: "Not Found" });
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 5. ADD RECORD (Channeling or Surgical)
router.post("/:id/add-record", auth, async (req, res) => {
  try {
    const { type, date, patients, income, bht, amount } = req.body;
    const hospital = await HospitalFinance.findById(req.params.id);

    const newRecord = {
      type,
      date,
      patients: type === 'channeling' ? patients : undefined,
      income: type === 'channeling' ? income : undefined,
      bht: type === 'surgical' ? bht : undefined,
      amount: type === 'surgical' ? amount : undefined
    };

    hospital.records.unshift(newRecord); // Add to top
    await hospital.save();
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

// 6. DELETE RECORD
router.delete("/:hospitalId/record/:recordId", auth, async (req, res) => {
  try {
    const hospital = await HospitalFinance.findById(req.params.hospitalId);
    hospital.records = hospital.records.filter(r => r._id.toString() !== req.params.recordId);
    await hospital.save();
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;