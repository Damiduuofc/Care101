"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminGatekeeper() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    
    // SAFETY CHECK: Ensure token is a string and looks like a JWT (3 parts)
    const isValidStructure = token && typeof token === "string" && token.split('.').length === 3;
    
    if (isValidStructure) {
      router.replace("/admin/dashboard");
    } else {
      // If token is garbage/corrupt, clear it so we don't crash the app later
      if (token) localStorage.removeItem("adminToken");
      router.replace("/admin/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-cyan-600 border-t-transparent rounded-full"></div>
    </div>
  );
}