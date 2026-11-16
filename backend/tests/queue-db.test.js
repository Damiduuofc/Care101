// QA: queue management against a REAL (in-memory) MongoDB with the real routers and models.
// Covers nurse assignment/change, queue flow, token numbering, live-allocation job. Run with: npm test
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
process.env.JWT_SECRET = "qa-secret";
const { default: express } = await import("express");
const { default: jwt } = await import("jsonwebtoken");
const { default: mongoose } = await import("mongoose");
const { MongoMemoryServer } = await import("mongodb-memory-server");
const M = {
  Admin: (await import("../models/Admin.js")).default,
  Doctor: (await import("../models/Doctor.js")).default,
  Schedule: (await import("../models/ScheduleRequest.js")).default,
  Appointment: (await import("../models/Appointment.js")).default,
  History: (await import("../models/ConsultationHistory.js")).default,
};
const queueRoutes = (await import("../routes/queue.js")).default;
const scheduleRoutes = (await import("../routes/scheduleRequests.js")).default;
const adminRoutes = (await import("../routes/adminRoutes.js")).default;
const { assignQueueToken } = await import("../utils/queueToken.js");
const { syncAllLiveAllocations } = await import("../utils/liveAllocation.js");

let mongod, server, base, ids;
const day = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const tok = (id, role) => jwt.sign({ id: String(id), role }, process.env.JWT_SECRET);
const api = async (method, path, who, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${tok(who.id, who.role)}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { code: res.status, json };
};
const reload = (id) => M.Doctor.findById(id).lean();

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await M.Appointment.init();
  const app = express();
  app.use(express.json());
  app.use((req, _r, n) => { req.io = { emit() {}, to() { const t = { to: () => t, emit() {} }; return t; } }; n(); });
  app.use("/api/queue", queueRoutes);
  app.use("/api/schedule-requests", scheduleRoutes);
  app.use("/api/admin", adminRoutes);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await mongoose.disconnect(); await mongod.stop(); });

// Fresh data: nurses Nimali/Kamal, doctors Perera/Silva, Perera has an all-day session today with 4 bookings
beforeEach(async () => {
  await Promise.all(Object.values(M).map((m) => m.deleteMany({})));
  await mongoose.connection.collection("queuecounters").deleteMany({});
  const mkNurse = (name) => M.Admin.create({ name, email: `${name}@x.lk`, password: "x", role: "nurse" });
  const [n1, n2, rec] = await Promise.all([
    mkNurse("Nimali"), mkNurse("Kamal"),
    M.Admin.create({ name: "Rec", email: "rec@x.lk", password: "x", role: "receptionist" }),
  ]);
  const mkDoc = (name, i) => M.Doctor.create({ name, email: `${name}@d.lk`, password: "x", slmcReg: `S${i}`, isArrived: true, lastArrivalDate: new Date() });
  const [d1, d2] = [await mkDoc("Perera", 1), await mkDoc("Silva", 2)];
  const s1 = await M.Schedule.create({ doctorId: d1._id, doctorName: "Perera", date: day(0), startTime: day(0, 1), endTime: day(23, 58),
    status: "approved", allocatedNurse: "Nimali", allocatedRoom: "Room 1" });
  const appts = [];
  for (const [i, paid] of [[1, "paid"], [2, "pending"], [3, "paid"], [4, "paid"]]) {
    const a = new M.Appointment({ patientId: new mongoose.Types.ObjectId(), doctorId: d1._id, doctorName: "Perera", department: "General",
      date: day(10), status: "confirmed", paymentStatus: paid, scheduleId: s1._id });
    await assignQueueToken(a); await a.save(); appts.push(a);
  }
  ids = { n1, n2, rec, d1, d2, s1, appts };
});

const NURSE1 = () => ({ id: ids.n1._id, role: "nurse" });
const NURSE2 = () => ({ id: ids.n2._id, role: "nurse" });
const REC = () => ({ id: ids.rec._id, role: "receptionist" });
const nurseSees = async (nurse) => {
  const r = await api("GET", "/api/admin/doctors", nurse);
  return r.json.filter((d) => d.allocatedNurse === nurse.name).map((d) => d.name);
};

test("D-01 the doctor shows on the assigned nurse's list, and on nobody else's", async () => {
  const mine = (await api("GET", "/api/admin/doctors", NURSE1())).json.filter((d) => d.allocatedNurse === "Nimali");
  assert.deepEqual(mine.map((d) => d.name), ["Perera"]);
  assert.equal((await api("GET", "/api/admin/doctors", NURSE2())).json.filter((d) => d.allocatedNurse === "Kamal").length, 0);
});

test("D-02 reception changes the nurse: doctor moves to the new nurse, old nurse is locked out", async () => {
  const r = await api("PUT", `/api/schedule-requests/${ids.s1._id}/allocate`, REC(), { allocatedRoom: "Room 1", allocatedNurse: "Kamal" });
  assert.equal(r.code, 200);
  assert.equal((await reload(ids.d1._id)).allocatedNurse, "Kamal");
  assert.equal((await api("POST", "/api/queue/update", NURSE1(), { doctorId: String(ids.d1._id), action: "start" })).code, 403);
  assert.equal((await api("POST", "/api/queue/update", NURSE2(), { doctorId: String(ids.d1._id), action: "start" })).code, 200);
});

test("D-03 a nurse already booked at the same time cannot be assigned twice (409)", async () => {
  const other = await M.Schedule.create({ doctorId: ids.d2._id, doctorName: "Silva", date: day(0), startTime: day(0, 1), endTime: day(23, 58),
    status: "approved", allocatedNurse: "Kamal", allocatedRoom: "Room 2" });
  const r = await api("PUT", `/api/schedule-requests/${ids.s1._id}/allocate`, REC(), { allocatedRoom: "Room 1", allocatedNurse: "Kamal" });
  assert.equal(r.code, 409);
  assert.equal((await M.Schedule.findById(ids.s1._id)).allocatedNurse, "Nimali");
  assert.ok(other);
});

test("D-04 nurses cannot allocate nurses/rooms", async () => {
  const r = await api("PUT", `/api/schedule-requests/${ids.s1._id}/allocate`, NURSE1(), { allocatedNurse: "Kamal" });
  assert.equal(r.code, 403);
});

test("D-05 full queue cycle: start -> next -> complete -> end", async () => {
  const body = (o) => ({ doctorId: String(ids.d1._id), ...o });
  assert.equal((await api("POST", "/api/queue/update", NURSE1(), body({ action: "start" }))).code, 200);
  let d = await reload(ids.d1._id);
  assert.equal(d.sessionStarted, true);
  assert.equal(d.currentQueueNumber, 1);
  await api("POST", "/api/queue/update", NURSE1(), body({ action: "complete", appointmentId: String(ids.appts[0]._id) }));
  assert.equal((await M.Appointment.findById(ids.appts[0]._id)).status, "completed");
  assert.equal(await M.History.countDocuments({ appointmentId: ids.appts[0]._id }), 1);
  await api("POST", "/api/queue/update", NURSE1(), body({ action: "increment" }));
  assert.equal((await reload(ids.d1._id)).currentQueueNumber, 2);
  const end = await api("POST", "/api/queue/update", NURSE1(), body({ action: "end" }));
  assert.equal(end.code, 200);
  d = await reload(ids.d1._id);
  assert.equal(d.sessionStarted, false);
  assert.equal(d.currentQueueNumber, 0);
  assert.equal(d.sessionEndedToday, true);
  assert.equal(d.allocatedNurse, "");
  assert.equal((await M.Schedule.findById(ids.s1._id)).sessionEnded, true);
  // ended day cannot be restarted
  assert.equal((await api("POST", "/api/queue/update", NURSE1(), body({ action: "start" }))).code, 403);
});

test("D-06 patient queue status counts only paid patients ahead", async () => {
  await api("POST", "/api/queue/update", NURSE1(), { doctorId: String(ids.d1._id), action: "start" });
  const r = await api("GET", `/api/queue/patient/${ids.appts[2].patientId}?appointmentId=${ids.appts[2]._id}`, { id: ids.appts[2].patientId, role: "patient" });
  assert.equal(r.code, 200);
  assert.equal(r.json.queueNumber, 3);
  assert.equal(r.json.currentServingNumber, 1);
  assert.equal(r.json.peopleAhead, 1); // token 1 only; unpaid token 2 skipped
  const unpaid = await api("GET", `/api/queue/patient/x?appointmentId=${ids.appts[1]._id}`, { id: ids.appts[1].patientId, role: "patient" });
  assert.equal(unpaid.json.awaitingPayment, true);
  assert.equal(unpaid.json.peopleAhead, null);
});

test("D-07 simultaneous bookings never share a queue token", async () => {
  const made = await Promise.all(Array.from({ length: 20 }, async () => {
    const a = new M.Appointment({ patientId: new mongoose.Types.ObjectId(), doctorId: ids.d2._id, doctorName: "Silva", department: "General", date: day(11) });
    await assignQueueToken(a); await a.save(); return a.queueNumber;
  }));
  assert.equal(new Set(made).size, 20);
  assert.deepEqual([...made].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
});

test("D-08 live-allocation job restores a released nurse and releases when no session is left", async () => {
  await M.Doctor.updateOne({ _id: ids.d1._id }, { allocatedNurse: "", allocatedRoom: "" });
  await syncAllLiveAllocations({ emit() {} });
  assert.equal((await reload(ids.d1._id)).allocatedNurse, "Nimali");
  await M.Schedule.updateOne({ _id: ids.s1._id }, { sessionEnded: true });
  await syncAllLiveAllocations({ emit() {} });
  assert.equal((await reload(ids.d1._id)).allocatedNurse, "");
});

test("D-09 a new session after the day was flagged ended lets the doctor start again", async () => {
  await M.Doctor.updateOne({ _id: ids.d1._id }, { sessionEndedToday: true, allocatedNurse: "" });
  await syncAllLiveAllocations({ emit() {} });
  const d = await reload(ids.d1._id);
  assert.equal(d.allocatedNurse, "Nimali");
  assert.equal(d.sessionEndedToday, false);
});

test("D-10 live queue endpoint reports serving token and paid count", async () => {
  await api("POST", "/api/queue/update", NURSE1(), { doctorId: String(ids.d1._id), action: "start" });
  const r = await api("GET", `/api/queue/doctor/${ids.d1._id}/live`, NURSE1());
  assert.equal(r.json.sessionStarted, true);
  assert.equal(r.json.activeAppointmentsCount, 3);
});
