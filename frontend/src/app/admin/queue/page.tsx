"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Ensure you have this UI component
import { Loader2, Play, Square, Users, Plus, Minus, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";
import { io } from "socket.io-client";

export default function NurseQueueDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        const storedUser = getAdminUser();
        if (storedUser) {
            if (storedUser.role !== "nurse") {
                router.push("/admin/dashboard");
                return;
            }
            setUser(storedUser);
        } else {
            clearAdminSession();
            router.push("/admin/login");
            return;
        }
    }, [router]);

    const fetchData = async () => {
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
                if (Array.isArray(docData)) {
                    setDoctors(docData);
                }
            }

            // 2. Fetch Appointments
            const apptRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });

            if (apptRes.ok) {
                const apptData = await apptRes.json();
                if (Array.isArray(apptData)) {
                    setAppointments(apptData);
                }
            }
        } catch (err) {
            console.error("Fetch Data Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
        let socketUrl = apiUrl;
        try {
            const urlObj = new URL(apiUrl);
            socketUrl = urlObj.origin;
        } catch (e) {
            console.error("Invalid API URL for socket:", e);
        }
        
        const socket = io(socketUrl);

        socket.on("connect", () => {
            console.log("🔌 Connected to Socket.IO Server");
        });

        socket.on("doctorStatusUpdated", (updatedDoc: any) => {
            setDoctors(prev => prev.map(d => d._id === updatedDoc._id ? updatedDoc : d));
        });

        socket.on("disconnect", () => {
            console.log("🔌 Disconnected from Socket.IO Server");
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    const getMaxQueueNumber = (doctorDocId: string) => {
        const doctorTodayAppts = appointments.filter(appt => {
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            return apptDocId === doctorDocId && isToday(appt.date) && appt.status !== 'cancelled';
        });

        const maxQ = doctorTodayAppts.reduce((max, appt) => {
            const qNum = appt.queueNumber || 0;
            return qNum > max ? qNum : max;
        }, doctorTodayAppts.length);

        return maxQ;
    };

    const handleUpdateDoctor = async (doc: any, updates: any) => {
        setSaving({ ...saving, [doc._id]: true });
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${doc._id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify(updates)
            });

            if (res.ok) {
                const updatedDoc = await res.json();
                setDoctors(prev => prev.map(d => d._id === updatedDoc._id ? updatedDoc : d));
            }
        } catch (err) {
            console.error("Failed to update doctor", err);
        } finally {
            setSaving({ ...saving, [doc._id]: false });
        }
    };

    if (loading || !user) {
        return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600 h-8 w-8" /></div>;
    }

    const assignedDoctors = doctors.filter(doc => doc.allocatedNurse === user.name);

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Nurse OPD Queue</h1>
                    <p className="text-slate-500 mt-1">Manage doctor sessions and update patient queue numbers.</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Nurse: {user.name}
                </div>
            </div>

            {assignedDoctors.length === 0 ? (
                <Card className="bg-slate-50 border-dashed border-2 text-center p-12">
                    <CardContent>
                        <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-700">No Doctors Assigned</h2>
                        <p className="text-slate-500 mt-2">No doctors are assigned to you currently.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {assignedDoctors.map(doc => (
                        <Card key={doc._id} className="border-slate-200 overflow-hidden shadow-sm transition-all">
                            <div className={`h-2 w-full ${doc.sessionStarted ? "bg-emerald-500" : "bg-slate-300"}`}></div>
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                                        {doc.profileImage ? <img src={doc.profileImage} alt="" className="w-full h-full object-cover" /> : doc.name.charAt(0)}
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl text-slate-800 font-bold">{doc.name}</CardTitle>
                                        <CardDescription className="text-sm font-semibold text-slate-500">
                                            {doc.specialization} • Room: {doc.allocatedRoom || "Unassigned"}
                                        </CardDescription>
                                    </div>
                                </div>

                                <div className="text-right flex flex-col items-end gap-2">
                                    {!doc.isArrived ? (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex gap-1">
                                            <AlertCircle className="h-3.5 w-3.5" /> Doctor Not Arrived
                                        </Badge>
                                    ) : doc.sessionStarted ? (
                                        <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-200 animate-pulse">
                                            Session Active
                                        </div>
                                    ) : (
                                        <div className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-sm font-bold border border-slate-200">
                                            Ready to Start
                                        </div>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="flex-1 w-full border-r-0 md:border-r border-slate-200 pr-0 md:pr-8 space-y-4 text-center md:text-left">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Session Control</h3>

                                    {doc.sessionStarted ? (
                                        <Button
                                            onClick={() => handleUpdateDoctor(doc, { sessionStarted: false, currentQueueNumber: 0 })}
                                            disabled={saving[doc._id]}
                                            variant="destructive"
                                            className="w-full md:w-auto font-bold h-12 px-6"
                                        >
                                            {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : <><Square className="mr-2 h-5 w-5" /> End Session</>}
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            <Button
                                                onClick={() => handleUpdateDoctor(doc, { sessionStarted: true, currentQueueNumber: 1 })}
                                                disabled={saving[doc._id] || !doc.isArrived}
                                                className={`w-full md:w-auto font-bold h-12 px-8 shadow-md ${!doc.isArrived ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                                            >
                                                {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : <><Play className="mr-2 h-5 w-5 fill-white" /> Start Session</>}
                                            </Button>
                                            {!doc.isArrived && (
                                                <p className="text-[11px] text-amber-600 font-bold italic">Waiting for receptionist confirmation...</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Queue Counter */}
                                <div className="flex-1 w-full pl-0 md:pl-4 text-center">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Current Patient Queue</h3>

                                    <div className={`inline-flex items-center gap-6 p-4 rounded-3xl ${doc.sessionStarted ? 'bg-slate-50 border border-slate-200' : 'opacity-40 pointer-events-none'}`}>
                                        <Button
                                            onClick={() => handleUpdateDoctor(doc, { currentQueueNumber: Math.max(0, (doc.currentQueueNumber || 0) - 1) })}
                                            variant="outline"
                                            size="icon"
                                            className="h-14 w-14 rounded-full border-2 border-slate-200 hover:bg-slate-100"
                                            disabled={!doc.sessionStarted || saving[doc._id]}
                                        >
                                            <Minus className="h-6 w-6 text-slate-600" />
                                        </Button>

                                        <div className="w-24 text-center">
                                            <span className="text-6xl font-black text-slate-800 tracking-tighter">
                                                {doc.currentQueueNumber || 0}
                                            </span>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                const maxQ = getMaxQueueNumber(doc._id);
                                                const nextQ = (doc.currentQueueNumber || 0) + 1;
                                                if (nextQ <= maxQ) {
                                                    handleUpdateDoctor(doc, { currentQueueNumber: nextQ });
                                                }
                                            }}
                                            className="h-14 w-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200"
                                            size="icon"
                                            disabled={!doc.sessionStarted || saving[doc._id] || (doc.currentQueueNumber || 0) >= getMaxQueueNumber(doc._id)}
                                        >
                                            <Plus className="h-6 w-6" />
                                        </Button>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-400 mt-4">Update Number for Next Patient (Max: {getMaxQueueNumber(doc._id)})</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}