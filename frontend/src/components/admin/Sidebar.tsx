"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { menuItems } from "@/lib/adminMenu";
import { LogOut, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    // 1. Get User Info from LocalStorage
    const storedUser = localStorage.getItem("adminUser");
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setRole(user.role || "receptionist"); // Default fallback
      setUserName(user.name || "Staff Member");
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    router.push("/admin/login");
  };

  // 2. Filter Menu Items based on Role
  const filteredMenu = menuItems.filter((item) => item.roles.includes(role));

  return (
    <div className="h-screen w-64 bg-slate-900 text-white flex flex-col fixed left-0 top-0 border-r border-slate-800">
      
      {/* HEADER */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
       <img src="/logo.png" alt="Care101 Logo" className="h-8 w-8 object-contain" />
        <div>
            <h1 className="font-bold text-lg tracking-wide">Care101</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{role.replace('_', ' ')}</p>
        </div>
      </div>

      {/* MENU */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {filteredMenu.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium text-sm">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* USER & LOGOUT */}
      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-xl p-4">
            <p className="text-sm font-semibold text-white mb-1">{userName}</p>
            <p className="text-xs text-slate-400 mb-3">Logged in</p>
            
            <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-xs font-bold transition-colors"
            >
                <LogOut className="h-3 w-3" /> Logout
            </button>
        </div>
      </div>
    </div>
  );
}