"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminGatekeeper() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    
    if (token) {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/admin/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-cyan-600 border-t-transparent rounded-full"></div>
    </div>
  );
}