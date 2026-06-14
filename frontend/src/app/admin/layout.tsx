"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminLandingPath, getAdminToken, getAdminUser } from "@/lib/adminSession";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [canRender, setCanRender] = useState(pathname === "/admin/login");

  useEffect(() => {
    const token = getAdminToken();
    const user = getAdminUser();
    const isAuthRoute = pathname === "/admin" || pathname === "/admin/login";

    if (token && user) {
      if (isAuthRoute) {
        router.replace(getAdminLandingPath(user));
        setCanRender(false);
        return;
      }

      setCanRender(true);
      return;
    }

    clearAdminSession();

    if (pathname === "/admin/login") {
      setCanRender(true);
      return;
    }

    setCanRender(false);
    router.replace("/admin/login");
  }, [pathname, router]);

  if (!canRender && pathname !== "/admin/login") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-cyan-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return <>{children}</>;
}