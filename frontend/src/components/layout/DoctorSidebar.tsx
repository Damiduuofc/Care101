"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, HandCoins, BookUser, FilePenLine, User, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import Logo from "@/public/logo.png";
const navLinks = [
  { href: "/doctor", label: "Home", icon: Home },
  { href: "/doctor/finance", label: "Finance", icon: HandCoins },
  { href: "/doctor/records", label: "Records", icon: BookUser },
  { href: "/doctor/instructions", label: "Instructions", icon: FilePenLine },
  { href: "/doctor/profile", label: "Profile", icon: User },
];

const DoctorSidebar = ({ onLinkClick }: { onLinkClick?: () => void }) => {
  const pathname = usePathname();

  const handleLinkClick = () => {
    if (onLinkClick) {
        onLinkClick();
    }
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-40">
      <div className="flex items-center justify-center h-20 border-b border-sidebar-border">
         <Link href="/doctor" className="flex items-center gap-2 font-bold text-xl" onClick={handleLinkClick}>
            <img src="/logo.png" alt="Logo" width={40} height={40}/>
            <span className="font-headline text-sidebar-primary">MediServe</span>
        </Link>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={handleLinkClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              (pathname === href || (href !== "/doctor" && pathname.startsWith(href)))
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
            href="/doctor/profile"
            onClick={handleLinkClick}
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
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

export default DoctorSidebar;
