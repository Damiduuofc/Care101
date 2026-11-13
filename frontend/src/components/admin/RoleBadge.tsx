"use client";

import { ShieldCheck, HeartPulse, ConciergeBell, FlaskConical, UserCog, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type RoleMeta = {
  label: string;
  dashboard: string;
  description: string;
  icon: LucideIcon;
};

// One accent for every role (the site's cyan); roles differ by icon and label only
export const ROLE_META: Record<string, RoleMeta> = {
  system_admin: {
    label: "System Admin",
    dashboard: "System Admin Dashboard",
    description: "Doctors, staff, billing and hospital settings.",
    icon: ShieldCheck,
  },
  nurse: {
    label: "Nurse",
    dashboard: "Nurse Dashboard",
    description: "Today's OPD queue, arrivals and your assigned doctors.",
    icon: HeartPulse,
  },
  receptionist: {
    label: "Receptionist",
    dashboard: "Receptionist Dashboard",
    description: "Bookings, payments, arrivals and room allocation.",
    icon: ConciergeBell,
  },
  lab_assistant: {
    label: "Lab Assistant",
    dashboard: "Lab Assistant Dashboard",
    description: "Lab requests and patient reports.",
    icon: FlaskConical,
  },
};

const FALLBACK: RoleMeta = { label: "Staff", dashboard: "Staff Dashboard", description: "", icon: UserCog };

export const getRoleMeta = (role?: string | null): RoleMeta => {
  if (role && ROLE_META[role]) return ROLE_META[role];
  if (!role) return FALLBACK;
  const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { ...FALLBACK, label, dashboard: `${label} Dashboard` };
};

/** Quiet pill with a cyan dot: "● System Admin" */
export function RoleBadge({ role, className }: { role?: string | null; className?: string }) {
  const meta = getRoleMeta(role);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden />
      {meta.label}
    </span>
  );
}

/**
 * Minimal dashboard header: small cyan role label above the title, a short line below,
 * the role icon in a soft cyan tile. No card chrome, so it sits on the page like a heading.
 */
export function DashboardRoleHeader({
  role,
  userName,
  title,
  subtitle,
  className,
}: {
  role?: string | null;
  userName?: string;
  /** Overrides "<Role> Dashboard" */
  title?: string;
  /** Overrides the default "Signed in as … · description" line */
  subtitle?: React.ReactNode;
  className?: string;
}) {
  const meta = getRoleMeta(role);
  const Icon = meta.icon;
  return (
    <header className={cn("flex items-center gap-4 border-b border-slate-200 pb-6", className)}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-inset ring-cyan-100">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-600">{meta.label}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
          {title || meta.dashboard}
        </h1>
        <p className="mt-1 truncate text-sm text-slate-500">
          {subtitle ?? (
            <>
              {userName ? (
                <>
                  Signed in as <span className="font-medium text-slate-700">{userName}</span>
                  {meta.description ? <span className="mx-1.5 text-slate-300">·</span> : null}
                </>
              ) : null}
              {meta.description}
            </>
          )}
        </p>
      </div>
    </header>
  );
}
