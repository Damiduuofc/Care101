import express from "express";
import { auth } from "../middleware/auth.js";
import Bill from "../models/Bill.js";
import {
  stripe,
  getOrCreateBillIntent,
  verifyIntentForBill,
  markBillPaid,
  reconcilePendingBills
} from "../utils/paymentService.js";

const router = express.Router();

// 1. GET ALL MY BILLS (Pending & Paid)
router.get("/my-bills", auth, async (req, res) => {
  try {
    // Record any payment that went through in Stripe but never reached our records
    await reconcilePendingBills(req.user.id, req.io);

    const bills = await Bill.find({ patientId: req.user.id })
      .populate("patientId", "fullName nicNumber")
      .sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    console.error("Fetch Bills Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// 2. CREATE PAYMENT INTENT
// Preferred: { billId } -> intent tied to that bill (amount taken from the bill, reused on retry).
// Legacy: { amount } in cents, for older app builds.
router.post("/create-intent", auth, async (req, res) => {
  try {
    const { billId, amount } = req.body;

    if (billId) {
      const bill = await Bill.findOne({ _id: billId, patientId: req.user.id });
      if (!bill) {
        return res.status(404).json({ msg: "Bill not found" });
      }
      if (bill.status === "Paid") {
        return res.json({ alreadyPaid: true, billId: bill._id });
      }
      if (!bill.amount || bill.amount <= 0) {
        return res.status(400).json({ msg: "This bill has no amount yet. Please wait until the price is set." });
      }

      const intent = await getOrCreateBillIntent(bill);

      // Charged earlier but not recorded: record it now instead of charging again
      if (intent.status === "succeeded") {
        await markBillPaid(bill._id, intent.id, req.io);
        return res.json({ alreadyPaid: true, billId: bill._id });
      }
      if (intent.status === "processing") {
        return res.status(409).json({ msg: "A payment for this bill is still processing. Please check again shortly." });
      }

      return res.json({
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        billId: bill._id
      });
    }

    if (!amount) {
      return res.status(400).json({ msg: "Amount is required" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: "lkr",
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { patientId: String(req.user.id) }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (err) {
    console.error("Stripe Error:", err.message);
    res.status(500).json({ msg: "Payment initiation failed", error: err.message });
  }
});

// 3. MARK BILL AS PAID (After Frontend Stripe Success)
// Verifies the payment with Stripe and is safe to retry.
router.put("/pay-bill/:billId", auth, async (req, res) => {
  try {
    const { paymentIntentId } = req.body || {};
    const bill = await Bill.findOne({ _id: req.params.billId, patientId: req.user.id });

    if (!bill) {
      return res.status(404).json({ msg: "Bill not found" });
    }

    if (bill.status === "Paid") {
      return res.json({ msg: "Bill already paid", bill });
    }

    if (paymentIntentId || bill.paymentIntentId) {
      const result = await verifyIntentForBill(bill, paymentIntentId);
      if (!result.ok) {
        return res.status(result.pending ? 202 : 400).json({ msg: result.reason, pending: Boolean(result.pending) });
      }
      const { bill: paidBill, appointment } = await markBillPaid(bill._id, result.intent.id, req.io);
      return res.json({ msg: "Bill marked as Paid", bill: paidBill, queueNumber: appointment?.queueNumber || null });
    }

    // Older app builds pay with an amount-only intent and send no intent id
    console.warn(`pay-bill without a PaymentIntent for bill ${bill._id} (legacy client)`);
    const { bill: paidBill, appointment } = await markBillPaid(bill._id, null, req.io);
    res.json({ msg: "Bill marked as Paid", bill: paidBill, queueNumber: appointment?.queueNumber || null });
  } catch (err) {
    console.error("Update Bill Error:", err.message);
    res.status(500).send("Server Error");
  }
});

export default router;
