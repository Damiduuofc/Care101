// Sri Lankan phone numbers: 07XXXXXXXX, 0XXXXXXXXX, or with +94 / 94. Spaces/dashes ignored.
// Checked server-side too, so SMS reminders are never queued for a number that can't work.
export const PHONE_HINT = "Enter a valid Sri Lankan number, e.g. 0771234567 or +94771234567.";
export const normalizePhone = (value) => String(value || "").replace(/[\s\-()]/g, "");
export const isValidPhone = (value) => /^(?:\+94|94|0)\d{9}$/.test(normalizePhone(value));
