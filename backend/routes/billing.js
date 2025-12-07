import express from "express";
import Stripe from "stripe";
import Bill from "../models/Bill.js";
import Notification from "../models/Notification.js"; // ✅ 1. IMPORT THIS
import { auth } from "../middleware/auth.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1. GET ALL BILLS
router.get("/", auth, async (req, res) => {
  try {
    const bills = await Bill.find({ patientId: req.user.id }).sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 2. CREATE A BILL
router.post("/create", auth, async (req, res) => {
  try {
    const { title, type, amount } = req.body;
    const newBill = new Bill({
      patientId: req.user.id,
      title,
      type,
      amount,
      status: 'Pending'
    });
    await newBill.save();
    res.json(newBill);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 3. PAY MULTIPLE BILLS (STRIPE)
router.post("/create-checkout-session", auth, async (req, res) => {
  try {
    const { billIds } = req.body; 
    const bills = await Bill.find({ _id: { $in: billIds } });

    if (!bills.length) return res.status(404).json({ msg: "No bills found" });

    const line_items = bills.map(bill => ({
      price_data: {
        currency: "lkr",
        product_data: { name: bill.title, metadata: { type: bill.type } },
        unit_amount: bill.amount * 100,
      },
      quantity: 1,
    }));

    const idsString = billIds.join(',');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/patient/billing?success=true&billIds=${idsString}`,
      cancel_url: `${process.env.CLIENT_URL}/patient/billing?canceled=true`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Error:", err);
    res.status(500).send("Server Error");
  }
});

// 4. ✅ MARK SINGLE BILL AS PAID (Redirect Success)
router.put("/mark-paid/:id", auth, async (req, res) => {
  try {
    const bill = await Bill.findByIdAndUpdate(req.params.id, { status: "Paid" });

    // ✅ CREATE NOTIFICATION
    await Notification.create({
        userId: req.user.id,
        type: 'payment',
        message: `Payment of LKR ${bill.amount.toLocaleString()} for '${bill.title}' was successful.`
    });

    res.json({ msg: "Payment Recorded" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// 5. ✅ MARK MULTIPLE AS PAID (Bulk Success)
router.put("/mark-paid", auth, async (req, res) => {
  try {
    const { billIds } = req.body; 
    
    // Update Bills
    await Bill.updateMany({ _id: { $in: billIds } }, { status: "Paid" });
    
    // ✅ CREATE NOTIFICATION (General message for bulk)
    await Notification.create({
        userId: req.user.id,
        type: 'payment',
        message: `Bulk payment for ${billIds.length} items was successful.`
    });
    
    res.json({ msg: "Payments Recorded" });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

export default router;