"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Home,
  Info,
  Stethoscope,
  Users,
  Phone,
  LogIn,
  UserPlus,
  ChevronRight,
  LogOut,
  User,
  Settings
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About Us", icon: Info },
  { href: "/departments", label: "Departments", icon: Stethoscope },
  { href: "/doctors", label: "Doctors", icon: Users },
  { href: "/contact", label: "Contact", icon: Phone, highlight: true },
];

const Header = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // User State
  const [user, setUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // Function to check session storage
    const checkUserSession = () => {
      const storedUser = sessionStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }
    };

    // Run immediately
    checkUserSession();

    // Scroll listener
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    // Cleanup
    return () => window.removeEventListener("scroll", handleScroll);

    // 🚨 KEY FIX: Add 'pathname' here. 
    // This forces the header to re-check the user every time the URL changes.
  }, [pathname]); 

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    setUser(null);
    router.push("/");
    router.refresh(); // Forces a refresh of the page to clear any cached data
  };

  // Prevent hydration mismatch
  if (!isMounted) return null;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        isScrolled
          ? "bg-white/90 backdrop-blur-md border-b shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="container flex h-20 max-w-screen-2xl items-center justify-between px-6">

        {/* LOGO */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 transition-transform duration-300 group-hover:scale-110">
            <Image
              src="/logo.png"
              alt="Care Link Logo"
              fill
              priority
              sizes="40px"
              className="object-contain"
            />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 group-hover:text-cyan-600 transition-colors">
            Care <span className="text-cyan-500">101</span>
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, highlight }) => {
            // Skip rendering Contact here to keep it distinct
            if (highlight) return null;

            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-cyan-50 text-cyan-700 font-semibold shadow-sm"
                    : "text-slate-600 hover:text-cyan-700 hover:bg-slate-50"
                )}
              >
                {label}
              </Link>
            );
          })}
          
          {/* Highlighted Contact Button */}
          <Link href="/contact">
             <Button variant="ghost" className="text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700">
                Contact
             </Button>
          </Link>
        </nav>

        {/* DESKTOP AUTH / USER PROFILE */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            // --- STATE: LOGGED IN ---
            <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-900">
                  {user.name || "Patient"}
                </span>
                <span className="text-xs text-slate-500">
                   {user.role === 'doctor' ? 'Doctor' : 'Patient'}
                </span>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-11 w-11 rounded-full border-2 border-cyan-100 p-0 hover:bg-cyan-100 overflow-hidden shadow-sm transition-all hover:border-cyan-300">
                    {user.profileImage ? (
                       <Image 
                         src={user.profileImage} 
                         alt="Profile" 
                         fill 
                         className="object-cover" 
                       />
                    ) : (
                       <div className="h-full w-full bg-gradient-to-br from-cyan-100 to-cyan-50 flex items-center justify-center text-cyan-600">
                          <User className="h-6 w-6" />
                       </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/patient')} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            // --- STATE: LOGGED OUT ---
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-full"
                >
                  Log In
                </Button>
              </Link>

              <Link href="/signup/patient/step1">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all flex items-center">
                  Sign Up <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* MOBILE MENU */}
        <div className="md:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-700">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="right"
              className="w-[300px] sm:w-[350px] border-l p-6 flex flex-col"
            >
              {/* MOBILE HEADER */}
              <div className="flex items-center gap-3 mb-8 pb-4 border-b">
                <div className="relative w-8 h-8">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    fill
                    sizes="32px"
                    className="object-contain"
                  />
                </div>
                <span className="font-bold text-lg text-slate-900">Care 101</span>
              </div>

              {/* MOBILE USER PROFILE (If Logged In) */}
              {user && (
                <div className="mb-6 bg-slate-50 p-4 rounded-xl flex items-center gap-3 border border-slate-100">
                   <div className="h-10 w-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 overflow-hidden relative border border-cyan-200">
                      {user.profileImage ? (
                         <Image src={user.profileImage} alt="Profile" fill className="object-cover" />
                      ) : (
                         <User className="h-5 w-5" />
                      )}
                   </div>
                   <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">{user.name || "Patient"}</span>
                      <span className="text-xs text-slate-500">{user.email || "Account"}</span>
                   </div>
                </div>
              )}

              {/* MOBILE NAV */}
              <nav className="flex flex-col gap-1">
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
                          ? "bg-cyan-50 text-cyan-700 font-semibold border border-cyan-200"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          isActive ? "text-cyan-600" : "text-slate-400"
                        )}
                      />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              {/* MOBILE ACTION BUTTONS */}
              <div className="mt-auto pt-6 border-t space-y-3">
                {user ? (
                   // Mobile Logged In Actions
                   <Button
                    variant="outline"
                    onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                    }}
                    className="w-full justify-start gap-3 rounded-xl h-12 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <LogOut className="h-4 w-4" />
                    Log Out
                  </Button>
                ) : (
                   // Mobile Logged Out Actions
                   <>
                    <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 rounded-xl h-12 border-slate-200"
                      >
                        <LogIn className="h-4 w-4 text-slate-500" />
                        Log In
                      </Button>
                    </Link>

                    <Link
                      href="/signup/patient/step1"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Button className="w-full justify-start gap-3 bg-cyan-500 hover:bg-cyan-600 rounded-xl h-12 text-white shadow-lg shadow-cyan-200">
                        <UserPlus className="h-4 w-4" />
                        Create Account
                      </Button>
                    </Link>
                   </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Header;