"use client";

import { useEffect, useState, useCallback } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, DoorOpen, Save, Clock, CheckCircle2, AlertTriangle, X, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

// ─── Toast ────────────────────────────────────────────────────────────────────
type ToastType = "success" | "warning" | "error";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

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
    let counter = 0;

    const show = useCallback((message: string, type: ToastType = "success") => {
        const id = Date.now() + counter++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
    }, []);

    const remove = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, show, remove };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RoomAllocation() {
    const router = useRouter();
    const { toasts, show: showToast, remove: removeToast } = useToast();

    const [doctors, setDoctors] = useState<any[]>([]);
    const [nurses, setNurses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Per-doctor state maps
    const [saving, setSaving] = useState<{ [id: string]: boolean }>({});
    const [saved, setSaved] = useState<{ [id: string]: boolean }>({});
    const [editing, setEditing] = useState<{ [id: string]: boolean }>({});
    const [confirming, setConfirming] = useState<{ [id: string]: boolean }>({});

    useEffect(() => {
        const storedUser = getAdminUser();
        if (!storedUser || storedUser.role !== "receptionist") {
            clearAdminSession();
            router.push("/admin/dashboard");
            return;
        }
    }, [router]);

    const fetchData = async () => {
        try {
            const token = getAdminToken();

            const resSchedules = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/schedule-requests/approved/today`, {
                headers: { "x-auth-token": token || "", "ngrok-skip-browser-warning": "true" }
            });
            const schedules = resSchedules.ok ? await resSchedules.json() : [];

            const resDoctors = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: { "x-auth-token": token || "", "ngrok-skip-browser-warning": "true" }
            });

            if (resDoctors.ok) {
                const allDoctors = await resDoctors.json();
                const doctorsWithSchedules = allDoctors.map((doc: any) => {
                    const sched = schedules.find((s: any) => s.doctorId === doc._id);
                    return {
                        ...doc,
                        allocatedRoom: sched?.allocatedRoom || doc.allocatedRoom || "",
                        allocatedNurse: sched?.allocatedNurse || doc.allocatedNurse || "",
                        scheduleId: sched?._id,
                        timeSlot: sched
                            ? `${new Date(sched.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(sched.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : null,
                    };
                });
                setDoctors(doctorsWithSchedules);
                // Mark all as initially "saved" (loaded state = clean)
                const initSaved: { [id: string]: boolean } = {};
                const initEditing: { [id: string]: boolean } = {};
                doctorsWithSchedules.forEach((d: any) => {
                    initSaved[d._id] = true;
                    initEditing[d._id] = false;
                });
                setSaved(initSaved);
                setEditing(initEditing);
            }

            const resStaff = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/staff`, {
                headers: { "x-auth-token": token || "", "ngrok-skip-browser-warning": "true" }
            });
            if (resStaff.ok) {
                const dataStaff = await resStaff.json();
                if (Array.isArray(dataStaff)) {
                    setNurses(dataStaff.filter((s: any) => s.role === "nurse"));
                }
            }
        } catch (err) {
            console.error("Fetch Data Error:", err);
            showToast("Failed to load data", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Mark dirty when a field changes
    const handleUpdate = (id: string, field: string, value: string) => {
        setSaved(prev => ({ ...prev, [id]: false }));
        setEditing(prev => ({ ...prev, [id]: true }));
        setDoctors(prev => prev.map(d => d._id === id ? { ...d, [field]: value } : d));
    };

    const saveAllocation = async (doc: any) => {
        setSaving(prev => ({ ...prev, [doc._id]: true }));
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${doc._id}/status`, {
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

            if (!res.ok) throw new Error("Save failed");

            setSaved(prev => ({ ...prev, [doc._id]: true }));
            setEditing(prev => ({ ...prev, [doc._id]: false }));
            showToast("Allocation saved", "success");
        } catch {
            showToast("Failed to save allocation", "error");
        } finally {
            setSaving(prev => ({ ...prev, [doc._id]: false }));
        }
    };

    const requestFreeRoom = (id: string) => {
        setConfirming(prev => ({ ...prev, [id]: true }));
    };

    const cancelFreeRoom = (id: string) => {
        setConfirming(prev => ({ ...prev, [id]: false }));
    };

    const confirmFreeRoom = (id: string) => {
        setConfirming(prev => ({ ...prev, [id]: false }));
        setSaved(prev => ({ ...prev, [id]: false }));
        setEditing(prev => ({ ...prev, [id]: true }));
        setDoctors(prev => prev.map(d => d._id === id ? { ...d, allocatedRoom: "", allocatedNurse: "" } : d));
        showToast("Room freed", "warning");
    };

    if (loading) return (
        <div className="p-10 flex justify-center">
            <Loader2 className="animate-spin text-cyan-600" />
        </div>
    );

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />

            <div>
                <h1 className="text-3xl font-bold text-slate-900">Room Allocation</h1>
                <p className="text-slate-500">Allocate exam rooms and staff nurses for available doctors.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {doctors.map(doc => {
                    const isSaving = saving[doc._id];
                    const isSaved = saved[doc._id];
                    const isEditing = editing[doc._id];
                    const isConfirming = confirming[doc._id];
                    const isLocked = isSaved && !isEditing;

                    return (
                        <Card key={doc._id} className="border-slate-200">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center gap-4">
                                <div className="h-12 w-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500 overflow-hidden flex-shrink-0">
                                    {doc.profileImage
                                        ? <img src={doc.profileImage} alt="" className="w-full h-full object-cover" />
                                        : doc.name.charAt(0)}
                                </div>
                                <div>
                                    <CardTitle className="text-lg text-slate-800">{doc.name}</CardTitle>
                                    <CardDescription className="text-sm font-medium">{doc.specialization}</CardDescription>
                                    {doc.timeSlot && (
                                        <div className="flex items-center gap-1 mt-1 text-xs text-[#06b6d4] font-bold">
                                            <Clock className="h-3 w-3" />
                                            {doc.timeSlot}
                                        </div>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="p-6 space-y-4">
                                {/* Locked banner */}
                                {isLocked && (
                                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                                        <div className="flex items-center gap-1.5 font-medium">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Allocation saved — fields locked
                                        </div>
                                        <button
                                            onClick={() => setEditing(prev => ({ ...prev, [doc._id]: true }))}
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
                                            disabled={isLocked || isSaving}
                                            className={`w-full h-10 px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors
                                                ${isLocked || isSaving
                                                    ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                                                    : "bg-white border-slate-200"}`}
                                            value={doc.allocatedRoom || ""}
                                            onChange={e => handleUpdate(doc._id, "allocatedRoom", e.target.value)}
                                        >
                                            <option value="">Select Room</option>
                                            {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                                <option key={num} value={`Room ${num}`}>Room {num}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Assigned Nurse</label>
                                        <select
                                            disabled={isLocked || isSaving}
                                            className={`w-full h-10 px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors
                                                ${isLocked || isSaving
                                                    ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                                                    : "bg-white border-slate-200"}`}
                                            value={doc.allocatedNurse || ""}
                                            onChange={e => handleUpdate(doc._id, "allocatedNurse", e.target.value)}
                                        >
                                            <option value="">Select Nurse</option>
                                            {nurses.map(nurse => (
                                                <option key={nurse._id} value={nurse.name}>{nurse.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => saveAllocation(doc)}
                                        disabled={isSaving || (isSaved === true)}
                                        className={`flex-1 text-white transition-colors ${
                                            isSaved
                                                ? "bg-green-600 hover:bg-green-600 cursor-default"
                                                : "bg-blue-600 hover:bg-blue-700"
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
                                        onClick={() => requestFreeRoom(doc._id)}
                                        disabled={isSaving || isConfirming}
                                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                    >
                                        End Session & Free Room
                                    </Button>
                                </div>

                                {/* Inline confirm bar — replaces browser confirm() */}
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
                                                onClick={() => cancelFreeRoom(doc._id)}
                                                className="h-7 px-3 text-xs border-red-200 text-red-600 hover:bg-red-100"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => confirmFreeRoom(doc._id)}
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
                })}
            </div>

            <ToastContainer toasts={toasts} remove={removeToast} />
        </div>
    );
}
