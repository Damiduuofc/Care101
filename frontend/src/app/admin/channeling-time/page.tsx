"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, CalendarDays, Activity } from "lucide-react";

import { useRouter } from "next/navigation";

export default function ChannelingTime() {
    const router = useRouter();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        const storedUser = localStorage.getItem("adminUser");
        if (!storedUser || JSON.parse(storedUser).role !== "receptionist") {
            router.push("/admin/dashboard");
        }
    }, [router]);

    const fetchDoctors = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (!res.ok) {
                console.error(`Server Error: ${res.status}`);
                return;
            }

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                console.error("Expected JSON but got:", contentType, text);
                return;
            }

            const data = await res.json();
            if (Array.isArray(data)) {
                setDoctors(data);
            } else {
                setDoctors([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    const handleUpdate = (id: string, field: string, value: string) => {
        setDoctors(prev => prev.map(d => d._id === id ? { ...d, [field]: value } : d));
    };

    const saveChannelingStatus = async (doc: any) => {
        setSaving({ ...saving, [doc._id]: true });
        try {
            const token = localStorage.getItem("adminToken");
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${doc._id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                },
                body: JSON.stringify({
                    channelingTime: doc.channelingTime,
                    channelingStatus: doc.channelingStatus
                })
            });
            alert(`Schedule updated for Dr. ${doc.name}`);
        } catch (err) {
            console.error("Failed to save schedule", err);
        } finally {
            setSaving({ ...saving, [doc._id]: false });
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600" /></div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Channeling Time & Queue</h1>
                <p className="text-slate-500">Update doctor channeling schedules, delays, and session status.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {doctors.map(doc => (
                    <Card key={doc._id} className="border-slate-200 shadow-sm relative overflow-hidden">
                        {/* Edge Color Indicator */}
                        <div className={`absolute top-0 left-0 h-full w-1.5 ${doc.channelingStatus === "Delayed" ? "bg-amber-500" :
                            doc.channelingStatus === "Cancelled" ? "bg-red-500" : "bg-emerald-500"
                            }`}></div>

                        <CardContent className="p-6">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-400 overflow-hidden shrink-0">
                                    {doc.profileImage ? <img src={doc.profileImage} alt="" className="h-full w-full object-cover" /> : doc.name.charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-slate-800 text-lg">{doc.name}</h3>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                        <CalendarDays className="h-3 w-3" /> {doc.specialization}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" /> Channeling Time
                                    </label>
                                    <Input
                                        type="time"
                                        value={doc.channelingTime || ""}
                                        onChange={e => handleUpdate(doc._id, "channelingTime", e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                        <Activity className="h-3.5 w-3.5" /> Session Status
                                    </label>
                                    <Select
                                        value={doc.channelingStatus || "On Time"}
                                        onValueChange={(val) => handleUpdate(doc._id, "channelingStatus", val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="On Time">On Time</SelectItem>
                                            <SelectItem value="Delayed">Delayed</SelectItem>
                                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button
                                onClick={() => saveChannelingStatus(doc)}
                                disabled={saving[doc._id]}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center justify-center"
                            >
                                {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5" /> : "Save Schedule"}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
