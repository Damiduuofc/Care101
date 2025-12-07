"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram, 
  MapPin, 
  Mail, 
  Phone, 
  Clock, 
  ChevronRight 
} from "lucide-react";
import { departments } from "@/lib/data";
import { Button } from "@/components/ui/button";

const Footer = () => {
  const quickLinks = [
    { href: "/about", label: "About Us" },
    { href: "/doctors", label: "Find a Doctor" },
    { href: "/appointments", label: "Book Appointment" },
    { href: "/contact", label: "Contact Us" },
    { href: "/careers", label: "Careers" },
  ];

  const socialLinks = [
    { icon: Facebook, href: "#" },
    { icon: Twitter, href: "#" },
    { icon: Linkedin, href: "#" },
    { icon: Instagram, href: "#" },
  ];

  return (
    <footer className="bg-slate-950 pt-20 pb-10 text-slate-400 font-sans border-t border-slate-800">
      <div className="container px-6 mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* COLUMN 1: BRAND INFO */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10 bg-white rounded-lg p-1">
                {/* Local image usage */}
                <Image 
                  src="/logo.png" 
                  alt="CareLink Logo" 
                  fill 
                  className="object-contain p-1"
                />
              </div>
              <span className="font-bold text-2xl text-slate-100 group-hover:text-cyan-400 transition-colors">
                Care<span className="text-cyan-500">101</span>
              </span>
            </Link>
            <p className="text-slate-400 leading-relaxed text-sm">
              Providing compassionate care with cutting-edge technology. We are your trusted partner in health, dedicated to excellence in every patient interaction.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social, i) => (
                <Link 
                  key={i} 
                  href={social.href} 
                  className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-cyan-500 hover:text-white transition-all duration-300"
                >
                  <social.icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* COLUMN 2: QUICK LINKS */}
          <div>
            <h3 className="text-slate-100 font-bold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-1 bg-cyan-500 rounded-full"></span>
              Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href} 
                    className="group flex items-center text-sm hover:text-cyan-400 transition-colors"
                  >
                    <ChevronRight className="h-3 w-3 mr-2 text-slate-600 group-hover:text-cyan-500 transition-colors" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* COLUMN 3: DEPARTMENTS */}
          <div>
            <h3 className="text-slate-100 font-bold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-1 bg-cyan-500 rounded-full"></span>
              Departments
            </h3>
            <ul className="space-y-3">
              {departments.slice(0, 5).map((dept) => (
                <li key={dept.slug || dept.name}>
                  <Link 
                    href={`/departments/${dept.slug}`} 
                    className="group flex items-center text-sm hover:text-cyan-400 transition-colors"
                  >
                    <ChevronRight className="h-3 w-3 mr-2 text-slate-600 group-hover:text-cyan-500 transition-colors" />
                    {dept.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* COLUMN 4: CONTACT & EMERGENCY */}
          <div>
            <h3 className="text-slate-100 font-bold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-1 bg-cyan-500 rounded-full"></span>
              Contact Us
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-cyan-500 shrink-0 mt-0.5" />
                <p>123 Health St, Wellness City,<br />Kandy, 12345</p>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-cyan-500 shrink-0" />
                <a href="mailto:contact@carelink.com" className="hover:text-cyan-400 transition-colors">
                  contact@care101.com
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-cyan-500 shrink-0" />
                <p>Mon - Sun: 24 Hours Open</p>
              </div>
              
              <div className="pt-4 mt-4 border-t border-slate-800">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold">Emergency Hotline</p>
                <a href="tel:0763801234" className="flex items-center gap-3 text-2xl font-bold text-white hover:text-red-400 transition-colors">
                  <Phone className="h-6 w-6 text-red-500 animate-pulse" />
                  +94 76 380 1234
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* COPYRIGHT BAR */}
        <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-600">
            &copy; {new Date().getFullYear()} Care Link Hospital. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-600">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="/sitemap" className="hover:text-slate-300 transition-colors">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;