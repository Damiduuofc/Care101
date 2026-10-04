"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck, CalendarRange, Building, Clock, ChevronRight, Activity } from "lucide-react";
import Link from "next/link";

import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminUser } from "@/lib/adminSession";

export default function ReceptionistDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const parsedUser = getAdminUser();
        if (parsedUser) {
            if (parsedUser.role !== "receptionist") {
                router.push("/admin/dashboard");
                return;
            }
            setUser(parsedUser);
        } else {
            clearAdminSession();
            router.push("/admin/login");
            return;
        }
        setLoading(false);
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;

    const actions = [
        {
            title: "Confirm Doctor Arrival",
            description: "Mark doctors as arrived for their shifts and notify patients.",
            icon: UserCheck,
            color: "text-emerald-700",
            bgBase: "bg-emerald-50",
            iconColor: "text-emerald-600",
            href: "/admin/doctors/arrival"
        },
        {
            title: "Confirm/Cancel Appointments",
            description: "Manage patient appointments, confirm bookings or process cancellations.",
            icon: CalendarRange,
            color: "text-blue-700",
            bgBase: "bg-blue-50",
            iconColor: "text-blue-600",
            href: "/admin/appointments"
        },
        {
            title: "Room Allocation",
            description: "Allocate rooms for doctors with assigned nurses.",
            icon: Building,
            color: "text-purple-700",
            bgBase: "bg-purple-50",
            iconColor: "text-purple-600",
            href: "/admin/room-allocation"
        },
        {
            title: "Update Channeling Time",
            description: "Adjust or delay doctor channeling times in case of emergencies or delays.",
            icon: Clock,
            color: "text-amber-700",
            bgBase: "bg-amber-50",
            iconColor: "text-amber-600",
            href: "/admin/channeling-time"
        }
    ];

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Receptionist Dashboard</h1>
                    <p className="text-slate-500 mt-2 text-lg">
                        Welcome back, <span className="font-semibold text-cyan-700">{user?.name || 'Receptionist'}</span>! Manage daily desk tasks here.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-cyan-50 px-5 py-2.5 rounded-xl border border-cyan-100 shadow-inner">
                    <Activity className="h-5 w-5 text-cyan-600 animate-pulse" />
                    <span className="text-sm font-semibold text-cyan-800 tracking-wide uppercase">
                        Reception Desk Active
                    </span>
                </div>
            </div>

            {/* Action Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {actions.map((action, index) => (
                    <Link href={action.href} key={index} className="block group">
                        <Card className="h-full border-slate-200 hover:border-cyan-300 hover:shadow-lg transition-all duration-300 relative overflow-hidden bg-white group-hover:-translate-y-1">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${action.bgBase.replace('50', '500')}`}></div>
                            <CardContent className="p-8">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-5">
                                        <div className={`p-4 rounded-2xl ${action.bgBase} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                            <action.icon className={`h-8 w-8 ${action.iconColor}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-cyan-700 transition-colors">
                                                {action.title}
                                            </h3>
                                            <p className="text-slate-500 leading-relaxed text-sm">
                                                {action.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-slate-300 group-hover:text-cyan-500 transition-colors">
                                        <ChevronRight className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* Quick Summary or recent activity can go here later */}
        </div>
    );
}
