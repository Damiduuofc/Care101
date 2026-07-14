"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DoorOpen, Save, Clock, CheckCircle2, AlertTriangle, X, Pencil, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

// ─── Types & Interfaces ───────────────────────────────────────────────────────
type ToastType = "success" | "warning" | "error";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface Nurse {
    _id: string;
    name: string;
    role: string;
}

interface Doctor {
    _id: string;
    name: string;
    specialization: string;
    profileImage?: string;
    allocatedRoom: string;
    allocatedNurse: string;
    scheduleId?: string;
    timeSlot?: string | null;
    startTime?: string; // Required for overlap math
    endTime?: string;   // Required for overlap math
}

// ─── Optimized Toast System ───────────────────────────────────────────────────
function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white transition-all duration-300 pointer-events-auto
                        ${t.type === "success" ? "bg-green-600" : t.type === "warning" ? "bg-amber-600" : "bg-red-600"}`}
                >
                    {t.type === "success" && <CheckCircle2 className="h-4 w-4" />}
                    {t.type === "warning" && <AlertTriangle className="h-4 w-4" />}
                    {t.type === "error" && <X className="h-4 w-4" />}
                    {t.message}
                </div>
            ))}
        </div>
    );
}

function useToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const show = useCallback((message: string, type: ToastType = "success") => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
    }, []);

    const remove = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, show, remove };
}

// ─── Child Component: Allocation Card ─────────────────────────────────────────
function AllocationCard({ 
    doctor, 
    allDoctors, 
    nurses, 
    showToast,
    onLocalUpdate 
}: { 
    doctor: Doctor; 
    allDoctors: Doctor[];
    nurses: Nurse[]; 
    showToast: (msg: string, type?: ToastType) => void;
    onLocalUpdate: (id: string, field: "allocatedRoom" | "allocatedNurse", value: string) => void;
}) {
    // UI state (keeps rendering fast by localizing button loaders)
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    
    // Auto-lock if data exists from DB
    const [isEditing, setIsEditing] = useState(!(doctor.allocatedRoom || doctor.allocatedNurse));
    const isSaved = !isEditing && (Boolean(doctor.allocatedRoom) || Boolean(doctor.allocatedNurse));

    // ─── OVERLAP DETECTION LOGIC ───
    const isRoomDoubleBooked = (roomName: string) => {
        return allDoctors.some(otherDoc => {
            // Ignore self
            if (otherDoc._id === doctor._id) return false;
            
            // Ignore if the other doctor isn't using this room
            if (otherDoc.allocatedRoom !== roomName) return false;

            // If either schedule is missing strict times, err on the side of caution and block the room
            if (!doctor.startTime || !otherDoc.startTime || !doctor.endTime || !otherDoc.endTime) return true;

            const startA = new Date(doctor.startTime).getTime();
            const endA = new Date(doctor.endTime).getTime();
            const startB = new Date(otherDoc.startTime).getTime();
            const endB = new Date(otherDoc.endTime).getTime();

            // Time Overlap Formula: (Start A < End B) AND (End A > Start B)
            return startA < endB && endA > startB;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${doctor._id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                },
                body: JSON.stringify({ 
                    allocatedRoom: doctor.allocatedRoom, 
                    allocatedNurse: doctor.allocatedNurse 
                })
            });

            if (!res.ok) throw new Error("Save failed");

            setIsEditing(false);
            showToast("Allocation saved", "success");
        } catch {
            showToast("Failed to save allocation", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFreeRoom = () => {
        setIsConfirming(false);
        onLocalUpdate(doctor._id, "allocatedRoom", "");
        onLocalUpdate(doctor._id, "allocatedNurse", "");
        setIsEditing(true);
        showToast("Room freed", "warning");
    };

    return (
        <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center gap-4">
                <div className="h-12 w-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500 overflow-hidden flex-shrink-0">
                    {doctor.profileImage ? (
                        <img src={doctor.profileImage} alt={doctor.name} className="w-full h-full object-cover" />
                    ) : (
                        doctor.name.charAt(0)
                    )}
                </div>
                <div>
                    <CardTitle className="text-lg text-slate-800">{doctor.name}</CardTitle>
                    <CardDescription className="text-sm font-medium">{doctor.specialization}</CardDescription>
                    {doctor.timeSlot && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-[#06b6d4] font-bold">
                            <Clock className="h-3 w-3" />
                            {doctor.timeSlot}
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
                {isSaved && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                        <div className="flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Allocation saved — fields locked
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1 text-green-700 hover:text-green-900 font-semibold underline underline-offset-2"
                        >
                            <Pencil className="h-3 w-3" /> Edit
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                            <DoorOpen className="h-4 w-4" /> Room Number
                        </label>
                        <select
                            disabled={!isEditing || isSaving}
                            className={`w-full h-10 px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors
                                ${!isEditing || isSaving ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200"}`}
                            value={doctor.allocatedRoom}
                            onChange={e => onLocalUpdate(doctor._id, "allocatedRoom", e.target.value)}
                        >
                            <option value="">Select Room</option>
                            {Array.from({ length: 20 }, (_, i) => i + 1).map(num => {
                                const roomName = `Room ${num}`;
                                const isBooked = isRoomDoubleBooked(roomName);
                                
                                return (
                                    <option 
                                        key={num} 
                                        value={roomName} 
                                        disabled={isBooked}
                                        className={isBooked ? "text-slate-300" : ""}
                                    >
                                        {roomName} {isBooked ? "(Unavailable)" : ""}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Assigned Nurse</label>
                        <select
                            disabled={!isEditing || isSaving}
                            className={`w-full h-10 px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors
                                ${!isEditing || isSaving ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200"}`}
                            value={doctor.allocatedNurse}
                            onChange={e => onLocalUpdate(doctor._id, "allocatedNurse", e.target.value)}
                        >
                            <option value="">Select Nurse</option>
                            {nurses.map(n => (
                                <option key={n._id} value={n.name}>{n.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || isSaved}
                        className={`flex-1 text-white transition-colors ${
                            isSaved ? "bg-green-600 hover:bg-green-600 cursor-default" : "bg-blue-600 hover:bg-blue-700"
                        }`}
                    >
                        {isSaving ? (
                            <Loader2 className="animate-spin h-4 w-4" />
                        ) : isSaved ? (
                            <><CheckCircle2 className="mr-2 h-4 w-4" /> Saved</>
                        ) : (
                            <><Save className="mr-2 h-4 w-4" /> Save Allocation</>
                        )}
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => setIsConfirming(true)}
                        disabled={isSaving || isConfirming}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                        End Session & Free Room
                    </Button>
                </div>

                {isConfirming && (
                    <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium">End session and free this room?</span>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsConfirming(false)}
                                className="h-7 px-3 text-xs border-red-200 text-red-600 hover:bg-red-100"
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleFreeRoom}
                                className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                            >
                                Yes, free it
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RoomAllocation() {
    const router = useRouter();
    const { toasts, show: showToast, remove: removeToast } = useToast();

    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [nurses, setNurses] = useState<Nurse[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        const storedUser = getAdminUser();
        if (!storedUser || storedUser.role !== "receptionist") {
            clearAdminSession();
            router.push("/admin/dashboard");
        }
    }, [router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = getAdminToken() || "";
                const headers = { "x-auth-token": token, "ngrok-skip-browser-warning": "true" };
                const baseUrl = process.env.NEXT_PUBLIC_API_URL;

                const [resSchedules, resDoctors, resStaff] = await Promise.all([
                    fetch(`${baseUrl}/schedule-requests/approved/today`, { headers }).catch(() => null),
                    fetch(`${baseUrl}/admin/doctors`, { headers }).catch(() => null),
                    fetch(`${baseUrl}/admin/staff`, { headers }).catch(() => null)
                ]);

                const schedules = resSchedules?.ok ? await resSchedules.json() : [];
                const allDoctors = resDoctors?.ok ? await resDoctors.json() : [];
                const allStaff = resStaff?.ok ? await resStaff.json() : [];

                const formattedDoctors: Doctor[] = allDoctors.map((doc: any) => {
                    const sched = schedules.find((s: any) => s.doctorId === doc._id);
                    return {
                        _id: doc._id,
                        name: doc.name,
                        specialization: doc.specialization,
                        profileImage: doc.profileImage,
                        allocatedRoom: sched?.allocatedRoom || doc.allocatedRoom || "",
                        allocatedNurse: sched?.allocatedNurse || doc.allocatedNurse || "",
                        scheduleId: sched?._id,
                        startTime: sched?.startTime, // Stored raw for math
                        endTime: sched?.endTime,     // Stored raw for math
                        timeSlot: sched
                            ? `${new Date(sched.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(sched.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : null,
                    };
                });

                setDoctors(formattedDoctors);
                setNurses(Array.isArray(allStaff) ? allStaff.filter(s => s.role === "nurse") : []);
            } catch (err) {
                console.error("Fetch Data Error:", err);
                showToast("Failed to load data", "error");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [showToast]);

    // Lifted state handler: keeps the global doctor array updated as the user selects rooms
    // This allows the overlap logic to calculate conflicts in real-time before saving
    const handleUpdateAllocation = (id: string, field: "allocatedRoom" | "allocatedNurse", value: string) => {
        setDoctors(prev => prev.map(doc => 
            doc._id === id ? { ...doc, [field]: value } : doc
        ));
    };

    const filteredDoctors = doctors.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        doc.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.allocatedRoom && doc.allocatedRoom.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.allocatedNurse && doc.allocatedNurse.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="p-10 flex justify-center items-center min-h-screen">
                <Loader2 className="animate-spin text-cyan-600 h-8 w-8" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />

            <div>
                <h1 className="text-3xl font-bold text-slate-900">Room Allocation</h1>
                <p className="text-slate-500">Allocate exam rooms and staff nurses for available doctors.</p>
            </div>

            <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search doctors, specialization, room or nurse..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors bg-white shadow-sm"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredDoctors.map(doc => (
                    <AllocationCard 
                        key={doc._id} 
                        doctor={doc} 
                        allDoctors={doctors} 
                        nurses={nurses} 
                        showToast={showToast} 
                        onLocalUpdate={handleUpdateAllocation}
                    />
                ))}
            </div>

            <ToastContainer toasts={toasts} remove={removeToast} />
        </div>
    );
}
