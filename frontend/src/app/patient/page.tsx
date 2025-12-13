"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Upload, MessageSquare, Bell, BarChart3, ShieldCheck, HeartPulse, User, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';


const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/patient`;
export default function PatientHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // State for Dashboard Data
  const [data, setData] = useState({
    name: "",
    profileImage: "",
    stats: {
        appointments: 0,
        prescriptions: 0,
        reports: 0,
        vitals: "--"
    },
    activities: [] as any[]
  });

  // Fetch Data on Load
  useEffect(() => {
    const fetchData = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await fetch(`${API_URL}/dashboard`, {
          headers: { "Authorization": `Bearer ${token}` }
        });

        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // Animation Variants
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Dynamic Overview Data
  const patientOverview = [
    { title: "Upcoming Appointments", value: data.stats.appointments, icon: Calendar, subtitle: "Next: None" },
    { title: "Active Prescriptions", value: data.stats.prescriptions, icon: FileText, subtitle: "Current medications" },
    { title: "Lab Reports", value: data.stats.reports, icon: BarChart3, subtitle: "Available for download" },
    { title: "Health Status", value: data.stats.vitals, icon: HeartPulse, subtitle: "Based on last visit" },
  ];

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <motion.div 
        className="space-y-8 max-w-7xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
    >
        {/* WELCOME CARD */}
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden border-none shadow-md">
                <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8 bg-gradient-to-r from-cyan-50 via-white to-white">
                    {/* Replace the <Image> component with a standard <img> tag */}
                    <div className="relative h-28 w-28 rounded-full border-4 border-white shadow-lg bg-slate-200 flex items-center justify-center overflow-hidden">
                        {data.profileImage ? (
                                // ✅ USE STANDARD IMG TAG FOR BASE64
                                <img 
                                src={data.profileImage} 
                                alt="Profile" 
                                className="h-32 w-32 object-cover"
                                />
                        ) : (
                            <User className="h-12 w-12 text-slate-400" />
                        )}
                    </div>
                    <div className='text-center md:text-left space-y-2'>
                        <h1 className="text-4xl font-bold font-headline text-slate-900">
                            Welcome, <span className="text-cyan-600">{data.name.split(' ')[0]}</span>!
                        </h1>
                        <p className="text-slate-500 text-lg">Here is your health summary and quick access to your records.</p>
                    </div>
                    
                    {/* Notification Pill */}
                    <div className="md:ml-auto flex items-center gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl shadow-sm">
                        <div className="bg-yellow-100 p-2 rounded-full">
                            <Bell className="h-5 w-5 text-yellow-700"/>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold">Notifications</span>
                            <span className="text-xs text-yellow-700/80">You have 0 new messages.</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>

        {/* OVERVIEW STATS */}
        <motion.div variants={sectionVariants}>
            <h2 className="text-2xl font-bold tracking-tight mb-6 font-headline text-slate-900">Overview</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {patientOverview.map((item, i) => {
                    const Icon = item.icon;
                    return (
                     <motion.div key={i} variants={itemVariants}>
                        <Card className="hover:shadow-md transition-shadow duration-200 border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">{item.title}</CardTitle>
                                <Icon className="h-4 w-4 text-cyan-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-slate-900">{item.value}</div>
                                <p className="text-xs text-slate-500 mt-1">{item.subtitle}</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )})}
            </div>
        </motion.div>
        
        {/* ACTIONS & ACTIVITY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* QUICK ACTIONS */}
            <motion.div className="lg:col-span-2" variants={itemVariants}>
                 <h2 className="text-2xl font-bold tracking-tight mb-6 font-headline text-slate-900">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <QuickActionCard href="/patient/appointments" icon={Calendar} title="Book Appointment" description="Schedule your next visit with a specialist."/>
                    <QuickActionCard href="/patient/records" icon={FileText} title="View Prescriptions" description="Access your medication history and details."/>
                    <QuickActionCard href="/patient/records" icon={Upload} title="Upload Documents" description="Add new lab reports or medical scans."/>
                    <QuickActionCard href="/contact" icon={MessageSquare} title="Contact Support" description="Get help with your account or appointments."/>
                </div>
            </motion.div>

            {/* RECENT ACTIVITY */}
            <motion.div variants={itemVariants}>
                <h2 className="text-2xl font-bold tracking-tight mb-6 font-headline text-slate-900">Recent Activities</h2>
                <Card className="h-fit">
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {data.activities.length > 0 ? (
                                data.activities.map((activity, index) => (
                                    <div key={index} className="flex items-start gap-4 p-4 hover:bg-slate-50 transition-colors">
                                        <div className="bg-cyan-50 p-2 rounded-full mt-1">
                                            <ShieldCheck className="h-4 w-4 text-cyan-600" />
                                        </div>
                                        <div className="flex-grow">
                                            <p className="font-medium text-sm text-slate-900">{activity.description}</p>
                                            <p className="text-xs text-slate-500">{activity.timestamp}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-500 text-sm">
                                    No recent activity found.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    </motion.div>
  );
}

// Helper Component for Action Cards
function QuickActionCard({ href, icon: Icon, title, description }: { href: string, icon: React.ElementType, title: string, description: string }) {
  return (
    <Link href={href}>
        <Card className="hover:bg-cyan-50/50 hover:border-cyan-200 transition-all duration-200 h-full cursor-pointer group">
            <CardContent className="p-6 flex items-start gap-4">
                <div className="p-3 bg-cyan-100 rounded-xl group-hover:bg-cyan-200 transition-colors">
                    <Icon className="h-6 w-6 text-cyan-700" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-cyan-700 transition-colors">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
                </div>
            </CardContent>
        </Card>
    </Link>
  );
}