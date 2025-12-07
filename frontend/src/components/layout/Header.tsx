"use client";

import Link from "next/link";
import Image from "next/image"; 
import { usePathname } from "next/navigation";
import { 
  Menu, 
  Home, 
  Info, 
  Stethoscope, 
  Users, 
  Phone, 
  LogIn, 
  UserPlus,
  ChevronRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About Us", icon: Info },
  { href: "/departments", label: "Departments", icon: Stethoscope },
  { href: "/doctors", label: "Doctors", icon: Users },
  { href: "/contact", label: "Contact", icon: Phone },
];

const Header = () => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header 
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        isScrolled 
          ? "bg-white/90 backdrop-blur-md border-b shadow-sm" 
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="container flex h-20 max-w-screen-2xl items-center justify-between px-6">
        
        {/* LOGO AREA */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 transition-transform duration-300 group-hover:scale-110">
            <Image 
              src="/logo.png" 
              alt="Care Link Logo" 
              fill 
              className="object-contain"
            />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 group-hover:text-cyan-600 transition-colors">
            Care <span className="text-cyan-500">Link</span>
          </span>
        </Link>
        
        {/* DESKTOP NAVIGATION */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-cyan-50 text-cyan-700 font-semibold" 
                    : "text-slate-600 hover:text-cyan-600 hover:bg-slate-50"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* DESKTOP AUTH BUTTONS */}
        <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
                <Button variant="ghost" className="text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-full">
                  Log In
                </Button>
            </Link>
            
            {/* ✅ FIXED LINK HERE */}
            <Link href="/signup"> 
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all">
                  Sign Up <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
            </Link>
        </div>

        {/* MOBILE MENU TOGGLE */}
        <div className="md:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-700">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Open Menu</span>
              </Button>
            </SheetTrigger>
            
            <SheetContent side="right" className="w-[300px] sm:w-[400px] border-l-cyan-100">
              <div className="flex flex-col h-full">
                
                {/* Mobile Header */}
                <div className="flex items-center gap-3 border-b pb-6 mb-6">
                  <div className="relative w-8 h-8">
                    <Image src="/logo.png" alt="Logo" fill className="object-contain" />
                  </div>
                  <span className="font-bold text-lg text-slate-900">Care Link</span>
                </div>

                {/* Mobile Nav Links */}
                <nav className="flex flex-col gap-2">
                  {navLinks.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-cyan-50 text-cyan-700 font-semibold"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", isActive ? "text-cyan-600" : "text-slate-400")} />
                        {label}
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                      </Link>
                    );
                  })}
                </nav>

                {/* Mobile Auth Buttons */}
                <div className="mt-auto pt-6 border-t space-y-3">
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button variant="outline" className="w-full justify-start gap-3 rounded-xl h-12 border-slate-200">
                          <LogIn className="h-4 w-4 text-slate-500" />
                          Log In
                        </Button>
                    </Link>
                    
                    {/* ✅ FIXED LINK HERE TOO */}
                    <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                        <Button className="w-full justify-start gap-3 bg-cyan-500 hover:bg-cyan-600 rounded-xl h-12 text-white shadow-lg shadow-cyan-200">
                          <UserPlus className="h-4 w-4" />
                          Create Account
                        </Button>
                    </Link>
                </div>

              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;