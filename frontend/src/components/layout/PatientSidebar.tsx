"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  CreditCard, 
  Bell, 
  User, 
  LogOut, 
  Globe // ✅ Added Icon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const navLinks = [
  { href: "/patient", label: "Dashboard", icon: LayoutDashboard }, // Fixed: Points to dashboard, not home
  { href: "/patient/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/records", label: "Medical Records", icon: FileText },
  { href: "/patient/billing", label: "Billing", icon: CreditCard },
  { href: "/patient/notifications", label: "Notifications", icon: Bell },
];

const PatientSidebar = ({ onLinkClick }: { onLinkClick?: () => void }) => {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (onLinkClick) {
        onLinkClick();
    }
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-40 shadow-sm">
      
      {/* 1. LOGO - Clicks to Website Home */}
      <div className="flex items-center justify-center h-20 border-b border-slate-200">
         <Link 
            href="/" 
            className="flex items-center gap-2 font-bold text-xl group" 
            onClick={handleLinkClick}
         >
            <img 
                src="/logo.png" 
                alt="Logo" 
                width={40} 
                height={40}
                className="transition-transform group-hover:scale-110"
            />
            <span className="font-headline text-slate-900 group-hover:text-cyan-600 transition-colors">
                Care <span className="text-cyan-500">101</span>
            </span>
        </Link>
      </div>

      {/* 2. NAVIGATION LINKS */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Menu</p>
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={handleLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
              (pathname === href || (href !== "/patient" && pathname.startsWith(href)))
                ? "bg-cyan-50 text-cyan-700 border border-cyan-100" // Active
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900" // Inactive
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* 3. BOTTOM ACTIONS */}
      <div className="px-4 py-6 mt-auto bg-slate-50 border-t border-slate-100">
        
         {/* ✅ NEW: Website Home Button */}
         <Link
            href="/"
            onClick={handleLinkClick}
            className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white hover:shadow-sm mb-2 border border-transparent hover:border-slate-200"
          >
            <Globe className="h-5 w-5 text-cyan-600" />
            <span>Go Back Home</span>
        </Link>

        <Separator className="my-2 bg-slate-200" />

         <Link
            href="/patient/profile"
            onClick={handleLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-200/50 hover:text-slate-900",
              pathname.startsWith('/patient/profile') ? "text-cyan-700 font-semibold" : "text-slate-600"
            )}
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
        </Link>
        
         <Link
            href="/login"
            onClick={() => {
                handleLinkClick();
                sessionStorage.clear(); // Clear session on logout
            }}
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
        </Link>
      </div>
    </aside>
  );
};

export default PatientSidebar;