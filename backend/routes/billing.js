import express from "express";
import Stripe from "stripe";
import Bill from "../models/Bill.js";
import Notification from "../models/Notification.js";
import Appointment from "../models/Appointment.js"; 
import { auth } from "../middleware/auth.js";

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ==========================================
// 1. GET ALL BILLS
// ==========================================
router.get("/", auth, async (req, res) => {
  try {
    const bills = await Bill.find({ patientId: req.user.id }).sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// ==========================================
// 2. CREATE STRIPE CHECKOUT SESSION
// ==========================================
router.post("/create-checkout-session", auth, async (req, res) => {
  try {
    const { billIds } = req.body; 
    
    // Security: Fetch from DB to verify amounts
    const bills = await Bill.find({ 
      _id: { $in: billIds },
      patientId: req.user.id,
      status: "Pending"
    });

    if (!bills.length) return res.status(404).json({ msg: "No valid pending bills found" });

    const line_items = bills.map(bill => ({
      price_data: {
        currency: "lkr",
        product_data: { name: bill.title, metadata: { type: bill.type } },
        unit_amount: bill.amount * 100, // Stripe expects cents
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

// ==========================================
// 3. MARK PAID (Syncs Bills, Appointments & Notifications)
// ==========================================
router.put("/mark-paid", auth, async (req, res) => {
  try {
    const { billIds } = req.body;

    // A. Update Bills to "Paid"
    await Bill.updateMany(
      { _id: { $in: billIds }, patientId: req.user.id },
      { $set: { status: "Paid" } }
    );

    // B. Sync Linked Appointments
    const paidBills = await Bill.find({ _id: { $in: billIds } });
    
    // Get valid Appointment IDs linked to these bills
    const appointmentIds = paidBills
      .map(bill => bill.appointmentId)
      .filter(id => id); // Remove null/undefined

    if (appointmentIds.length > 0) {
      // Update linked appointments to Paid & Confirmed
      await Appointment.updateMany(
        { _id: { $in: appointmentIds } },
        { 
          $set: { 
            paymentStatus: "paid", // Lowercase for Admin Panel
            status: "confirmed"    // Auto-confirm booking
          } 
        }
      );
      console.log(`✅ Synced ${appointmentIds.length} appointments`);
    }

    // C. Create Notification
    try {
      const message = billIds.length === 1 
        ? `Payment successful for '${paidBills[0]?.title}'`
        : `Bulk payment for ${billIds.length} items was successful.`;

      await Notification.create({
          userId: req.user.id,
          type: 'payment',
          message: message
      });
    } catch (notifError) {
      console.error("Notification failed", notifError);
    }

    res.json({ msg: "Payment Successful, Appointments Updated & Notified" });

  } catch (err) {
    console.error("Payment Sync Error:", err);
    res.status(500).send("Server Error");
  }
});

export default router;