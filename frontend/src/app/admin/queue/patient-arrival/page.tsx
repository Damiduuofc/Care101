"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    CheckCircle, Circle, Search, Loader2, Calendar, 
    ArrowUpDown, ArrowUp, ArrowDown, Activity, AlertCircle, Clock
} from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

export default function NursePatientArrivals() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterTab, setFilterTab] = useState<"today" | "all" | "arrived" | "pending">("today");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Sorting State
    const [sortField, setSortField] = useState<"patient" | "date" | "doctor" | "arrived">("date");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    useEffect(() => {
        const storedUser = getAdminUser();
        if (!storedUser) {
            clearAdminSession();
            router.push("/admin/login");
            return;
        }
        if (storedUser.role !== "nurse") {
            router.push("/admin/dashboard");
            return;
        }
        setUser(storedUser);
        fetchInitialData();
    }, [router]);

    const fetchInitialData = async () => {
        try {
            const token = getAdminToken();
            
            // 1. Fetch Doctors
            const docRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (docRes.ok) {
                const docData = await docRes.json();
                setDoctors(Array.isArray(docData) ? docData : []);
            }

            // 2. Fetch Appointments
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setAppointments(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch initial data", err);
        } finally {
            setLoading(false);
        }
    };

    const toggleArrival = async (id: string, currentStatus: boolean) => {
        setUpdatingId(id);
        const newStatus = !currentStatus;
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify({ arrived: newStatus })
            });

            if (res.ok) {
                setAppointments(prev => prev.map(appt => 
                    appt._id === id ? { ...appt, arrived: newStatus } : appt
                ));
            } else {
                const contentType = res.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const err = await res.json();
                    alert(`Error: ${err.msg}`);
                } else {
                    alert(`Error: ${res.status} ${res.statusText}`);
                }
            }
        } catch (err) {
            console.error("Failed to update arrival status", err);
        } finally {
            setUpdatingId(null);
        }
    };

    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    const renderSortIcon = (field: typeof sortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
        }
        return sortOrder === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-cyan-600 font-bold" />
        ) : (
            <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-cyan-600 font-bold" />
        );
    };

    // Filter and Search Logic
    const assignedDoctorIds = doctors
        .filter(doc => doc.allocatedNurse === user?.name)
        .map(doc => doc._id);

    const filteredAppointments = appointments
        .filter((appt) => {
            // Only include appointments for doctors assigned to this nurse
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            const isAssigned = assignedDoctorIds.includes(apptDocId);
            if (!isAssigned) return false;

            // Apply Search filter
            const query = searchTerm.toLowerCase();
            const patientName = appt.patientId?.fullName?.toLowerCase() || "";
            const patientId = appt.patientId?.patientId?.toLowerCase() || appt.patientId?._id?.toLowerCase() || "";
            const doctorName = appt.doctorName?.toLowerCase() || "";
            const matchesSearch = patientName.includes(query) || patientId.includes(query) || doctorName.includes(query);

            if (!matchesSearch) return false;

            // Apply Tab filter
            if (filterTab === "today") {
                return isToday(appt.date);
            } else if (filterTab === "arrived") {
                return appt.arrived === true;
            } else if (filterTab === "pending") {
                return !appt.arrived;
            }
            return true; // "all"
        })
        .sort((a, b) => {
            let comparison = 0;
            if (sortField === "patient") {
                const nameA = (a.patientId?.fullName || "").toLowerCase();
                const nameB = (b.patientId?.fullName || "").toLowerCase();
                comparison = nameA.localeCompare(nameB);
            } else if (sortField === "doctor") {
                const docA = (a.doctorName || "").toLowerCase();
                const docB = (b.doctorName || "").toLowerCase();
                comparison = docA.localeCompare(docB);
                if (comparison === 0) {
                    const qA = a.queueNumber || 0;
                    const qB = b.queueNumber || 0;
                    comparison = qA - qB;
                }
            } else if (sortField === "arrived") {
                const arrA = a.arrived ? 1 : 0;
                const arrB = b.arrived ? 1 : 0;
                comparison = arrA - arrB;
            } else {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                comparison = dateA - dateB;
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

    const formatTime = (timeStr: string) => {
        if (!timeStr) return "N/A";
        return timeStr;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "N/A";
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const nurseAppointments = appointments.filter(appt => {
        const apptDocId = appt.doctorId?._id || appt.doctorId;
        return assignedDoctorIds.includes(apptDocId);
    });
    const todayAppointments = nurseAppointments.filter(appt => isToday(appt.date));
    const arrivedTodayCount = todayAppointments.filter(appt => appt.arrived).length;

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 transition-all">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Patient Arrivals</h1>
                        <p className="text-slate-500 mt-1">Manage and confirm patient arrivals for your assigned sessions.</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <Card className="px-4 py-2 flex items-center gap-3 bg-white shadow-sm border-slate-200">
                            <Activity className="text-cyan-600 h-5 w-5 animate-pulse" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Today's Patients</p>
                                <p className="text-sm font-bold text-slate-700">
                                    {arrivedTodayCount} / {todayAppointments.length} Arrived
                                </p>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Controls Section (Search + Tabs) */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Search patient name, ID, or doctor..." 
                            className="pl-10 bg-white border-slate-200 focus-visible:ring-cyan-500 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex bg-slate-200/60 p-1 rounded-xl shadow-inner max-w-fit border border-slate-200/40">
                        <button
                            onClick={() => setFilterTab("today")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterTab === "today"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setFilterTab("pending")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterTab === "pending"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Not Arrived
                        </button>
                        <button
                            onClick={() => setFilterTab("arrived")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterTab === "arrived"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Arrived
                        </button>
                        <button
                            onClick={() => setFilterTab("all")}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterTab === "all"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            All
                        </button>
                    </div>
                </div>

                {/* Table Section */}
                <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 flex flex-row justify-between items-center">
                        <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Appointments list ({filteredAppointments.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                                <p className="text-sm font-medium">Loading appointments...</p>
                            </div>
                        ) : filteredAppointments.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm font-medium">No appointments found matching this criteria.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 text-slate-600 text-sm bg-slate-50/30">
                                            <th className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors" onClick={() => handleSort("patient")}>
                                                Patient {renderSortIcon("patient")}
                                            </th>
                                            <th className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors" onClick={() => handleSort("date")}>
                                                Date & Time {renderSortIcon("date")}
                                            </th>
                                            <th className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors" onClick={() => handleSort("doctor")}>
                                                Doctor {renderSortIcon("doctor")}
                                            </th>
                                            <th className="p-4 font-semibold">Queue No</th>
                                            <th className="p-4 font-semibold">Payment Status</th>
                                            <th className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors" onClick={() => handleSort("arrived")}>
                                                Arrival Status {renderSortIcon("arrived")}
                                            </th>
                                            <th className="p-4 font-semibold text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {filteredAppointments.map((appt) => (
                                            <tr key={appt._id} className="hover:bg-slate-50/40 transition-colors">
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-bold text-slate-900 leading-tight">
                                                            {appt.patientId?.fullName || "Walk-in Patient"}
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-0.5">
                                                            ID: {appt.patientId?.patientId || appt.patientId?._id?.substring(0, 8) || "N/A"}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-semibold text-slate-800 text-sm leading-tight flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDate(appt.date)}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {formatTime(appt.timeSlot || appt.time || "N/A")}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-semibold text-slate-800 text-sm">
                                                            {appt.doctorName || "General Staff"}
                                                        </p>
                                                        <p className="text-xs text-cyan-600 capitalize">
                                                            {appt.department || "OPD"}
                                                        </p>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-bold text-slate-700">
                                                    #{appt.queueNumber || "N/A"}
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant="outline" className={
                                                        appt.paymentStatus?.toLowerCase() === "paid"
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                        : "bg-amber-50 text-amber-700 border-amber-100"
                                                    }>
                                                        {appt.paymentStatus || "Pending"}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`w-2.5 h-2.5 rounded-full ${appt.arrived ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                                                        <span className="text-sm font-medium text-slate-600">
                                                            {appt.arrived ? "Present" : "Absent"}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={updatingId === appt._id}
                                                        onClick={() => toggleArrival(appt._id, appt.arrived)}
                                                        className={`rounded-xl px-4 py-1.5 transition-all text-xs font-semibold ${
                                                            appt.arrived 
                                                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700" 
                                                            : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 hover:text-cyan-800"
                                                        }`}
                                                    >
                                                        {updatingId === appt._id ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                                                        ) : appt.arrived ? (
                                                            "Mark Absent"
                                                        ) : (
                                                            "Mark Arrived"
                                                        )}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
