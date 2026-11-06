import http2 from "node:http2";
import fs from "node:fs";
import jwt from "jsonwebtoken";

// Minimal Apple Push Notification service (APNs) client: token-based auth over HTTP/2.
// Configure with APNS_KEY_ID, APNS_TEAM_ID and either APNS_KEY_PATH (the .p8 file) or
// APNS_KEY (its contents, "\n" escapes allowed). APNS_BUNDLE_ID defaults to the app's id.

const HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com"
};

export const APNS_BUNDLE_ID = process.env.APNS_BUNDLE_ID || "com.damiduuofc.carelinkdoctorapp";

let signingKey = null;
const loadKey = () => {
  if (signingKey !== null) return signingKey;
  try {
    if (process.env.APNS_KEY) signingKey = process.env.APNS_KEY.replace(/\\n/g, "\n");
    else if (process.env.APNS_KEY_PATH) signingKey = fs.readFileSync(process.env.APNS_KEY_PATH, "utf8");
    else signingKey = "";
  } catch (err) {
    console.error("APNs: could not read APNS_KEY_PATH:", err.message);
    signingKey = "";
  }
  return signingKey;
};

export const apnsEnabled = () =>
  Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && loadKey());

// Apple accepts a provider token for up to an hour and rejects refreshing it more than
// once every 20 minutes, so reuse one for 40 minutes.
let cachedJwt = { token: null, issuedAt: 0 };
const providerToken = () => {
  const now = Date.now();
  if (cachedJwt.token && now - cachedJwt.issuedAt < 40 * 60 * 1000) return cachedJwt.token;
  const token = jwt.sign({ iss: process.env.APNS_TEAM_ID }, loadKey(), {
    algorithm: "ES256",
    header: { alg: "ES256", kid: process.env.APNS_KEY_ID }
  });
  cachedJwt = { token, issuedAt: now };
  return token;
};

const sessions = {};
const sessionFor = (environment) => {
  const existing = sessions[environment];
  if (existing && !existing.closed && !existing.destroyed) return existing;
  const session = http2.connect(HOSTS[environment]);
  session.on("error", (err) => console.error(`APNs ${environment} connection error:`, err.message));
  session.on("close", () => { if (sessions[environment] === session) delete sessions[environment]; });
  // Close the connection after 10 idle minutes; the next push reopens it
  session.setTimeout(10 * 60 * 1000, () => session.close());
  sessions[environment] = session;
  return session;
};

/**
 * Send one push. Resolves to { ok, status, reason } and never throws.
 * pushType: "alert" | "background" | "liveactivity"
 */
export const sendApns = ({
  deviceToken,
  environment = "production",
  pushType = "alert",
  payload,
  priority,
  collapseId,
  expiration,
  topic
}) =>
  new Promise((resolve) => {
    if (!apnsEnabled()) return resolve({ ok: false, status: 0, reason: "NotConfigured" });
    let headers;
    try {
      headers = {
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${providerToken()}`,
        "apns-push-type": pushType,
        "apns-topic":
          topic ||
          (pushType === "liveactivity" ? `${APNS_BUNDLE_ID}.push-type.liveactivity` : APNS_BUNDLE_ID),
        "apns-priority": String(priority ?? (pushType === "background" ? 5 : 10))
      };
    } catch (err) {
      return resolve({ ok: false, status: 0, reason: `SigningFailed: ${err.message}` });
    }
    if (collapseId) headers["apns-collapse-id"] = String(collapseId).slice(0, 64);
    if (expiration !== undefined) headers["apns-expiration"] = String(expiration);

    let req;
    try {
      req = sessionFor(environment).request(headers);
    } catch (err) {
      return resolve({ ok: false, status: 0, reason: err.message });
    }
    let status = 0;
    let body = "";
    req.setTimeout(10000, () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      resolve({ ok: false, status: 0, reason: "Timeout" });
    });
    req.on("response", (h) => { status = h[":status"]; });
    req.setEncoding("utf8");
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      let reason = "";
      try { reason = body ? JSON.parse(body).reason || "" : ""; } catch { reason = body; }
      resolve({ ok: status === 200, status, reason });
    });
    req.on("error", (err) => resolve({ ok: false, status: 0, reason: err.message }));
    req.end(JSON.stringify(payload));
  });

// The token belongs to the other APNs environment (debug vs release build)
export const isWrongEnvironment = (result) =>
  result.status === 400 && result.reason === "BadDeviceToken";

// The token will never work again: forget it
export const isDeadToken = (result) =>
  result.status === 410 || (result.status === 400 && result.reason === "DeviceTokenNotForTopic");
