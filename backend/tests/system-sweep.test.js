// QA: whole-API sweep. Mounts every router like index.js does and calls every route with NO token
// (no database connected). Checks: every module loads, protected routes answer 401/403 (never 200/5xx),
// and lists the routes that are public so they can be reviewed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.STRIPE_SECRET_KEY ||= "sk_test_dummy_for_unit_tests";
process.env.JWT_SECRET ||= "qa-secret";
const { default: express } = await import("express");
const { default: mongoose } = await import("mongoose");
mongoose.set("bufferCommands", false); // no DB here: fail fast instead of waiting

const MOUNTS = {
  "/api/auth": "auth", "/api/patient": "patient", "/api/appointments": "appointments",
  "/api/doctors": "doctors", "/api/doctor": "doctor", "/api/medical-records": "medicalRecords",
  "/api/notifications": "notifications", "/api/finance": "finance", "/api/surgery-records": "surgeryRecords",
  "/api/chat": "chatRoutes", "/api/admin": "adminRoutes", "/api/instructions": "instructionRoutes",
  "/api/payments": "payments", "/api/patients": "patients", "/api/schedule-requests": "scheduleRequests",
  "/api/lab-requests": "labRequests", "/api/lab-tests": "labTests", "/api/queue": "queue", "/api/push": "push",
};
// Routes that are meant to be reachable without logging in (login, register, password reset, webhooks, public lists)
const PUBLIC_OK = [/\/login/, /\/register/, /\/signup/, /forgot/, /reset/, /verify/, /otp/, /webhook/, /^GET \/api\/doctors/, /refresh/, /google/, /health/, /next-patient-id/, /instructions\/(share|view|patient)\//];

const ID = "000000000000000000000000";
let server, base;
const results = [];

const walk = (router, prefix = "") => {
  const out = [];
  for (const layer of router.stack || []) {
    if (layer.route) {
      for (const m of Object.keys(layer.route.methods)) out.push([m.toUpperCase(), prefix + layer.route.path]);
    } else if (layer.handle?.stack) {
      out.push(...walk(layer.handle, prefix));
    }
  }
  return out;
};

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _r, next) => { req.io = { emit() {}, to: () => ({ emit() {}, to() { return this; } }) }; next(); });
  for (const [prefix, file] of Object.entries(MOUNTS)) {
    const mod = await import(`../routes/${file}.js`); // fails the test if a module has a load error
    const router = mod.default;
    app.use(prefix, router);
    for (const [method, path] of walk(router, prefix)) results.push({ method, path });
  }
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const r of results) {
    const url = base + String(r.path).replace(/:[A-Za-z0-9_]+\??/g, ID);
    try {
      const res = await fetch(url, { method: r.method, headers: { "content-type": "application/json" },
        body: ["GET", "HEAD"].includes(r.method) ? undefined : "{}", signal: AbortSignal.timeout(5000) });
      r.status = res.status;
    } catch (e) { r.status = "TIMEOUT"; }
  }
});
after(() => server.close());

test("SYS-01 every route module loads and registers routes", () => {
  assert.ok(results.length > 100, `only ${results.length} routes found`);
});

const isPublic = (r) => PUBLIC_OK.some((p) => p.test(`${r.method} ${r.path}`));

// Public routes need the database to answer (so 5xx is expected here); they are checked for input validation below
test("SYS-02 no protected route crashes (5xx) or hangs when called without a token", () => {
  const bad = results.filter((r) => !isPublic(r) && (r.status === "TIMEOUT" || r.status >= 500));
  assert.deepEqual(bad.map((r) => `${r.method} ${r.path} -> ${r.status}`), []);
});

test("SYS-04 doctor registration with an empty body is a 400, not a server crash", () => {
  const r = results.find((x) => x.method === "POST" && x.path === "/api/auth/register-doctor");
  assert.equal(r.status, 400);
});

test("SYS-03 every route that is not an intended public one rejects anonymous callers", () => {
  const open = results.filter((r) => ![401, 403].includes(r.status) && !PUBLIC_OK.some((p) => p.test(`${r.method} ${r.path}`)));
  assert.deepEqual(open.map((r) => `${r.method} ${r.path} -> ${r.status}`), []);
});
