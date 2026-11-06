import express from "express";
import PushDevice from "../models/PushDevice.js";
import { protect } from "../middleware/authRole.js";
import { apnsEnabled } from "../utils/apns.js";
import { pushPatientUpdate } from "../utils/iosPush.js";

// Called by the iOS app's native code (not JS) with the signed-in user's token.
const router = express.Router();

const HEX_TOKEN = /^[0-9a-f]{32,400}$/i;
const cleanToken = (t) => String(t || "").trim().toLowerCase();

// POST /api/push/ios/register { deviceToken, environment, bundleId }
router.post("/ios/register", protect, async (req, res) => {
  const deviceToken = cleanToken(req.body?.deviceToken);
  if (!HEX_TOKEN.test(deviceToken)) return res.status(400).json({ msg: "Invalid device token" });
  const environment = req.body?.environment === "sandbox" ? "sandbox" : "production";
  try {
    let device = await PushDevice.findOne({ deviceToken });
    if (!device) device = new PushDevice({ deviceToken });
    // A different account signed in on this phone: drop the previous account's activities
    if (device.userId && String(device.userId) !== String(req.user.id)) device.liveActivities = [];
    device.userId = req.user.id;
    device.platform = "ios";
    device.environment = environment;
    device.bundleId = req.body?.bundleId;
    await device.save();
    pushPatientUpdate(req.user.id);
    // The app stops showing its own local alerts only when the server will push them
    res.json({ enabled: apnsEnabled() });
  } catch (err) {
    console.error("Push register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

// DELETE /api/push/ios/register { deviceToken } — on logout
router.delete("/ios/register", protect, async (req, res) => {
  const deviceToken = cleanToken(req.body?.deviceToken);
  try {
    await PushDevice.deleteOne({ deviceToken, userId: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/push/ios/push-to-start { deviceToken, token } (iOS 17.2+)
router.post("/ios/push-to-start", protect, async (req, res) => {
  const deviceToken = cleanToken(req.body?.deviceToken);
  const token = cleanToken(req.body?.token);
  if (!HEX_TOKEN.test(deviceToken) || !HEX_TOKEN.test(token)) return res.status(400).json({ msg: "Invalid token" });
  try {
    const r = await PushDevice.updateOne({ deviceToken, userId: req.user.id }, { $set: { pushToStartToken: token } });
    res.json({ ok: r.matchedCount > 0 });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// POST /api/push/ios/live-activity { deviceToken, appointmentId, token, ended }
router.post("/ios/live-activity", protect, async (req, res) => {
  const deviceToken = cleanToken(req.body?.deviceToken);
  const appointmentId = String(req.body?.appointmentId || "").trim();
  const token = req.body?.token ? cleanToken(req.body.token) : null;
  const ended = !!req.body?.ended;
  if (!HEX_TOKEN.test(deviceToken) || !appointmentId || (token && !HEX_TOKEN.test(token))) {
    return res.status(400).json({ msg: "Invalid request" });
  }
  try {
    const device = await PushDevice.findOne({ deviceToken, userId: req.user.id });
    if (!device) return res.status(404).json({ msg: "Device not registered" });
    let act = device.liveActivities.find((a) => a.appointmentId === appointmentId);
    if (!act) {
      device.liveActivities.push({ appointmentId });
      act = device.liveActivities[device.liveActivities.length - 1];
    }
    if (token) act.token = token;
    act.endedAt = ended ? new Date() : null;
    act.updatedAt = new Date();
    await device.save();
    // Send the current state right away so the activity is correct from the start
    if (!ended) pushPatientUpdate(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Live activity register error:", err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
