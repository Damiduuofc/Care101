import Appointment from "../models/Appointment.js";
import PushDevice from "../models/PushDevice.js";
import { apnsEnabled, sendApns, isWrongEnvironment, isDeadToken } from "./apns.js";
import { buildWidgetStatus } from "./widgetStatus.js";
import { dayRange } from "./queueToken.js";

// iOS suspends the app (and its Socket.IO connection) in the background, so iPhones get
// queue changes through Apple push instead:
//   • alert pushes   → the same notifications Android shows (arrival, delay, "you're next"…)
//   • Live Activity  → token / ongoing token on the Lock Screen + Dynamic Island, updated live
//   • background push→ refreshes the home screen widget's data (iOS rate-limits these)

const LIVE_STATES = new Set(["queue", "upcoming"]);
const nowSec = () => Math.floor(Date.now() / 1000);
const idOf = (v) => (v?._id || v ? String(v?._id || v) : "");

// Send to a device's APNs environment, retrying the other one when Apple says the token
// belongs there (a debug build registered against production or vice versa).
const sendToDevice = async (device, opts) => {
  let result = await sendApns({ ...opts, environment: device.environment });
  if (isWrongEnvironment(result)) {
    const other = device.environment === "sandbox" ? "production" : "sandbox";
    const retry = await sendApns({ ...opts, environment: other });
    if (retry.ok || !isWrongEnvironment(retry)) {
      device.environment = other;
      device.$locals.dirty = true;
      result = retry;
    }
  }
  return result;
};

const logFailure = (what, result) => {
  if (!result.ok && result.reason !== "NotConfigured") {
    console.warn(`APNs ${what} failed: ${result.status} ${result.reason}`);
  }
};

// ---------------------------------------------------------------------------
// Alert notifications
// ---------------------------------------------------------------------------

export const sendAlertToUser = async (userId, notif) => {
  if (!apnsEnabled() || !userId || !notif?.message) return;
  try {
    const devices = await PushDevice.find({ userId });
    for (const device of devices) {
      const result = await sendToDevice(device, {
        deviceToken: device.deviceToken,
        pushType: "alert",
        collapseId: idOf(notif._id) || undefined,
        payload: {
          aps: {
            alert: { title: notif.title || "CareLink 101 Alert", body: notif.message },
            sound: "default",
            "thread-id": notif.type || "general"
          },
          notificationId: idOf(notif._id),
          type: notif.type || "",
          url: "carelink://patient-dashboard"
        }
      });
      if (isDeadToken(result)) {
        await PushDevice.deleteOne({ _id: device._id });
        continue;
      }
      logFailure("alert", result);
      if (device.$locals.dirty) await device.save();
    }
  } catch (err) {
    console.error("iOS alert push error:", err.message);
  }
};

// ---------------------------------------------------------------------------
// Live Activity + widget refresh
// ---------------------------------------------------------------------------

// Must match QueueActivityAttributes.ContentState in the iOS app (every key, same types).
export const liveActivityContentState = (s) => ({
  state: String(s.state || "upcoming"),
  myToken: String(s.myToken ?? "--"),
  ongoingToken: String(s.ongoingToken ?? 0),
  peopleAhead: Number(s.peopleAhead) || 0,
  room: String(s.room || "Room TBA"),
  channelingStatus: String(s.channelingStatus || "On Time"),
  channelingTime: String(s.channelingTime || ""),
  isArrived: !!s.isArrived,
  isDelayed: !!s.isDelayed,
  awaitingPayment: !!s.awaitingPayment
});

const activityAlert = (s) => {
  const cs = liveActivityContentState(s);
  if (cs.state === "queue") {
    return {
      title: `Live queue • ${s.doctorName || "Doctor"}`,
      body: `Now serving #${cs.ongoingToken}. Your token is #${cs.myToken}.`
    };
  }
  if (cs.isArrived) return { title: "Doctor Arrived", body: `${s.doctorName || "Your doctor"} is at ${cs.room}.` };
  if (cs.isDelayed) return { title: "Doctor Delay Notice", body: `${s.doctorName || "Your doctor"} is ${cs.channelingStatus}.` };
  return { title: "Today's appointment", body: `${s.doctorName || "Doctor"} • ${cs.room}` };
};

const refreshDevice = async (device, status) => {
  // appointmentId is only set for today's booking, so this is "today's appointment is still on"
  const currentId = LIVE_STATES.has(status.state) && status.appointmentId ? String(status.appointmentId) : null;
  const contentState = liveActivityContentState(status);

  // 1. Home screen widget data (background push; iOS may delay or coalesce these)
  const bg = await sendToDevice(device, {
    deviceToken: device.deviceToken,
    pushType: "background",
    priority: 5,
    collapseId: "widget",
    payload: { aps: { "content-available": 1 }, widget: status }
  });
  if (isDeadToken(bg)) return "delete";
  logFailure("widget refresh", bg);

  // 2. Live Activities
  const activities = device.liveActivities || [];
  for (const act of activities) {
    if (act.endedAt || !act.token) continue;
    const isCurrent = act.appointmentId === currentId;
    const result = await sendToDevice(device, {
      deviceToken: act.token,
      pushType: "liveactivity",
      priority: 10,
      payload: {
        aps: isCurrent
          ? {
              timestamp: nowSec(),
              event: "update",
              "content-state": contentState,
              "stale-date": nowSec() + 3 * 3600
            }
          : {
              timestamp: nowSec(),
              event: "end",
              "content-state": liveActivityContentState({ state: "completed" }),
              "dismissal-date": nowSec() + 15 * 60
            }
      }
    });
    if (isDeadToken(result)) {
      act.endedAt = new Date();
    } else {
      logFailure(`live activity ${isCurrent ? "update" : "end"}`, result);
      if (!isCurrent && result.ok) act.endedAt = new Date();
    }
    act.updatedAt = new Date();
    device.$locals.dirty = true;
  }

  // 3. Start a Live Activity remotely (iOS 17.2+) when the app isn't running to start it
  if (currentId && device.pushToStartToken) {
    const existing = activities.find((a) => a.appointmentId === currentId);
    if (!existing) {
      const result = await sendToDevice(device, {
        deviceToken: device.pushToStartToken,
        pushType: "liveactivity",
        priority: 10,
        payload: {
          aps: {
            timestamp: nowSec(),
            event: "start",
            "content-state": contentState,
            "stale-date": nowSec() + 3 * 3600,
            "attributes-type": "QueueActivityAttributes",
            attributes: {
              appointmentId: currentId,
              doctorName: String(status.doctorName || "Doctor"),
              hospitalName: String(status.hospitalName || "SUWASEWANA HOSPITAL")
            },
            alert: activityAlert(status)
          }
        }
      });
      logFailure("live activity start", result);
      if (result.ok) {
        device.liveActivities.push({ appointmentId: currentId, remoteStartAt: new Date() });
        device.$locals.dirty = true;
      } else if (isDeadToken(result)) {
        device.pushToStartToken = null;
        device.$locals.dirty = true;
      }
    }
  }

  // Keep the list short: drop activities that ended more than a day ago
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const kept = device.liveActivities.filter((a) => !a.endedAt || a.endedAt.getTime() > cutoff);
  if (kept.length !== device.liveActivities.length) {
    device.liveActivities = kept;
    device.$locals.dirty = true;
  }
  return "ok";
};

const refreshPatientNow = async (patientId) => {
  const devices = await PushDevice.find({ userId: patientId });
  if (!devices.length) return;
  const status = await buildWidgetStatus(patientId);
  for (const device of devices) {
    try {
      const outcome = await refreshDevice(device, status);
      if (outcome === "delete") await PushDevice.deleteOne({ _id: device._id });
      else if (device.$locals.dirty) await device.save();
    } catch (err) {
      console.error("iOS live push error:", err.message);
    }
  }
};

// Several events usually fire for one change (status + queue + notification), so coalesce
// them into one push per patient.
const pending = new Map();
const debounce = (key, fn, ms = 400) => {
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    fn().catch((err) => console.error("iOS push error:", err.message));
  }, ms));
};

export const pushPatientUpdate = (patientId) => {
  const id = idOf(patientId);
  if (!apnsEnabled() || !id) return;
  debounce(`patient:${id}`, () => refreshPatientNow(id));
};

// Call whenever a doctor's arrival, delay, session or current token changes.
export const pushDoctorQueueUpdate = (doctorId) => {
  const id = idOf(doctorId);
  if (!apnsEnabled() || !id) return;
  debounce(`doctor:${id}`, async () => {
    const appts = await Appointment.find({
      doctorId: id,
      date: dayRange(new Date()),
      status: { $nin: ["cancelled", "Cancelled"] }
    }).select("patientId");
    const patientIds = [...new Set(appts.map((a) => idOf(a.patientId)).filter(Boolean))];
    // Only patients with a registered iPhone cost anything beyond this query
    const withDevices = await PushDevice.distinct("userId", { userId: { $in: patientIds } });
    await Promise.all(withDevices.map((pid) => refreshPatientNow(String(pid))));
  });
};
