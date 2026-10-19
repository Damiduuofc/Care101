"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminSession, getAdminLandingPath, getAdminToken, getAdminUser } from "@/lib/adminSession";
import { SidebarProvider } from "@/components/admin/SidebarContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginRoute = pathname === "/admin/login";
  const isGatekeeperRoute = pathname === "/admin";

  // Login and gatekeeper routes render immediately without a blocking layout spinner
  const [isAuthorized, setIsAuthorized] = useState(isLoginRoute || isGatekeeperRoute);

  useEffect(() => {
    const token = getAdminToken();
    const user = getAdminUser();
    const isAuthenticated = Boolean(token && user);

    if (isLoginRoute) {
      if (isAuthenticated) {
        const landing = getAdminLandingPath(user);
        router.replace(landing);
      }
      setIsAuthorized(true);
      return;
    }

    if (isGatekeeperRoute) {
      // Handled by /admin/page.tsx
      setIsAuthorized(true);
      return;
    }

    // Protected admin routes
    if (isAuthenticated) {
      setIsAuthorized(true);
    } else {
      clearAdminSession();
      setIsAuthorized(false);
      router.replace("/admin/login");

      // Hard fallback in case client-side router transition stalls
      const fallbackTimer = setTimeout(() => {
        if (typeof window !== "undefined" && window.location.pathname !== "/admin/login") {
          window.location.replace("/admin/login");
        }
      }, 1200);

      return () => clearTimeout(fallbackTimer);
    }
  }, [pathname, isLoginRoute, isGatekeeperRoute, router]);

  // If on a protected route and not yet authorized, show the loading spinner
  if (!isAuthorized && !isLoginRoute && !isGatekeeperRoute) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return <SidebarProvider>{children}</SidebarProvider>;
}
