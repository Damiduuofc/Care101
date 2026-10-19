"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ElementType } from "react";
import { menuItems } from "@/lib/adminMenu";
import { LogOut, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminUser } from "@/lib/adminSession";
import { useSidebar } from "./SidebarContext";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  const { isCollapsed, isMobileOpen, toggleCollapse, closeMobile } = useSidebar();

  useEffect(() => {
    const user = getAdminUser();
    if (user) {
      setRole(user.role || "receptionist"); // Default fallback
      setUserName(user.name || "Staff Member");
    } else {
      clearAdminSession();
      router.push("/admin/login");
    }
  }, [router]);

  const handleLogout = () => {
    clearAdminSession();
    router.push("/admin/login");
  };

  // Filter Menu Items based on Role
  const filteredMenu = menuItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <aside
        className={`h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 border-r border-slate-800 z-50 transition-all duration-300 ease-in-out ${
          // Mobile: slide in/out drawer
          isMobileOpen
            ? "translate-x-0 w-64 shadow-2xl"
            : "-translate-x-full md:translate-x-0"
        } ${
          // Desktop / Tablet width
          isCollapsed ? "md:w-16" : "md:w-64"
        }`}
      >
        {/* HEADER */}
        <div
          className={`border-b border-slate-800 flex items-center transition-all ${
            isCollapsed
              ? "p-3 flex-col gap-2 justify-center"
              : "p-4 sm:p-5 justify-between"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/admin/dashboard"
              onClick={closeMobile}
              className="flex items-center gap-2 shrink-0 group"
              title="Care101 Home"
            >
              <img
                src="/logo.png"
                alt="Care101 Logo"
                className="h-8 w-8 object-contain transition-transform group-hover:scale-105"
              />
            </Link>

            {!isCollapsed && (
              <div className="min-w-0">
                <Link
                  href="/admin/dashboard"
                  onClick={closeMobile}
                  className="block font-bold text-base sm:text-lg tracking-wide truncate text-white hover:text-cyan-400 transition-colors"
                >
                  Care101
                </Link>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest truncate">
                  {role.replace("_", " ")}
                </p>
              </div>
            )}
          </div>

          {/* DESKTOP/TABLET COLLAPSE TOGGLE BUTTON */}
          <button
            type="button"
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>

          {/* MOBILE CLOSE BUTTON */}
          <button
            type="button"
            onClick={closeMobile}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* MENU */}
        <nav className={`flex-1 overflow-y-auto space-y-1.5 ${isCollapsed ? "p-2" : "p-3 sm:p-4"}`}>
          {filteredMenu.map((item) => {
            const Icon = item.icon as ElementType;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                title={item.title}
                className={`flex items-center rounded-xl transition-all duration-200 group ${
                  isCollapsed
                    ? "justify-center p-3"
                    : "gap-3 px-3.5 py-2.5 sm:py-3"
                } ${
                  isActive
                    ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/30 font-semibold"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon
                  className={`shrink-0 transition-transform ${
                    isCollapsed ? "h-5 w-5 group-hover:scale-110" : "h-5 w-5"
                  }`}
                />
                {!isCollapsed && (
                  <span className="font-medium text-xs sm:text-sm truncate">
                    {item.title}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* USER & LOGOUT */}
        <div className={`border-t border-slate-800 ${isCollapsed ? "p-2" : "p-3 sm:p-4"}`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <div
                className="h-8 w-8 rounded-full bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center text-xs font-bold"
                title={`${userName} (${role.replace("_", " ")})`}
              >
                {userName.charAt(0)}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Logout"
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="bg-slate-800/80 rounded-xl p-3 sm:p-3.5">
              <p className="text-xs sm:text-sm font-semibold text-white truncate mb-0.5">
                {userName}
              </p>
              <p className="text-[10px] text-slate-400 mb-2.5 truncate">
                Logged in as {role.replace("_", " ")}
              </p>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-colors"
              >
                <LogOut className="h-3 w-3" /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
