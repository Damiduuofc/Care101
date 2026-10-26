"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, UserCheck, Stethoscope, Menu, PanelLeft, BellRing } from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface NurseHeaderProps {
  title: string;
  subtitle: string;
  userName?: string;
  alertCount?: number;
  rightSlot?: React.ReactNode;
}

export default function NurseHeader({
  title,
  subtitle,
  userName,
  alertCount = 0,
  rightSlot,
}: NurseHeaderProps) {
  const pathname = usePathname();
  const { toggleMobileOpen, toggleCollapse, isCollapsed } = useSidebar();

  const navTabs = [
    {
      title: "OPD Queue",
      href: "/admin/queue",
      icon: Activity,
      badge: null,
    },
    {
      title: "Patient Arrival",
      href: "/admin/queue/patient-arrival",
      icon: UserCheck,
      badge: null,
    },
    {
      title: "Doctor Arrival",
      href: "/admin/queue/doctor-arrival",
      icon: Stethoscope,
      badge: alertCount > 0 ? alertCount : null,
    },
  ];

  return (
    <header className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 sm:p-4 mb-4 sm:mb-6 transition-all">
      {/* TOP ROW: TITLE, TOGGLES, USER BADGE & RIGHT SLOT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {/* Mobile drawer toggle (< 768px) */}
          <button
            type="button"
            onClick={toggleMobileOpen}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all shrink-0"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Tablet/Desktop collapse toggle */}
          <button
            type="button"
            onClick={toggleCollapse}
            className="hidden md:flex lg:flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 active:scale-95 transition-all shrink-0"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar for more space"}
            aria-label="Toggle sidebar collapse"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
              {title}
            </h1>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* RIGHT SLOT / STATS */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0 flex-wrap">
          {rightSlot}

          {userName && (
            <div className="hidden sm:inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-800 border border-cyan-100/80 px-3 py-1.5 rounded-xl text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
              <span className="truncate max-w-[140px]">Nurse: {userName}</span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM ROW: NURSE QUICK-SWITCH SEGMENTED TABS */}
      <div className="pt-2.5 flex items-center justify-between gap-2">
        <nav
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto"
          aria-label="Nurse modules navigation"
        >
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[38px] touch-manipulation ${
                  isActive
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/15"
                    : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{tab.title}</span>
                {tab.badge && (
                  <span className="ml-0.5 inline-flex items-center justify-center bg-rose-500 text-white text-[10px] font-black h-4 min-w-[16px] px-1 rounded-full animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Display specification indicator badge on 8.7" screens or compact view */}
        <div className="hidden xl:flex items-center gap-1 text-[11px] font-semibold text-slate-400 shrink-0">

        </div>
      </div>
    </header>
  );
}
