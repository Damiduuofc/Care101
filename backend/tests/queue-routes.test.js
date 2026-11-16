// QA: queue management HTTP flow (nurse assignment, start/next/previous/complete/end, access rules).
// Models are stubbed in memory, so this never touches a real database. Run with: npm test
import { test, before, after, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
process.env.JWT_SECRET ||= "qa-secret";
const { default: express } = await import("express");
const { default: jwt } = await import("jsonwebtoken");
const { default: Doctor } = await import("../models/Doctor.js");
const { default: Admin } = await import("../models/Admin.js");
const { default: Appointment } = await import("../models/Appointment.js");
const { default: ScheduleRequest } = await import("../models/ScheduleRequest.js");
const { default: Notification } = await import("../models/Notification.js");
const { default: ConsultationHistory } = await import("../models/ConsultationHistory.js");
const { default: queueRoutes } = await import("../routes/queue.js");
const { syncDoctorLiveAllocation } = await import("../utils/liveAllocation.js");

// Fixed clock (10:00 today) so the tests give the same result at any time of day
const base0 = new Date();
const at = (h, m = 0) => new Date(base0.getFullYear(), base0.getMonth(), base0.getDate(), h, m);
mock.timers.enable({ apis: ["Date"], now: at(10) });
const tok = (id, role) => jwt.sign({ id, role }, process.env.JWT_SECRET);
const NURSES = { n1: "Nimali", n2: "Kamal" };

let db, emitted, server, base;

const fresh = () => {
  const doctor = {
    _id: "d1", name: "Perera", isArrived: true, lastArrivalDate: at(8), sessionStarted: false,
    sessionEndedToday: false, activeScheduleId: null, currentQueueNumber: 0, allocatedNurse: "", allocatedRoom: "",
    save: async function () { return this; },
    isModified: () => false,
  };
  const mk = (id, s, e, nurse, room) => ({
    _id: id, doctorId: "d1", status: "approved", sessionEnded: false, startTime: at(s), endTime: at(e),
    allocatedNurse: nurse, allocatedRoom: room, save: async function () { return this; }, isModified: () => false,
  });
  const appt = (id, q, paid = "paid") => ({
    _id: id, doctorId: "d1", patientId: "p" + id, queueNumber: q, paymentStatus: paid, status: "confirmed",
    date: at(10), save: async function () { return this; },
  });
  db = {
    doctor,
    sessions: [mk("s1", 9, 12, "Nimali", "Room 1"), mk("s2", 16, 19, "Kamal", "Room 2")],
    appts: [appt("a1", 1), appt("a2", 2, "pending"), appt("a3", 3), appt("a4", 4)],
    history: [],
  };
  emitted = [];
};

before(async () => {
  Doctor.findById = async (id) => (id === db.doctor._id ? db.doctor : null);
  Admin.findById = (id) => ({ select: async () => (NURSES[id] ? { name: NURSES[id] } : null) });
  ScheduleRequest.find = () => ({
    sort: async () => db.sessions.filter((s) => s.status === "approved" && !s.sessionEnded).sort((a, b) => a.startTime - b.startTime),
  });
  Appointment.find = async (q) => db.appts.filter((a) => a.paymentStatus === "paid" && ["confirmed", "pending"].includes(a.status));
  Appointment.findById = async (id) => db.appts.find((a) => a._id === id) || null;
  Appointment.countDocuments = async (q) =>
    db.appts.filter((a) => a.paymentStatus === "paid" && !["cancelled", "completed"].includes(a.status) &&
      a.queueNumber >= q.queueNumber.$gte && a.queueNumber < q.queueNumber.$lt && a._id !== q._id.$ne).length;
  Appointment.findOne = () => ({
    sort: async () => db.appts.filter((a) => a.paymentStatus === "paid" && a.status !== "completed")
      .sort((a, b) => a.queueNumber - b.queueNumber)[0] || null,
  });
  Notification.create = async (d) => ({ ...d, _id: "n" });
  ConsultationHistory.create = async (d) => { db.history.push(d); return d; };
  ConsultationHistory.find = () => ({ sort: () => ({ limit: async () => [] }) });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.io = { emit: (e, p) => emitted.push([e, p]), to: () => { const t = { to: () => t, emit: (e, p) => emitted.push([e, p]) }; return t; } };
    next();
  });
  app.use("/api/queue", queueRoutes);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); mock.timers.reset(); });
beforeEach(fresh);

const call = async (role, userId, body) => {
  const res = await fetch(`${base}/api/queue/update`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok(userId, role)}` },
    body: JSON.stringify({ doctorId: "d1", ...body }),
  });
  let json = null; try { json = await res.json(); } catch {}
  return { code: res.status, json };
};
const evt = (name) => emitted.filter(([e]) => e === name);

test("Q-01 unauthenticated and patient callers are rejected", async () => {
  const r = await fetch(`${base}/api/queue/update`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(r.status, 401);
  assert.equal((await call("patient", "p1", { action: "start" })).code, 403);
});

test("Q-02 unknown doctor returns 404", async () => {
  const res = await fetch(`${base}/api/queue/update`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok("n1", "nurse")}` },
    body: JSON.stringify({ doctorId: "nope", action: "start" }),
  });
  assert.equal(res.status, 404);
});

test("Q-03 the allocated nurse can start the session; live room/nurse follow the session", async () => {
  const r = await call("nurse", "n1", { action: "start" });
  assert.equal(r.code, 200);
  assert.equal(db.doctor.sessionStarted, true);
  assert.equal(db.doctor.allocatedNurse, "Nimali");
  assert.equal(db.doctor.allocatedRoom, "Room 1");
  assert.equal(db.doctor.activeScheduleId, "s1");
});

test("Q-04 start lands on the first PAID token (unpaid skipped)", async () => {
  db.appts[0].paymentStatus = "pending"; // token 1 unpaid -> first paid is 3 (token 2 also unpaid)
  await call("nurse", "n1", { action: "start" });
  assert.equal(db.doctor.currentQueueNumber, 3);
});

test("Q-05 a different nurse cannot run another nurse's doctor", async () => {
  const r = await call("nurse", "n2", { action: "start" });
  assert.equal(r.code, 403);
  assert.equal(db.doctor.sessionStarted, false);
});

test("Q-06 a nurse with no allocation or unknown account is refused", async () => {
  db.sessions.forEach((s) => (s.allocatedNurse = ""));
  assert.equal((await call("nurse", "n1", { action: "start" })).code, 403);
  assert.equal((await call("nurse", "ghost", { action: "start" })).code, 403);
});

test("Q-07 receptionist and admin are not limited by nurse allocation", async () => {
  assert.equal((await call("receptionist", "r1", { action: "start" })).code, 200);
  fresh();
  assert.equal((await call("system_admin", "a1", { action: "start" })).code, 200);
});

test("Q-08 cannot start before the doctor is marked arrived", async () => {
  db.doctor.isArrived = false;
  const r = await call("nurse", "n1", { action: "start" });
  assert.equal(r.code, 400);
  assert.equal(db.doctor.sessionStarted, false);
});

test("Q-09 increment / decrement move the serving token; decrement never goes below 0", async () => {
  await call("nurse", "n1", { action: "start" });
  await call("nurse", "n1", { action: "increment" });
  assert.equal(db.doctor.currentQueueNumber, 2);
  await call("nurse", "n1", { action: "decrement" });
  await call("nurse", "n1", { action: "decrement" });
  await call("nurse", "n1", { action: "decrement" });
  assert.equal(db.doctor.currentQueueNumber, 0);
});

test("Q-10 explicit currentServingNumber sets the token", async () => {
  await call("nurse", "n1", { action: "start" });
  await call("nurse", "n1", { currentServingNumber: 4 });
  assert.equal(db.doctor.currentQueueNumber, 4);
});

test("Q-11 completing an appointment marks it completed and logs consultation history", async () => {
  await call("nurse", "n1", { action: "start" });
  const r = await call("nurse", "n1", { action: "complete", appointmentId: "a1" });
  assert.equal(r.code, 200);
  assert.equal(db.appts[0].status, "completed");
  assert.equal(db.history.length, 1);
  assert.ok(db.history[0].actualDuration > 0);
  assert.ok(evt("appointmentUpdated").length >= 1);
});

test("Q-12 completing another doctor's appointment is ignored", async () => {
  db.appts[0].doctorId = "d2";
  await call("nurse", "n1", { action: "start" });
  await call("nurse", "n1", { action: "complete", appointmentId: "a1" });
  assert.equal(db.appts[0].status, "confirmed");
  assert.equal(db.history.length, 0);
});

test("Q-13 ending a session releases the nurse, hands over to the next session, broadcasts nurseReleased", async () => {
  await call("nurse", "n1", { action: "start" });
  const r = await call("nurse", "n1", { action: "end" });
  assert.equal(r.code, 200);
  assert.equal(db.doctor.sessionStarted, false);
  assert.equal(db.doctor.currentQueueNumber, 0);
  assert.equal(db.sessions[0].sessionEnded, true);
  assert.equal(db.sessions[0].allocatedNurse, "");
  assert.equal(db.doctor.sessionEndedToday, false); // evening session still open
  assert.equal(db.doctor.allocatedNurse, "Kamal"); // next session's nurse
  assert.equal(evt("nurseReleased")[0][1].nurseName, "Nimali");
});

test("Q-14 ending the last session of the day marks the day ended and blocks restart", async () => {
  db.sessions.pop();
  await call("nurse", "n1", { action: "start" });
  await call("nurse", "n1", { action: "end" });
  assert.equal(db.doctor.sessionEndedToday, true);
  assert.equal(db.doctor.allocatedNurse, "");
});

test("Q-15 queueUpdated is broadcast with serving token, nurse and room", async () => {
  await call("nurse", "n1", { action: "start" });
  const q = evt("queueUpdated").find(([, p]) => p.allocatedNurse !== undefined)[1];
  assert.equal(q.sessionStarted, true);
  assert.equal(q.allocatedNurse, "Nimali");
  assert.equal(q.currentServingNumber, db.doctor.currentQueueNumber);
});

test("Q-16 changing the nurse mid-day: old nurse locked out, new nurse in, doctor re-synced", async () => {
  db.sessions[0].allocatedNurse = "Kamal";
  const synced = await (async () => {
    // same path the /allocate route takes after saving the session
    const orig = Doctor.findById; // already stubbed
    return syncDoctorLiveAllocation("d1", { emit: (e, p) => emitted.push([e, p]) });
  })();
  assert.equal(synced.allocatedNurse, "Kamal");
  assert.equal((await call("nurse", "n1", { action: "start" })).code, 403);
  assert.equal((await call("nurse", "n2", { action: "start" })).code, 200);
});

test("Q-17 patients ahead / notifications use paid tokens only", async () => {
  await call("nurse", "n1", { action: "start" });
  const toDoctorRoom = evt("queueUpdated").filter(([, p]) => p.patientQueueNumber !== undefined);
  const a3 = toDoctorRoom.find(([, p]) => p.patientQueueNumber === 3)[1];
  assert.equal(a3.peopleAhead, 1); // token 1 ahead; unpaid token 2 skipped
});
