import express from "express";
import Stripe from "stripe";
import Doctor from "../models/Doctor.js";
import { auth } from "../middleware/auth.js";

// Initialize Stripe with your Secret Key (from .env)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// ==========================================
// 1. CREATE PAYMENT INTENT
// This tells Stripe we are about to make a charge
// ==========================================
router.post("/create-payment-intent", auth, async (req, res) => {
  try {
    const { plan } = req.body;
    let amount = 0;

    // VALIDATE PLAN & SET PRICE
    // Always set the price on the backend to prevent frontend manipulation
    if (plan === 'premium') {
      amount = 499000; // 4990.00 LKR (Stripe uses smallest currency unit: cents)
    } else {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // Create the Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'lkr',
      automatic_payment_methods: { enabled: true },
      metadata: { doctorId: req.user.id, plan: plan }
    });

    // Send the client_secret to the frontend
    res.json({ clientSecret: paymentIntent.client_secret });

  } catch (err) {
    console.error("Stripe Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CONFIRM & UPGRADE
// Called by frontend after successful payment
// ==========================================
router.put("/confirm-upgrade", auth, async (req, res) => {
  try {
    // In a real production app, you would pass the paymentIntentId here
    // and retrieve it from Stripe to verify status === 'succeeded'
    // before upgrading the user.
    
    // Upgrade the doctor
    await Doctor.findByIdAndUpdate(req.user.id, {
      "subscription.plan": "premium",
      "subscription.startDate": Date.now(),
      "subscription.status": "active"
    });

    res.json({ msg: "Plan upgraded successfully" });

  } catch (err) {
    console.error("Upgrade Error:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 2. CONFIRM UPGRADE (Updated)
// ==========================================
router.put("/confirm-upgrade", auth, async (req, res) => {
  try {
    // Calculate 30 days from now
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30);

    await Doctor.findByIdAndUpdate(req.user.id, {
      "subscription.plan": "premium",
      "subscription.status": "active",
      "subscription.startDate": startDate,
      "subscription.endDate": endDate, // ✅ Access lasts 30 days
      "subscription.autoRenew": true
    });

    res.json({ msg: "Plan upgraded successfully" });
  } catch (err) {
    console.error("Upgrade Error:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 3. CANCEL SUBSCRIPTION (New)
// ==========================================
router.put("/cancel-subscription", auth, async (req, res) => {
  try {
    // We do NOT change the plan to 'free' yet.
    // We just turn off auto-renew. Access remains until endDate.
    
    await Doctor.findByIdAndUpdate(req.user.id, {
      "subscription.autoRenew": false
      // Status remains 'active' until the date expires (handled by middleware or cron job usually)
    });

    res.json({ msg: "Subscription cancelled. Access remains until billing cycle ends." });
  } catch (err) {
    console.error("Cancel Error:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});



export default router;