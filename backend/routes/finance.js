import express from "express";
import HospitalFinance from "../models/Finance.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

/**
 * 1. GET ALL HOSPITAL FINANCE DATA
 */
router.get("/", auth, async (req, res) => {
  try {
    console.log("Finance GET request - Doctor ID:", req.user.id);

    const hospitals = await HospitalFinance.find({ doctorId: req.user.id });

    const data = hospitals.map((hospital) => {
      let channelingIncome = 0;
      let surgicalIncome = 0;

      if (hospital.records) {
        hospital.records.forEach((rec) => {
          const recordType = (rec.type || "").toLowerCase();
          const money = Number(rec.income) || Number(rec.amount) || 0;

          if (recordType === "channeling" || recordType === "appointment") {
            channelingIncome += money;
          } else if (
            recordType === "surgical" ||
            recordType === "surgery"
          ) {
            surgicalIncome += money;
          }
        });
      }

      const total = channelingIncome + surgicalIncome;

      return {
        id: hospital._id,
        name: hospital.name,
        channelingIncome,
        surgicalIncome,
        totalPayable: total,
      };
    });

    res.json(data);
  } catch (err) {
    console.error("Finance GET error:", err);
    res.status(500).json({ msg: "Server Error" });
  }
});

/**
 * 2. ADD HOSPITAL
 */
router.post("/add-hospital", auth, async (req, res) => {
  try {
    const { name } = req.body;

    const existing = await HospitalFinance.findOne({
      doctorId: req.user.id,
      name,
    });

    if (existing) {
      return res
        .status(400)
        .json({ msg: "A hospital with this name already exists." });
    }

    const newHospital = new HospitalFinance({
      doctorId: req.user.id,
      name,
    });

    await newHospital.save();
    res.json(newHospital);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

/**
 * 3. GET SINGLE HOSPITAL
 */
router.get("/:id", auth, async (req, res) => {
  try {
    const hospital = await HospitalFinance.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ msg: "Hospital not found" });
    }

    res.json(hospital);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

/**
 * 4. DELETE HOSPITAL
 */
router.delete("/:id", auth, async (req, res) => {
  try {
    const hospital = await HospitalFinance.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ msg: "Hospital not found" });
    }

    if (hospital.name === "Suwasevana") {
      return res
        .status(400)
        .json({ msg: "Cannot delete the default hospital Suwasevana" });
    }

    await HospitalFinance.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

/**
 * 5. ADD RECORD
 */
router.post("/:id/add-record", auth, async (req, res) => {
  try {
    const { type, date, patients, income, bht, amount } = req.body;

    const hospital = await HospitalFinance.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ msg: "Hospital not found" });
    }

    hospital.records.unshift({
      type,
      date,
      patients,
      income,
      bht,
      amount,
    });

    await hospital.save();
    res.json(hospital);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server Error" });
  }
});

/**
 * 6. DELETE RECORD
 */
router.delete("/:hospitalId/record/:recordId", auth, async (req, res) => {
  try {
    const hospital = await HospitalFinance.findById(
      req.params.hospitalId
    );

    if (!hospital) {
      return res.status(404).json({ msg: "Hospital not found" });
    }

    hospital.records = hospital.records.filter(
      (r) => r._id.toString() !== req.params.recordId
    );

    await hospital.save();
    res.json(hospital);
  } catch (err) {
    res.status(500).json({ msg: "Server Error" });
  }
});

export default router;