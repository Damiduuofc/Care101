"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    UserCheck, Loader2, Search, 
    CircleOff, Users, Bell, BellRing, 
    AlertTriangle, Clock, Volume2, VolumeX, 
    DoorOpen, Calendar, CheckCircle2, X, Sparkles
} from "lucide-react";
import { 
    Dialog, DialogContent, DialogHeader, 
    DialogTitle, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";
import { io, Socket } from "socket.io-client";

interface DelayAlert {
    id: string;
    doctorId: string;
    doctorName: string;
    specialization?: string;
    status: string;
    previousStatus?: string;
    allocatedNurse?: string;
    allocatedRoom?: string;
    channelingTime?: string;
    timestamp: string | Date;
    read?: boolean;
}

export default function NurseDoctorArrivals() {
    const router = useRouter();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    // Delay Notification & Alert Popup States
    const [activeModalAlert, setActiveModalAlert] = useState<DelayAlert | null>(null);
    const [notifications, setNotifications] = useState<DelayAlert[]>([]);
    const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [highlightedDoctorId, setHighlightedDoctorId] = useState<string | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Audio chime player using Web Audio API
    const playAlertChime = () => {
        if (!soundEnabled || typeof window === "undefined") return;
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            // Note 1 (D5 - 587.33Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0.18, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.35);

            // Note 2 (A5 - 880Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(880, now + 0.15);
            gain2.gain.setValueAtTime(0.22, now + 0.15);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.15);
            osc2.stop(now + 0.6);
        } catch (e) {
            console.warn("Audio chime prevented or unsupported:", e);
        }
    };

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
        fetchDoctors();
    }, [router]);

    // Close notifications dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowNotificationsDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Socket.IO real-time listener for Doctor Delay & Arrival updates
    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
        let socketUrl = apiUrl;
        try {
            const urlObj = new URL(apiUrl);
            socketUrl = urlObj.origin;
        } catch (e) {
            console.error("Invalid API URL for socket:", e);
        }

        const socket: Socket = io(socketUrl);

        socket.on("connect", () => {
            console.log("🔌 Connected to Socket.IO Server (Doctor Arrivals)");
        });

        // Live Doctor Status Update (Arrival / Channeling status)
        socket.on("doctorStatusUpdated", (updatedDoc: any) => {
            setDoctors(prev => prev.map(d => d._id === updatedDoc._id ? { ...d, ...updatedDoc } : d));
        });

        // Live Doctor Delay Alert pushed by doctor
        socket.on("doctorDelayAlert", (alertData: any) => {
            console.log("🚨 Received doctor delay alert:", alertData);

            const newAlert: DelayAlert = {
                id: `${alertData.doctorId}-${Date.now()}`,
                doctorId: alertData.doctorId,
                doctorName: alertData.doctorName || "Doctor",
                specialization: alertData.specialization || "General",
                status: alertData.channelingStatus || alertData.status || "Delayed",
                previousStatus: alertData.previousStatus,
                allocatedNurse: alertData.allocatedNurse,
                allocatedRoom: alertData.allocatedRoom,
                channelingTime: alertData.channelingTime,
                timestamp: alertData.timestamp || new Date(),
                read: false
            };

            // Prepend alert to notification list
            setNotifications(prev => [newAlert, ...prev]);

            // Open Alert Popup Modal immediately
            setActiveModalAlert(newAlert);

            // Play notification chime
            playAlertChime();

            // Also update doctor status in the local state
            setDoctors(prev => prev.map(d => {
                if (d._id === alertData.doctorId) {
                    return {
                        ...d,
                        channelingStatus: alertData.channelingStatus || alertData.status,
                        allocatedNurse: alertData.allocatedNurse || d.allocatedNurse,
                        allocatedRoom: alertData.allocatedRoom || d.allocatedRoom
                    };
                }
                return d;
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, [soundEnabled]);

    const fetchDoctors = async () => {
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setDoctors(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        setUpdatingId(id);
        const newStatus = !currentStatus;
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify({ isArrived: newStatus })
            });

            if (res.ok) {
                setDoctors(prev => prev.map(doc => 
                    doc._id === id ? { ...doc, isArrived: newStatus } : doc
                ));
            }
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setUpdatingId(null);
        }
    };

    const assignedDoctorsCount = doctors.filter(d => d.allocatedNurse === user?.name).length;
    const arrivedCount = doctors.filter(d => d.allocatedNurse === user?.name && d.isArrived).length;

    // Filter doctors assigned to this nurse and search
    const filteredDoctors = doctors.filter(doc => {
        const matchesNurse = doc.allocatedNurse === user?.name;
        const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              doc.specialization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              (doc.allocatedRoom && doc.allocatedRoom.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesNurse && matchesSearch;
    });

    // Detect delayed doctors
    const delayedDoctors = doctors.filter(doc => 
        doc.allocatedNurse === user?.name &&
        doc.channelingStatus && 
        doc.channelingStatus !== "On Time"
    );

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllNotificationsAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleLocateDoctor = (doctorId: string) => {
        setActiveModalAlert(null);
        setShowNotificationsDropdown(false);
        setHighlightedDoctorId(doctorId);

        setTimeout(() => {
            const el = document.getElementById(`doctor-card-${doctorId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 100);

        setTimeout(() => {
            setHighlightedDoctorId(null);
        }, 3000);
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 transition-all">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Doctor Arrivals</h1>
                        </div>
                        <p className="text-slate-500 text-sm">Manage daily attendance and receive real-time doctor delay alerts.</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Sound Toggle */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            title={soundEnabled ? "Mute notification sounds" : "Unmute notification sounds"}
                            className="bg-white border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm rounded-xl h-10 px-3"
                        >
                            {soundEnabled ? (
                                <Volume2 className="h-4 w-4 text-cyan-600" />
                            ) : (
                                <VolumeX className="h-4 w-4 text-slate-400" />
                            )}
                        </Button>

                        {/* Notification Bell with Dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowNotificationsDropdown(!showNotificationsDropdown);
                                    if (!showNotificationsDropdown) markAllNotificationsAsRead();
                                }}
                                className="relative bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm rounded-xl h-10 px-3 flex items-center gap-2"
                            >
                                {unreadCount > 0 ? (
                                    <BellRing className="h-4 w-4 text-amber-500 animate-bounce" />
                                ) : (
                                    <Bell className="h-4 w-4 text-slate-500" />
                                )}
                                <span className="text-xs font-semibold hidden sm:inline">Alerts</span>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                        {unreadCount}
                                    </span>
                                )}
                            </Button>

                            {/* Dropdown Menu */}
                            {showNotificationsDropdown && (
                                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in-50 zoom-in-95">
                                    <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                                            <span className="font-bold text-sm text-slate-800">Doctor Delay Alerts</span>
                                        </div>
                                        {notifications.length > 0 && (
                                            <button 
                                                onClick={() => setNotifications([])}
                                                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center text-slate-400">
                                                <Clock className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                                <p className="text-xs font-medium">No delay notifications received yet</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">When doctors push delays, they will appear here</p>
                                            </div>
                                        ) : (
                                            notifications.map((n) => (
                                                <div 
                                                    key={n.id}
                                                    onClick={() => handleLocateDoctor(n.doctorId)}
                                                    className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer text-left"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-800">{n.doctorName}</p>
                                                            <p className="text-xs text-slate-500">{n.specialization || "General"}</p>
                                                        </div>
                                                        <Badge className={`text-[11px] font-bold ${
                                                            n.status === "On Time" 
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                                        }`}>
                                                            {n.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                                        <span>{n.allocatedRoom ? `Room ${n.allocatedRoom}` : "Room TBD"}</span>
                                                        <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Status Card */}
                        <Card className="px-4 py-2 flex items-center gap-3 bg-white shadow-sm border-slate-200">
                            <Users className="text-cyan-600 h-5 w-5" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Attendance</p>
                                <p className="text-sm font-bold text-slate-700">{arrivedCount} / {assignedDoctorsCount} Present</p>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Active Delays Alert Banner */}
                {delayedDoctors.length > 0 && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl flex items-center gap-3 shadow-sm">
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-center shrink-0">
                            <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-amber-900">
                                {delayedDoctors.length} {delayedDoctors.length === 1 ? "Doctor is" : "Doctors are"} currently delayed
                            </h4>
                            <p className="text-xs text-amber-700 mt-0.5">
                                {delayedDoctors.map(d => `${d.name} (${d.channelingStatus})`).join(" • ")}
                            </p>
                        </div>
                    </div>
                )}

                {/* Search Filter */}
                <div className="relative mb-6 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Search by doctor name, specialty, room..." 
                        className="pl-10 bg-white border-slate-200 focus-visible:ring-cyan-500 shadow-sm rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                        <p className="text-sm font-medium">Loading medical staff...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredDoctors.map(doc => {
                            const isDelayed = doc.channelingStatus && doc.channelingStatus !== "On Time";
                            const isHighlighted = highlightedDoctorId === doc._id;

                            return (
                                <Card 
                                    id={`doctor-card-${doc._id}`}
                                    key={doc._id} 
                                    className={`group transition-all duration-300 border-slate-200 hover:border-cyan-200 shadow-sm relative overflow-hidden ${
                                        isHighlighted ? 'ring-4 ring-amber-400 ring-offset-2 scale-[1.02]' : ''
                                    } ${doc.isArrived ? 'bg-white' : 'bg-slate-50/50'}`}
                                >
                                    {/* Delay indicator bar */}
                                    {isDelayed && (
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
                                    )}

                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4">
                                            {/* Avatar */}
                                            <div className="relative">
                                                <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                    {doc.profileImage ? (
                                                        <img src={doc.profileImage} alt={doc.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-xl font-bold text-slate-400">{doc.name.charAt(0)}</span>
                                                    )}
                                                </div>
                                                {doc.isArrived && (
                                                    <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-1">
                                                    <h3 className="font-bold text-slate-800 truncate">{doc.name}</h3>
                                                </div>
                                                <p className="text-xs font-medium text-cyan-600 uppercase tracking-wider">{doc.specialization || "General"}</p>
                                                
                                                {/* Status Badges: Delay Status & Arrival */}
                                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                                    {/* Channeling / Delay status badge */}
                                                    {doc.channelingStatus && (
                                                        <Badge 
                                                            variant="outline" 
                                                            className={`text-[11px] font-bold flex items-center gap-1 ${
                                                                isDelayed
                                                                    ? "bg-amber-50 text-amber-700 border-amber-300 animate-pulse"
                                                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                            }`}
                                                        >
                                                            {isDelayed ? (
                                                                <Clock className="h-3 w-3 text-amber-600" />
                                                            ) : (
                                                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                                            )}
                                                            {doc.channelingStatus}
                                                        </Badge>
                                                    )}

                                                    {/* Attendance status */}
                                                    <Badge variant="secondary" className={doc.isArrived ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500"}>
                                                        {doc.isArrived ? "Present" : "Away"}
                                                    </Badge>
                                                </div>

                                                {/* Room & Time Details */}
                                                <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-3">
                                                    <span className="flex items-center gap-1">
                                                        <DoorOpen className="h-3 w-3 text-slate-400" />
                                                        {doc.allocatedRoom ? `Room ${doc.allocatedRoom}` : "No Room"}
                                                    </span>
                                                    {doc.channelingTime && (
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="h-3 w-3 text-slate-400" />
                                                            {doc.channelingTime}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Action Button */}
                                                <div className="mt-4 flex items-center justify-end">
                                                    <Button
                                                        size="sm"
                                                        disabled={updatingId === doc._id}
                                                        onClick={() => toggleStatus(doc._id, doc.isArrived)}
                                                        className={`rounded-xl px-4 transition-all ${
                                                            doc.isArrived 
                                                            ? "bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 shadow-none border border-rose-100" 
                                                            : "bg-cyan-600 text-white hover:bg-cyan-700 shadow-md shadow-cyan-100"
                                                        }`}
                                                    >
                                                        {updatingId === doc._id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : doc.isArrived ? (
                                                            <>Mark Away</>
                                                        ) : (
                                                            <>Check In</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredDoctors.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <CircleOff className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">No doctors found</h3>
                        <p className="text-slate-500 text-sm mt-1">Try adjusting your search query.</p>
                    </div>
                )}

                {/* DOCTOR DELAY ALERT POPUP (MODAL) */}
                <Dialog open={!!activeModalAlert} onOpenChange={(open) => { if (!open) setActiveModalAlert(null); }}>
                    <DialogContent className="sm:max-w-[480px] rounded-2xl p-6 bg-white border border-slate-100 shadow-2xl">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <Clock className="w-6 h-6 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <DialogTitle className="text-xl font-bold text-slate-900">Doctor Delay Alert</DialogTitle>
                                <DialogDescription className="text-sm text-slate-500 mt-0.5">
                                    Clinic schedule update received from doctor
                                </DialogDescription>
                            </div>
                        </div>

                        {activeModalAlert && (
                            <div className="space-y-4 mt-2">
                                {/* Doctor Card */}
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Doctor Details</p>
                                        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs px-2.5 py-0.5">
                                            {activeModalAlert.status}
                                        </Badge>
                                    </div>
                                    <p className="text-base font-bold text-slate-800 mt-1">{activeModalAlert.doctorName}</p>
                                    <p className="text-xs text-cyan-600 font-semibold uppercase">{activeModalAlert.specialization || "General Practitioner"}</p>
                                    
                                    <div className="mt-3 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs text-slate-600">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Room</span>
                                            <span className="font-semibold text-slate-700">{activeModalAlert.allocatedRoom ? `Room ${activeModalAlert.allocatedRoom}` : "TBD"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Clinic Time</span>
                                            <span className="font-semibold text-slate-700">{activeModalAlert.channelingTime || "Scheduled Today"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Delay Status Info */}
                                <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-xl flex items-center justify-between text-xs text-amber-800">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                        <span>Status updated to <strong className="font-bold text-amber-900">{activeModalAlert.status}</strong></span>
                                    </div>
                                    {activeModalAlert.previousStatus && (
                                        <span className="text-[11px] text-amber-600/80">was {activeModalAlert.previousStatus}</span>
                                    )}
                                </div>

                                {/* Nurse note */}
                                {activeModalAlert.allocatedNurse && (
                                    <div className="flex items-center gap-2 p-2.5 bg-cyan-50 border border-cyan-100 rounded-xl text-xs font-semibold text-cyan-800">
                                        <UserCheck className="h-4 w-4 text-cyan-600 shrink-0" />
                                        <span>Assigned Nurse: <strong className="font-bold">{activeModalAlert.allocatedNurse}</strong></span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <Button 
                                        variant="outline" 
                                        className="flex-1 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                                        onClick={() => setActiveModalAlert(null)}
                                    >
                                        Dismiss
                                    </Button>
                                    <Button 
                                        className="flex-1 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-100 font-semibold"
                                        onClick={() => handleLocateDoctor(activeModalAlert.doctorId)}
                                    >
                                        Locate Doctor
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
