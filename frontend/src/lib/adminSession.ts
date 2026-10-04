export type AdminUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  [key: string]: any;
};

const ADMIN_TOKEN_KEY = "adminToken";
const ADMIN_USER_KEY = "adminUser";

function isBrowser() {
  return typeof window !== "undefined";
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  if (!isBrowser()) return;

  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_USER_KEY);

  // Remove legacy persistent values so old logins do not survive browser restarts.
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export function getAdminToken() {
  if (!isBrowser()) return null;

  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload?.exp || Date.now() >= payload.exp * 1000) {
    clearAdminSession();
    return null;
  }

  return token;
}

export function getAdminUser(): AdminUser | null {
  if (!isBrowser()) return null;

  const rawUser = sessionStorage.getItem(ADMIN_USER_KEY);
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as AdminUser;
  } catch {
    clearAdminSession();
    return null;
  }
}

export function saveAdminSession(token: string, user: AdminUser) {
  if (!isBrowser()) return;

  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));

  // Ensure the old persistent copy is removed immediately.
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export function getAdminLandingPath(user: AdminUser | null) {
  switch (user?.role) {
    case "receptionist":
      return "/admin/receptionist-dashboard";
    case "lab_assistant":
      return "/admin/lab-assistant-dashboard";
    case "nurse":
      return "/admin/queue";
    default:
      return "/admin/dashboard";
  }
}