// QA: nurse assignment -> doctor live allocation -> which nurse's queue shows the doctor's patients.
// Pure logic (no DB). Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

// The helpers import modules that construct a Stripe client at load time; a dummy key keeps tests offline.
process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
const { pickCurrentSession, applyLiveAllocation } = await import("../utils/liveAllocation.js");

const at = (h, m = 0) => new Date(2026, 5, 10, h, m);
const NOW = at(9);

const session = (id, startH, endH, nurse, room = "Room 1") => ({
  _id: id, startTime: at(startH), endTime: at(endH), allocatedNurse: nurse, allocatedRoom: room,
});
const doctor = (o = {}) => ({
  isArrived: true, lastArrivalDate: at(8), sessionStarted: false, sessionEndedToday: false,
  activeScheduleId: null, allocatedNurse: "", allocatedRoom: "", ...o,
});

// Same rule as the nurse queue screen (frontend/src/app/admin/queue/page.tsx assignedDoctors)
const nurseSees = (doc, nurseName) =>
  Boolean(doc.allocatedNurse) &&
  String(doc.allocatedNurse).trim().toLowerCase() === String(nurseName).trim().toLowerCase();

test("QA-01 assigning a nurse puts the doctor (and patients) on that nurse's queue", () => {
  const d = doctor();
  applyLiveAllocation(d, [session("s1", 9, 12, "Nimali")], NOW);
  assert.equal(nurseSees(d, "Nimali"), true);
  assert.equal(nurseSees(d, "Kamal"), false);
});

test("QA-02 changing the nurse moves the doctor from the old nurse to the new one", () => {
  const d = doctor();
  const s = session("s1", 9, 12, "Nimali");
  applyLiveAllocation(d, [s], NOW);
  s.allocatedNurse = "Kamal";
  assert.equal(applyLiveAllocation(d, [s], NOW), true);
  assert.equal(nurseSees(d, "Nimali"), false);
  assert.equal(nurseSees(d, "Kamal"), true);
});

test("QA-03 changing the nurse while the queue is LIVE moves it to the new nurse", () => {
  const d = doctor({ sessionStarted: true, activeScheduleId: "s1", allocatedNurse: "Nimali" });
  const s = session("s1", 9, 12, "Kamal");
  applyLiveAllocation(d, [s], NOW);
  assert.equal(nurseSees(d, "Kamal"), true);
  assert.equal(nurseSees(d, "Nimali"), false);
});

test("QA-04 re-assigning the same nurse changes nothing", () => {
  const d = doctor({ allocatedNurse: "Nimali", allocatedRoom: "Room 1" });
  assert.equal(applyLiveAllocation(d, [session("s1", 9, 12, "Nimali")], NOW), false);
});

test("QA-05 editing a LATER session's nurse does not take the queue from the current nurse", () => {
  const d = doctor();
  const morning = session("s1", 9, 12, "Nimali");
  const evening = session("s2", 16, 19, "Kamal", "Room 2");
  applyLiveAllocation(d, [morning, evening], NOW);
  evening.allocatedNurse = "Sunil";
  applyLiveAllocation(d, [morning, evening], NOW);
  assert.equal(nurseSees(d, "Nimali"), true);
  assert.equal(nurseSees(d, "Sunil"), false);
  assert.equal(d.allocatedRoom, "Room 1");
});

test("QA-06 a live session running past its end time keeps its nurse, not the next session's", () => {
  const late = at(13);
  const d = doctor({ sessionStarted: true, activeScheduleId: "s1", allocatedNurse: "Nimali" });
  const morning = session("s1", 9, 12, "Nimali");
  const evening = session("s2", 16, 19, "Kamal");
  applyLiveAllocation(d, [morning, evening], late);
  assert.equal(nurseSees(d, "Nimali"), true);
  assert.equal(nurseSees(d, "Kamal"), false);
});

test("QA-07 after the first session ends, the next session's nurse takes over", () => {
  const d = doctor({ allocatedNurse: "Nimali" });
  const evening = session("s2", 16, 19, "Kamal", "Room 2");
  applyLiveAllocation(d, [evening], at(12, 30)); // morning ended -> only evening is open
  assert.equal(nurseSees(d, "Kamal"), true);
  assert.equal(nurseSees(d, "Nimali"), false);
  assert.equal(d.allocatedRoom, "Room 2");
});

test("QA-08 no open session left -> nurse released, doctor vanishes from every queue", () => {
  const d = doctor({ allocatedNurse: "Nimali", allocatedRoom: "Room 1" });
  applyLiveAllocation(d, [], at(20));
  assert.equal(d.allocatedNurse, "");
  assert.equal(nurseSees(d, "Nimali"), false);
});

test("QA-09 a late doctor (session time passed, not ended) stays on the nurse", () => {
  const d = doctor({ isArrived: false, lastArrivalDate: null });
  applyLiveAllocation(d, [session("s1", 9, 12, "Nimali")], at(13));
  assert.equal(nurseSees(d, "Nimali"), true);
});

test("QA-10 a session with no nurse assigned leaves the doctor on nobody's queue", () => {
  const d = doctor();
  applyLiveAllocation(d, [session("s1", 9, 12, "")], NOW);
  assert.equal(nurseSees(d, "Nimali"), false);
});

test("QA-11 nurse matching ignores case and surrounding spaces", () => {
  assert.equal(nurseSees({ allocatedNurse: "  nimali PERERA " }, "Nimali Perera"), true);
});

test("QA-12 pickCurrentSession: live queue follows the started session even if it is not the earliest", () => {
  const d = doctor({ sessionStarted: true, activeScheduleId: "s2" });
  const open = [session("s1", 9, 12, "A"), session("s2", 13, 16, "B")];
  assert.equal(pickCurrentSession(open, d, at(14))._id, "s2");
});

test("QA-13 two doctors on different nurses never show up on each other's queue", () => {
  const d1 = doctor(), d2 = doctor();
  applyLiveAllocation(d1, [session("a", 9, 12, "Nimali")], NOW);
  applyLiveAllocation(d2, [session("b", 9, 12, "Kamal", "Room 2")], NOW);
  assert.deepEqual([d1, d2].filter((d) => nurseSees(d, "Nimali")), [d1]);
  assert.deepEqual([d1, d2].filter((d) => nurseSees(d, "Kamal")), [d2]);
});
