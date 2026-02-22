"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DoorOpen, Save } from "lucide-react";

import { useRouter } from "next/navigation";

export default function RoomAllocation() {
    const router = useRouter();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [nurses, setNurses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        const storedUser = localStorage.getItem("adminUser");
        if (!storedUser || JSON.parse(storedUser).role !== "receptionist") {
            router.push("/admin/dashboard");
        }
    }, [router]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("adminToken");

            // 1. Fetch Doctors
            const resDoctors = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (resDoctors.ok) {
                const contentType = resDoctors.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const dataDoc = await resDoctors.json();
                    setDoctors(Array.isArray(dataDoc) ? dataDoc : []);
                }
            }

            // 2. Fetch Nurses
            const resStaff = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/staff`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (resStaff.ok) {
                const contentType = resStaff.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const dataStaff = await resStaff.json();
                    if (Array.isArray(dataStaff)) {
                        setNurses(dataStaff.filter((s: any) => s.role === "nurse"));
                    }
                }
            }
        } catch (err) {
            console.error("Fetch Data Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpdate = (id: string, field: string, value: string) => {
        setDoctors(prev => prev.map(d => d._id === id ? { ...d, [field]: value } : d));
    };

    const saveAllocation = async (doc: any) => {
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
                    allocatedRoom: doc.allocatedRoom,
                    allocatedNurse: doc.allocatedNurse
                })
            });
            alert("Room Allocation Saved successfully!");
        } catch (err) {
            console.error("Failed to save allocation", err);
            alert("Failed to save allocation");
        } finally {
            setSaving({ ...saving, [doc._id]: false });
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600" /></div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Room Allocation</h1>
                <p className="text-slate-500">Allocate exam rooms and staff nurses for available doctors.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {doctors.map(doc => (
                    <Card key={doc._id} className="border-slate-200">
                        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center gap-4">
                            <div className="h-12 w-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                                {doc.profileImage ? <img src={doc.profileImage} alt="" className="w-full h-full object-cover" /> : doc.name.charAt(0)}
                            </div>
                            <div>
                                <CardTitle className="text-lg text-slate-800">{doc.name}</CardTitle>
                                <CardDescription className="text-sm font-medium">{doc.specialization}</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                                        <DoorOpen className="h-4 w-4" /> Room Number
                                    </label>
                                    <select
                                        className="w-full h-10 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                                        value={doc.allocatedRoom || ""}
                                        onChange={e => handleUpdate(doc._id, "allocatedRoom", e.target.value)}
                                    >
                                        <option value="">Select Room</option>
                                        {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                            <option key={num} value={`Room ${num}`}>
                                                Room {num}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Assigned Nurse</label>
                                    <select
                                        className="w-full h-10 px-3 py-2 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                                        value={doc.allocatedNurse || ""}
                                        onChange={e => handleUpdate(doc._id, "allocatedNurse", e.target.value)}
                                    >
                                        <option value="">Select Nurse</option>
                                        {nurses.map(nurse => (
                                            <option key={nurse._id} value={nurse.name}>
                                                {nurse.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => saveAllocation(doc)}
                                    disabled={saving[doc._id]}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5" /> : <><Save className="mr-2 h-4 w-4" /> Save Allocation</>}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleUpdate(doc._id, "allocatedRoom", "")}
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                    End Session & Free Room
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
