// Unit tests for backend helpers that enforce security and booking rules.
// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { isValidPhone, normalizePhone } from "../utils/phone.js";
import { parsePagination, pageResponse } from "../utils/pagination.js";
import { toDayKey } from "../utils/queueToken.js";
import { canSeeAnyPatient, escapeRegex } from "../utils/access.js";
import { isArrivedToday, clearStaleSession, isSessionLive } from "../utils/doctorSession.js";
import { getDoctorDept } from "../utils/autoAllocate.js";
import { rateLimit } from "../utils/rateLimit.js";
import { authorize } from "../middleware/authRole.js";

const mockRes = () => {
  const r = { code: 200, headers: {}, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.set = (k, v) => { r.headers[k] = v; return r; };
  return r;
};

test("UT-01 valid Sri Lankan mobile numbers are accepted", () => {
  assert.equal(isValidPhone("0771234567"), true);
  assert.equal(isValidPhone("+94 77 123 4567"), true);
  assert.equal(normalizePhone("077-123 (4567)"), "0771234567");
});

test("UT-02 invalid phone numbers are rejected", () => {
  assert.equal(isValidPhone("12345"), false);
  assert.equal(isValidPhone("07712345678"), false);
  assert.equal(isValidPhone(""), false);
});

test("UT-03 pagination is opt-in and clamps page/limit", () => {
  assert.equal(parsePagination({}), null);
  assert.deepEqual(parsePagination({ page: "3", limit: "10" }), { page: 3, limit: 10, skip: 20 });
  assert.equal(parsePagination({ limit: "9999" }).limit, 200);
  assert.equal(parsePagination({ page: "-4" }).page, 1);
});

test("UT-04 page response reports total pages", () => {
  assert.equal(pageResponse([], 45, { page: 1, limit: 20 }).totalPages, 3);
  assert.equal(pageResponse([], 0, { page: 1, limit: 20 }).totalPages, 1);
});

test("UT-05 queue day key is formatted YYYY-MM-DD", () => {
  assert.equal(toDayKey(new Date(2026, 0, 5, 14, 30)), "2026-01-05");
});

test("UT-06 only clinical roles may view any patient", () => {
  for (const role of ["doctor", "system_admin", "receptionist", "nurse", "lab_assistant"])
    assert.equal(canSeeAnyPatient({ role }), true);
  assert.equal(canSeeAnyPatient({ role: "patient" }), false);
  assert.equal(canSeeAnyPatient(undefined), false);
});

test("UT-07 search input is escaped before use in a regular expression", () => {
  assert.equal(escapeRegex("a.b(c)"), "a\\.b\\(c\\)");
  assert.ok(new RegExp(escapeRegex("1+1")).test("1+1"));
});

test("UT-08 doctor arrival only counts for today", () => {
  const now = new Date(2026, 5, 10, 9);
  assert.equal(isArrivedToday({ isArrived: true, lastArrivalDate: new Date(2026, 5, 10, 8) }, now), true);
  assert.equal(isArrivedToday({ isArrived: true, lastArrivalDate: new Date(2026, 5, 9, 8) }, now), false);
});

test("UT-09 stale doctor session from an earlier day is cleared", () => {
  const doc = { sessionStarted: true, currentQueueNumber: 7, lastArrivalDate: new Date(2026, 5, 9) };
  clearStaleSession(doc, new Date(2026, 5, 10));
  assert.equal(doc.sessionStarted, false);
  assert.equal(doc.currentQueueNumber, 0);
});

test("UT-10 queue is live only when doctor arrived today and session started", () => {
  const now = new Date(2026, 5, 10, 10);
  const arrived = { isArrived: true, lastArrivalDate: new Date(2026, 5, 10, 8) };
  assert.equal(isSessionLive({ ...arrived, sessionStarted: true }, now), true);
  assert.equal(isSessionLive({ ...arrived, sessionStarted: false }, now), false);
});

test("UT-11 doctor specialization maps to the correct room department", () => {
  assert.equal(getDoctorDept("Consultant Cardiologist"), "Cardiology");
  assert.equal(getDoctorDept("Child Specialist"), "Pediatrics");
  assert.equal(getDoctorDept("Skin"), "Dermatology");
  assert.equal(getDoctorDept("Neurology"), "General Medicine");
});

test("UT-12 role guard blocks users without an allowed role", () => {
  const guard = authorize("system_admin", "receptionist");
  let passed = false;
  guard({ user: { role: "receptionist" } }, mockRes(), () => { passed = true; });
  assert.equal(passed, true);
  const res = mockRes();
  guard({ user: { role: "patient" } }, res, () => assert.fail("should not pass"));
  assert.equal(res.code, 403);
});

test("UT-13 login rate limiter returns 429 after the limit", () => {
  const limiter = rateLimit({ name: "ut", max: 3, windowMs: 60000 });
  const req = { ip: "1.2.3.4", body: { email: "a@b.com" } };
  let allowed = 0;
  for (let i = 0; i < 3; i++) limiter(req, mockRes(), () => allowed++);
  const res = mockRes();
  limiter(req, res, () => allowed++);
  assert.equal(allowed, 3);
  assert.equal(res.code, 429);
  assert.ok(res.headers["Retry-After"]);
});
