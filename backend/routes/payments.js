import express from "express";
import Stripe from "stripe";
import { auth } from "../middleware/auth.js";

const router = express.Router();
// Initialize Stripe with your Secret Key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/payments/create-intent
router.post("/create-intent", auth, async (req, res) => {
  try {
    const { amount } = req.body; // Amount in cents (passed from frontend)

    if (!amount) {
      return res.status(400).json({ msg: "Amount is required" });
    }

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
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

export default router;