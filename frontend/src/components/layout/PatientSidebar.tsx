
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Calendar, FileText, CreditCard, Bell, User, LogOut } from 'lucide-react';
import Logo from '@/components/icons/Logo';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const navLinks = [
  { href: "/patient", label: "Dashboard", icon: LayoutDashboard },
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
    <aside className="fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      <div className="flex items-center justify-center h-20 border-b border-sidebar-border">
         <Link href="/patient" className="flex items-center gap-2 font-bold text-xl" onClick={handleLinkClick}>
            <Logo className="h-8 w-8 text-primary" />
            <span className="font-headline text-sidebar-primary">MediServe</span>
        </Link>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase">Menu</p>
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={handleLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              (pathname === href || (href !== "/patient" && pathname.startsWith(href)))
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : ""
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="px-4 py-6 mt-auto">
        <Separator className="my-4 bg-sidebar-border" />
         <Link
            href="/patient/profile"
            onClick={handleLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              pathname.startsWith('/patient/profile') ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : ""
            )}
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
        </Link>
         <Link
            href="/login"
            onClick={handleLinkClick}
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
        </Link>
      </div>
    </aside>
  );
};

export default PatientSidebar;
