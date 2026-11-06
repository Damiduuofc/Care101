// Sri Lankan phone numbers: 07XXXXXXXX (mobile), 0XXXXXXXXX (landline), or the same with +94 / 94.
// Spaces, dashes and brackets are ignored so "077 123 4567" is accepted.
export const PHONE_HINT = "Enter a valid Sri Lankan number, e.g. 0771234567 or +94771234567.";

export function normalizePhone(value: string): string {
  return String(value || "").replace(/[\s\-()]/g, "");
}

export function isValidPhone(value: string): boolean {
  return /^(?:\+94|94|0)\d{9}$/.test(normalizePhone(value));
}
