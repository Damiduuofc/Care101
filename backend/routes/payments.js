import express from "express";
import Stripe from "stripe";
import { auth } from "../middleware/auth.js";
import Bill from "../models/Bill.js";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import { generateReceiptPdf } from "../utils/pdfService.js";
import { sendPaymentReceipt } from "../utils/emailService.js";

const router = express.Router();
// Initialize Stripe with your Secret Key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1. GET ALL MY BILLS (Pending & Paid)
router.get("/my-bills", auth, async (req, res) => {
  try {
    const bills = await Bill.find({ patientId: req.user.id })
      .populate("patientId", "fullName nicNumber")
      .sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    console.error("Fetch Bills Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. CREATE PAYMENT INTENT (For any amount)
router.post("/create-intent", auth, async (req, res) => {
  try {
    const { amount } = req.body; // Amount in cents (passed from frontend)

    if (!amount) {
      return res.status(400).json({ msg: "Amount is required" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: "lkr", // Change to "usd" if your Stripe account doesn't support LKR
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("Stripe Error:", err.message);
    res.status(500).json({ msg: "Payment initiation failed", error: err.message });
  }
});

// 3. MARK BILL AS PAID (After Frontend Stripe Success)
router.put("/pay-bill/:billId", auth, async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.billId, patientId: req.user.id });

    if (!bill) {
      return res.status(404).json({ msg: "Bill not found" });
    }

    bill.status = "Paid";
    await bill.save();

    // If it's an appointment bill, update appointment status too
    if (bill.appointmentId) {
      const appointment = await Appointment.findById(bill.appointmentId);
      if (appointment) {
        appointment.paymentStatus = "paid";
        await appointment.save();
      }
    }

    // Create Notification
    await Notification.create({
      userId: req.user.id,
      type: "payment",
      message: `Payment Successful! LKR ${bill.amount} paid for ${bill.title}.`
    });

    // Generate PDF and Email Receipt
    try {
      const patient = await Patient.findById(req.user.id);
      if (patient && patient.email) {
        let appointment = null;
        let doctor = null;
        if (bill.appointmentId) {
          appointment = await Appointment.findById(bill.appointmentId);
          if (appointment) {
            doctor = await Doctor.findById(appointment.doctorId);
          }
        }
        const pdfBuffer = await generateReceiptPdf(bill, appointment, doctor, patient);
        await sendPaymentReceipt(patient.email, bill, pdfBuffer);
      }
    } catch (pdfEmailErr) {
      console.error("Failed to generate/send PDF receipt:", pdfEmailErr);
    }

    res.json({ msg: "Bill marked as Paid", bill });
  } catch (err) {
    console.error("Update Bill Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;