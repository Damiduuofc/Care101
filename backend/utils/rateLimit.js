// Small in-memory rate limiter for the login / password-reset endpoints.
// Keyed by client IP + the account identifier, so one person hammering an account is
// stopped without locking out everyone behind the same hospital network / ngrok tunnel.
const buckets = new Map();

export const rateLimit = ({ name, max, windowMs, identify = (req) => req.body?.email || req.body?.identifier || "" }) =>
  (req, res, next) => {
    const now = Date.now();
    const key = `${name}|${req.ip}|${String(identify(req)).trim().toLowerCase()}`;
    const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        msg: `Too many attempts. Please wait ${Math.ceil(retryAfter / 60)} minute(s) and try again.`,
        message: `Too many attempts. Please wait ${Math.ceil(retryAfter / 60)} minute(s) and try again.`,
      });
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };

// Drop stale entries so memory doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    if (!hits.length || now - hits[hits.length - 1] > 60 * 60 * 1000) buckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

const MIN = 60 * 1000;
export const loginLimiter = rateLimit({ name: "login", max: 10, windowMs: 15 * MIN });
export const resetRequestLimiter = rateLimit({ name: "reset-request", max: 5, windowMs: 15 * MIN });
export const otpCheckLimiter = rateLimit({ name: "otp-check", max: 10, windowMs: 15 * MIN });
