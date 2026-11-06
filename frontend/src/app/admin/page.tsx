"use client";

import { PageSkeleton } from "@/components/ui/skeleton-presets";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminLandingPath, getAdminToken, getAdminUser } from "@/lib/adminSession";

export default function AdminGatekeeper() {
  const router = useRouter();

  useEffect(() => {
    const token = getAdminToken();
    const user = getAdminUser();

    if (token && user) {
      router.replace(getAdminLandingPath(user));
    } else {
      clearAdminSession();
      router.replace("/admin/login");
    }

    // Safety fallback: if client-side navigation stalls, hard redirect
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        const currentToken = getAdminToken();
        const currentUser = getAdminUser();
        if (currentToken && currentUser) {
          window.location.replace(getAdminLandingPath(currentUser));
        } else {
          window.location.replace("/admin/login");
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <PageSkeleton />
  );
}
