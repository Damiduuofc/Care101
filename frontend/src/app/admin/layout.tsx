"use client";

import { PageSkeleton } from "@/components/ui/skeleton-presets";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminSession, getAdminLandingPath, getAdminToken, getAdminUser } from "@/lib/adminSession";
import { SidebarProvider } from "@/components/admin/SidebarContext";
import ConfirmHost from "@/components/admin/ConfirmHost";
import { notify } from "@/lib/notify";

// When the staff login expires mid-shift, send them back to the login page with a message
// instead of leaving every page silently empty.
let fetchPatched = false;
let expiredHandled = false;
function handleExpiredSession() {
  if (expiredHandled || window.location.pathname === "/admin/login") return;
  expiredHandled = true;
  clearAdminSession();
  notify("Your session has expired. Please log in again.", "info");
  window.location.href = "/admin/login";
}
function watchForExpiredSession() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    // 401 from our API = token missing/expired (wrong passwords return 400, so login is unaffected)
    if (response.status === 401 && apiBase && url.startsWith(apiBase) && !url.includes("/login")) {
      handleExpiredSession();
    }
    return response;
  };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginRoute = pathname === "/admin/login";
  const isGatekeeperRoute = pathname === "/admin";

  // Login and gatekeeper routes render immediately without a blocking layout spinner
  const [isAuthorized, setIsAuthorized] = useState(isLoginRoute || isGatekeeperRoute);

  // Catch expiry both from failed API calls and from the token's own expiry time
  useEffect(() => {
    if (isLoginRoute || isGatekeeperRoute) return;
    watchForExpiredSession();
    expiredHandled = false;
    const timer = setInterval(() => {
      if (!getAdminToken()) handleExpiredSession();
    }, 30 * 1000);
    return () => clearInterval(timer);
  }, [isLoginRoute, isGatekeeperRoute]);

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
      <PageSkeleton />
    );
  }

  return (
    <SidebarProvider>
      {children}
      <ConfirmHost />
    </SidebarProvider>
  );
}
