import { getAdminUser } from "@/lib/adminSession";

/**
 * The server broadcasts every doctorDelayAlert to all staff screens. A nurse should only be
 * alerted for doctors allocated to them; other staff roles (admin, receptionist) see all.
 * Reads the user from the session at call time, so socket handlers never see a stale user.
 */
export function isDelayAlertForCurrentUser(alertData: { allocatedNurse?: string | null } | null | undefined): boolean {
  const user = getAdminUser();
  if (!user || user.role !== "nurse") return true;
  const nurse = String(alertData?.allocatedNurse || "").trim().toLowerCase();
  const me = String(user.name || "").trim().toLowerCase();
  return !!nurse && nurse === me;
}
