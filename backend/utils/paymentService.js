import Stripe from "stripe";
import Bill from "../models/Bill.js";
import Appointment from "../models/Appointment.js";
import Notification from "../models/Notification.js";
import HospitalFinance from "../models/Finance.js";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import { generateReceiptPdf } from "./pdfService.js";
import { sendPaymentReceipt } from "./emailService.js";
import { assignQueueToken } from "./queueToken.js";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe amounts are in the smallest currency unit (LKR cents)
export const toStripeAmount = (amount) => Math.round(Number(amount) * 100);

const HOSPITAL_NAME = "Suwasevana";
const HOSPITAL_CHANNELING_SHARE = 1500;

// Intents that can still be paid with the same client secret
const REUSABLE_INTENT_STATUSES = ["requires_payment_method", "requires_confirmation", "requires_action"];

// Returns a PaymentIntent for the bill, reusing the bill's existing one when it can still be paid
// (so a retried or repeated "Pay" never creates a second charge for the same bill).
export const getOrCreateBillIntent = async (bill) => {
  if (bill.paymentIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(bill.paymentIntentId);
      if (existing.status === "succeeded" || existing.status === "processing") {
        return existing;
      }
      if (REUSABLE_INTENT_STATUSES.includes(existing.status) && existing.amount === toStripeAmount(bill.amount)) {
        return existing;
      }
    } catch (err) {
      console.error("Failed to retrieve existing PaymentIntent:", err.message);
    }
  }

  const intent = await stripe.paymentIntents.create({
    amount: toStripeAmount(bill.amount),
    currency: "lkr",
    // Card-style methods only: redirect-based methods can leave the app without returning a result
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: {
      billId: String(bill._id),
      patientId: String(bill.patientId),
      appointmentId: bill.appointmentId ? String(bill.appointmentId) : ""
    }
  });

  bill.paymentIntentId = intent.id;
  await bill.save();
  return intent;
};

// Checks with Stripe that the intent really paid this bill in full.
export const verifyIntentForBill = async (bill, paymentIntentId) => {
  const intentId = paymentIntentId || bill.paymentIntentId;
  if (!intentId) return { ok: false, reason: "No payment found for this bill" };

  const intent = await stripe.paymentIntents.retrieve(intentId);
  if (intent.metadata?.billId && intent.metadata.billId !== String(bill._id)) {
    return { ok: false, reason: "Payment does not belong to this bill" };
  }
  if (intent.status === "processing") {
    return { ok: false, pending: true, reason: "Payment is still processing" };
  }
  if (intent.status !== "succeeded") {
    return { ok: false, reason: `Payment not completed (${intent.status})` };
  }
  if (intent.amount_received < toStripeAmount(bill.amount)) {
    return { ok: false, reason: "Paid amount does not match the bill" };
  }
  return { ok: true, intent };
};

const recordChannelingIncome = async (appointment, totalAmount) => {
  const hospitalIncome = HOSPITAL_CHANNELING_SHARE;
  const doctorIncome = totalAmount > hospitalIncome ? totalAmount - hospitalIncome : 0;
  const date = new Date(appointment.date);

  let doctorFinance = await HospitalFinance.findOne({ doctorId: appointment.doctorId, name: HOSPITAL_NAME });
  if (!doctorFinance) {
    doctorFinance = new HospitalFinance({ doctorId: appointment.doctorId, name: HOSPITAL_NAME, records: [] });
  }
  doctorFinance.records.unshift({ type: "channeling", date, patients: 1, income: doctorIncome });
  await doctorFinance.save();

  let systemFinance = await HospitalFinance.findOne({ doctorId: null, name: HOSPITAL_NAME });
  if (!systemFinance) {
    systemFinance = new HospitalFinance({ doctorId: null, name: HOSPITAL_NAME, records: [] });
  }
  systemFinance.records.unshift({ type: "channeling", date, patients: 1, income: hospitalIncome });
  await systemFinance.save();
};

// Marks a bill paid exactly once (safe to call again from retries or reconciliation):
// updates the linked appointment, issues its queue token, records income, notifies and emails a receipt.
export const markBillPaid = async (billId, paymentIntentId, io) => {
  const bill = await Bill.findOneAndUpdate(
    { _id: billId, status: { $ne: "Paid" } },
    { status: "Paid", paidAt: new Date(), ...(paymentIntentId ? { paymentIntentId } : {}) },
    { new: true }
  );

  // Already marked paid by an earlier call
  if (!bill) return { bill: await Bill.findById(billId), alreadyPaid: true };

  let appointment = null;
  if (bill.appointmentId) {
    appointment = await Appointment.findById(bill.appointmentId);
    if (appointment && appointment.paymentStatus !== "paid") {
      appointment.paymentStatus = "paid";
      if (appointment.status !== "cancelled") {
        appointment.status = "confirmed";
        await assignQueueToken(appointment);
      }
      await appointment.save();

      try {
        await recordChannelingIncome(appointment, appointment.amount || bill.amount);
      } catch (finErr) {
        console.error("Finance Update Failed:", finErr);
      }

      if (io) io.emit("appointmentUpdated", appointment);
    }
  }

  try {
    const notif = await Notification.create({
      userId: bill.patientId,
      type: "payment",
      title: "Payment Confirmed",
      message: appointment?.queueNumber
        ? `Payment Successful! LKR ${bill.amount} paid for ${bill.title}. Your queue token is #${appointment.queueNumber}.`
        : `Payment Successful! LKR ${bill.amount} paid for ${bill.title}.`
    });
    if (io && notif) io.emit("newNotification", notif);
  } catch (notifErr) {
    console.error("Payment notification error:", notifErr);
  }

  // Generate PDF and email receipt in the background
  (async () => {
    try {
      const patient = await Patient.findById(bill.patientId);
      if (!patient) return;
      const doctor = appointment ? await Doctor.findById(appointment.doctorId) : null;
      let pdfBuffer = null;
      try {
        pdfBuffer = await generateReceiptPdf(bill, appointment, doctor, patient);
      } catch (pdfErr) {
        console.error("Failed to generate PDF receipt:", pdfErr);
      }
      await sendPaymentReceipt(patient.email, bill, pdfBuffer);
    } catch (pdfEmailErr) {
      console.error("Failed to generate/send PDF receipt:", pdfEmailErr);
    }
  })();

  return { bill, appointment, alreadyPaid: false };
};

const lastReconciledAt = new Map();
const RECONCILE_INTERVAL_MS = 30 * 1000;

// Recovers payments that succeeded in Stripe but were never recorded
// (e.g. the app lost connection right after the card was charged).
// Throttled per patient because it's called from endpoints the app polls.
export const reconcilePendingBills = async (patientId, io) => {
  const key = String(patientId);
  const now = Date.now();
  if (now - (lastReconciledAt.get(key) || 0) < RECONCILE_INTERVAL_MS) return;
  lastReconciledAt.set(key, now);

  const pendingBills = await Bill.find({
    patientId,
    status: "Pending",
    paymentIntentId: { $exists: true, $ne: null }
  });

  for (const bill of pendingBills) {
    try {
      const result = await verifyIntentForBill(bill);
      if (result.ok) {
        await markBillPaid(bill._id, result.intent.id, io);
        console.log(`✅ Recovered unrecorded payment for bill ${bill._id}`);
      }
    } catch (err) {
      console.error(`Payment reconciliation failed for bill ${bill._id}:`, err.message);
    }
  }
};
