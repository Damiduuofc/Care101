"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
    Loader2, Clock, CalendarDays, Check, User, ChevronDown, Search, X, AlertTriangle, Trash2 
} from "lucide-react";
import { getAdminToken } from "@/lib/adminSession";
import HourTimeline, { TimelineSlot, HourRange } from "@/components/admin/HourTimeline";
import { 
    Dialog, 
    DialogTrigger, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ChannelingRequestPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
const [doctorSearchQuery, setDoctorSearchQuery] = useState("");




    // Form fields for direct scheduling
    const [doctorsList, setDoctorsList] = useState<any[]>([]);
    const [fetchingDoctors, setFetchingDoctors] = useState(true);
    const [selectedDoctorId, setSelectedDoctorId] = useState("");
    const [scheduleDate, setScheduleDate] = useState("");
    const [timelineSlots, setTimelineSlots] = useState<TimelineSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [sessionRange, setSessionRange] = useState<HourRange>(null);
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [queueLimit, setQueueLimit] = useState("20");
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Searchable dropdown states and refs
    const [searchQuery, setSearchQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchRequests();
        fetchDoctors();
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (!isDialogOpen) {
            setSearchQuery("");
            setIsOpen(false);
        }
    }, [isDialogOpen]);

    // Load the free/blocked hours whenever the doctor or date changes
    useEffect(() => {
        setSessionRange(null);
        setTimelineSlots([]);
        if (!selectedDoctorId || !scheduleDate) return;

        let cancelled = false;
        const loadAvailability = async () => {
            setLoadingSlots(true);
            try {
                const token = getAdminToken() || "";
                const response = await fetch(
                    `${API_URL}/schedule-requests/availability?date=${scheduleDate}&doctorId=${selectedDoctorId}`,
                    {
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "x-auth-token": token,
                            "ngrok-skip-browser-warning": "true"
                        }
                    }
                );
                if (response.ok && !cancelled) {
                    const data = await response.json();
                    setTimelineSlots(data.timeline || []);
                }
            } catch (error) {
                console.error("Fetch Availability Error:", error);
            } finally {
                if (!cancelled) setLoadingSlots(false);
            }
        };
        loadAvailability();
        return () => { cancelled = true; };
    }, [selectedDoctorId, scheduleDate]);

    const scheduleDates = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Array.from({ length: 30 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            return d;
        });
    }, []);

    const toDateKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const hourLabel = (h: number) => {
        const period = h >= 12 && h < 24 ? "PM" : "AM";
        const display = h % 12 === 0 ? 12 : h % 12;
        return `${display}:00 ${period}`;
    };

    const queueNumber = parseInt(queueLimit, 10);
    const queueValid = isUnlimited || (Number.isFinite(queueNumber) && queueNumber >= 1);
    const rangeValid = !!sessionRange && timelineSlots
        .filter(s => s.hour >= sessionRange.start && s.hour <= sessionRange.end)
        .every(s => s.isAvailable);
    const canCreate = !!selectedDoctorId && !!scheduleDate && rangeValid && queueValid && !formSubmitting;
    const createLabel = !selectedDoctorId
        ? "Choose a doctor"
        : !scheduleDate
            ? "Choose a date"
            : !sessionRange
                ? "Choose the hours"
                : !queueValid
                    ? "Set patient limit"
                    : "Create & approve session";

    const fetchDoctors = async () => {
        try {
            const token = getAdminToken() || "";
            const response = await fetch(`${API_URL}/admin/doctors`, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "x-auth-token": token,
                    "ngrok-skip-browser-warning": "true" 
                }
            });
            if (response.ok) {
                const data = await response.json();
                setDoctorsList(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Fetch Doctors Error:", error);
        } finally {
            setFetchingDoctors(false);
        }
    };

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!canCreate || !sessionRange) return;

        const baseDate = new Date(`${scheduleDate}T00:00:00`);
        const startDateTime = new Date(baseDate);
        startDateTime.setHours(sessionRange.start, 0, 0, 0);
        const endDateTime = new Date(baseDate);
        endDateTime.setHours(sessionRange.end + 1, 0, 0, 0);

        setFormSubmitting(true);
        try {
            const token = getAdminToken();
            const response = await fetch(`${API_URL}/schedule-requests/admin/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || ""
                },
                body: JSON.stringify({
                    doctorId: selectedDoctorId,
                    date: scheduleDate,
                    startTime: startDateTime.toISOString(),
                    endTime: endDateTime.toISOString(),
                    isUnlimited,
                    queueLimit: isUnlimited ? null : queueNumber
                })
            });

            if (response.ok) {
                const data = await response.json();
                const room = data.request?.allocatedRoom;
                const nurse = data.request?.allocatedNurse;
                alert(
                    room && nurse
                        ? `Session approved. Room: ${room}, Nurse: ${nurse}.`
                        : "Session approved, but no free room or nurse was found for this time. Please assign one in Room Allocation."
                );
                setSelectedDoctorId("");
                setScheduleDate("");
                setSessionRange(null);
                setIsUnlimited(false);
                setQueueLimit("20");
                setIsDialogOpen(false);
                fetchRequests();
            } else {
                const data = await response.json();
                alert(data.msg || "Failed to create schedule.");
            }
        } catch (error) {
            console.error("Submit Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            setFormSubmitting(false);
        }
    };

    const fetchRequests = async () => {
        try {
            const token = getAdminToken() || "";
            const response = await fetch(`${API_URL}/schedule-requests/all`, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "x-auth-token": token,
                    "ngrok-skip-browser-warning": "true" 
                }
            });
            if (response.ok) {
                const data = await response.json();
                setRequests(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id: string, newStatus: "approved" | "rejected" | "cancelled") => {
        if (newStatus === "cancelled") {
            const confirmed = window.confirm(
                "Are you sure you want to cancel this schedule? Any booked appointments will be cancelled and allocated room/nurse resources will be released."
            );
            if (!confirmed) return;
        }

        setLoadingAction(id);
        try {
            const token = getAdminToken() || "";
            const response = await fetch(`${API_URL}/schedule-requests/${id}/status`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-auth-token": token
                },
                body: JSON.stringify({ status: newStatus }) 
            });
            
            if (response.ok) {
                const data = await response.json();
                // Room and nurse are auto-assigned by the server on approval
                if (newStatus === "approved" && (!data.request?.allocatedRoom || !data.request?.allocatedNurse)) {
                    alert("Approved, but no free room or nurse was found for this time. Please assign one in Room Allocation.");
                }
                setRequests(prev => 
                    prev.map(req => req._id === id ? { 
                        ...req, 
                        status: newStatus,
                        allocatedRoom: data.request?.allocatedRoom ?? "",
                        allocatedNurse: data.request?.allocatedNurse ?? ""
                    } : req)
                );
            } else {
                const errData = await response.json();
                alert(errData.msg || "Failed to update status");
            }
        } catch (error) {
            console.error("Action Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            setLoadingAction(null);
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = window.confirm(
            "Are you sure you want to permanently delete this schedule request? Any booked appointments will be cancelled and resources will be released."
        );
        if (!confirmed) return;

        setLoadingAction(id);
        try {
            const token = getAdminToken() || "";
            const response = await fetch(`${API_URL}/schedule-requests/${id}`, {
                method: "DELETE",
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "x-auth-token": token
                }
            });

            if (response.ok) {
                const data = await response.json();
                setRequests(prev => prev.filter(req => req._id !== id));
                if (data.cancelledAppointmentsCount > 0) {
                    alert(`Schedule deleted successfully. ${data.cancelledAppointmentsCount} associated booked appointment(s) were cancelled.`);
                }
            } else {
                const errData = await response.json();
                alert(errData.msg || "Failed to delete schedule");
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            setLoadingAction(null);
        }
    };

    const pendingRequests = requests.filter(r => r.status === "pending");
    const historyRequests = requests.filter(r => r.status !== "pending");
 
  const filteredRequests = pendingRequests.filter((req: any) => {
  const query = doctorSearchQuery.toLowerCase().trim();
  const doctorName = req.doctorName || req.doctorId?.fullName || req.doctor?.name || req.name || "";
  return doctorName.toLowerCase().includes(query);
});
  
const filteredHistoryRequests = historyRequests.filter((req: any) => {
  const query = doctorSearchQuery.toLowerCase().trim();
  const doctorName = req.doctorName || req.doctorId?.fullName || req.doctor?.name || req.name || "";
  return doctorName.toLowerCase().includes(query);
});


    const filteredDoctors = doctorsList.filter((doc) => {
        const name = (doc.name || doc.fullName || "").toLowerCase();
        const spec = (doc.specialization || "").toLowerCase();
        const query = searchQuery.toLowerCase();
        return name.includes(query) || spec.includes(query);
    });

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
        });
    };

    const formatTime = (timeStr: string) => {
        return new Date(timeStr).toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit"
        });
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 space-y-6">
                
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Schedule Approvals</h1>
                        <p className="text-slate-500">Manage medical staff time slot requests.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white border-none px-4 py-1 shrink-0">
                            {pendingRequests.length} Pending
                        </Badge>
                        
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button 
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-sm rounded-xl h-9 px-4 shadow-md flex items-center gap-1.5 shrink-0"
                                >
                                    <span className="text-base font-bold leading-none">+</span> Schedule Doctor
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl sm:rounded-2xl border-slate-200 shadow-xl bg-white p-0 overflow-hidden max-h-[92vh] flex flex-col">
                                <DialogHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
                                    <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-cyan-600" />
                                        Schedule a Doctor
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-500 text-xs mt-1">
                                        Pick a doctor and a date, then click the free hours.
                                    </DialogDescription>
                                </DialogHeader>

                                <form onSubmit={handleCreateSchedule} className="flex-1 min-h-0 flex flex-col">
                                <div className="flex-1 min-h-0 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-5">
                                        
{/* 1. Doctor Selection */}
<div>
  <label className="block text-xs font-semibold text-slate-700 mb-1">
    1. Doctor
  </label>
  <div className="relative" ref={dropdownRef}>

                                                <button
                                                    type="button"
                                                    onClick={() => setIsOpen(!isOpen)}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all shadow-sm flex items-center justify-between text-left"
                                                >
                                                    <span className={selectedDoctorId ? "text-slate-800" : "text-slate-400"}>
                                                        {selectedDoctorId 
                                                            ? (() => {
                                                                const doc = doctorsList.find(d => d._id === selectedDoctorId);
                                                                return doc ? `${doc.name || doc.fullName} (${doc.specialization})` : "Choose a doctor...";
                                                              })()
                                                            : "Choose a doctor..."
                                                        }
                                                    </span>
                                                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                                </button>
                                                
                                                {isOpen && (
                                                     <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-60 animate-in fade-in-50 slide-in-from-top-2 duration-150">
                                                        <div className="relative flex items-center border-b border-slate-100 p-2 bg-slate-50/50">
                                                            <Search className="absolute left-4 h-3.5 w-3.5 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                placeholder="Search doctor or specialization..."
                                                                value={searchQuery}
                                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800 placeholder-slate-400"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto flex-1 py-1 max-h-48">
                                                            {fetchingDoctors ? (
                                                                <div className="px-3 py-3 text-xs text-slate-400 flex items-center justify-center gap-2">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" />
                                                                    Loading doctors...
                                                                </div>
                                                            ) : filteredDoctors.length === 0 ? (
                                                                <div className="px-3 py-3 text-xs text-slate-400 text-center">
                                                                    No doctors found.
                                                                    </div>
                                                            ) : (
                                                                filteredDoctors.map((doc) => {
                                                                    const isSelected = selectedDoctorId === doc._id;
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            key={doc._id}
                                                                            onClick={() => {
                                                                                setSelectedDoctorId(doc._id);
                                                                                setIsOpen(false);
                                                                                setSearchQuery("");
                                                                            }}
                                                                            className={`w-full text-left px-4 py-2 text-xs flex items-center justify-between transition-colors ${
                                                                                isSelected 
                                                                                    ? "bg-cyan-50 text-cyan-700 font-semibold" 
                                                                                    : "text-slate-700 hover:bg-slate-50"
                                                                            }`}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="font-medium text-slate-900">{doc.name || doc.fullName}</span>
                                                                                <span className="text-[10px] text-slate-400">{doc.specialization}</span>
                                                                            </div>
                                                                            {isSelected && <Check className="h-3.5 w-3.5 text-cyan-600" />}
                                                                        </button>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Date */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="block text-xs font-semibold text-slate-700">2. Date</label>
                                                <input
                                                    type="date"
                                                    value={scheduleDate}
                                                    min={toDateKey(new Date())}
                                                    onChange={(e) => setScheduleDate(e.target.value)}
                                                    aria-label="Pick any date"
                                                    className="text-[11px] text-slate-500 bg-transparent border-none focus:outline-none cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                                                {scheduleDates.map((d) => {
                                                    const key = toDateKey(d);
                                                    const selected = key === scheduleDate;
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={key}
                                                            onClick={() => setScheduleDate(key)}
                                                            aria-pressed={selected}
                                                            className={`shrink-0 w-14 py-2 rounded-xl border text-center transition-colors ${
                                                                selected
                                                                    ? "bg-cyan-600 border-cyan-600 text-white"
                                                                    : "bg-white border-slate-200 text-slate-800 hover:border-cyan-400"
                                                            }`}
                                                        >
                                                            <span className={`block text-[10px] font-semibold ${selected ? "text-white" : "text-slate-500"}`}>
                                                                {d.toLocaleDateString("en-US", { weekday: "short" })}
                                                            </span>
                                                            <span className="block text-lg font-bold leading-tight">{d.getDate()}</span>
                                                            <span className={`block text-[9px] font-semibold ${selected ? "text-white" : "text-slate-400"}`}>
                                                                {d.toLocaleDateString("en-US", { month: "short" })}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* From / To — filled from the timeline */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: "From", value: sessionRange ? hourLabel(sessionRange.start) : null },
                                                { label: "To", value: sessionRange ? hourLabel(sessionRange.end + 1) : null },
                                            ].map((f) => (
                                                <div
                                                    key={f.label}
                                                    className={`rounded-xl border px-4 py-2.5 ${f.value ? "border-cyan-500 bg-cyan-50/60" : "border-slate-200 bg-white"}`}
                                                >
                                                    <p className="text-[11px] font-semibold text-slate-500">{f.label}</p>
                                                    <p className={`text-base font-bold ${f.value ? "text-slate-900" : "text-slate-300"}`}>{f.value || "--:--"}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* 4. Patients */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">4. Patients</label>
                                            <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1">
                                                {[{ label: "Set a limit", value: false }, { label: "Unlimited", value: true }].map((opt) => (
                                                    <button
                                                        type="button"
                                                        key={opt.label}
                                                        onClick={() => setIsUnlimited(opt.value)}
                                                        aria-pressed={isUnlimited === opt.value}
                                                        className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                            isUnlimited === opt.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                            {!isUnlimited && (
                                                <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                                                    <button
                                                        type="button"
                                                        aria-label="Fewer patients"
                                                        onClick={() => setQueueLimit(String(Math.max(1, (Number.isFinite(queueNumber) ? queueNumber : 0) - 1)))}
                                                        className="h-10 w-10 rounded-lg bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200"
                                                    >
                                                        −
                                                    </button>
                                                    <div className="flex-1 text-center">
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={queueLimit}
                                                            onChange={(e) => setQueueLimit(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                                                            aria-label="Maximum patients"
                                                            className="w-16 text-center text-xl font-bold text-slate-900 bg-transparent focus:outline-none"
                                                        />
                                                        <p className="text-[11px] text-slate-500">max patients</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label="More patients"
                                                        onClick={() => setQueueLimit(String((Number.isFinite(queueNumber) ? queueNumber : 0) + 1))}
                                                        className="h-10 w-10 rounded-lg bg-slate-100 text-lg font-bold text-slate-700 hover:bg-slate-200"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Hours */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="block text-xs font-semibold text-slate-700">3. Hours</label>
                                            {sessionRange && (
                                                <button type="button" onClick={() => setSessionRange(null)} className="text-xs font-semibold text-cyan-600 hover:underline">
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 mb-3">
                                            {sessionRange ? "Click another free hour to change the end." : "Click a start hour, then an end hour."}
                                        </p>
                                        <div className="rounded-2xl border border-slate-200 p-4 pt-5 min-h-[200px]">
                                            {!selectedDoctorId || !scheduleDate ? (
                                                <p className="text-xs text-slate-400 text-center py-16">
                                                    {!selectedDoctorId ? "Choose a doctor first." : "Choose a date first."}
                                                </p>
                                            ) : loadingSlots ? (
                                                <div className="flex justify-center py-16">
                                                    <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
                                                </div>
                                            ) : timelineSlots.length > 0 && timelineSlots.every(s => !s.isAvailable) ? (
                                                <div className="text-center py-14">
                                                    <p className="text-sm font-bold text-red-600">No free hours</p>
                                                    <p className="text-xs text-slate-500 mt-1">Please choose another date.</p>
                                                </div>
                                            ) : (
                                                <HourTimeline slots={timelineSlots} range={sessionRange} onChange={setSessionRange} />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Submit */}
                                <div className="border-t border-slate-100 p-4 bg-slate-50/50">
                                    <Button
                                        type="submit"
                                        disabled={!canCreate}
                                        className="w-full text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 text-sm font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2"
                                    >
                                        {formSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin text-white" />
                                                Creating...
                                            </>
                                        ) : createLabel}
                                    </Button>
                                </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </header>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="animate-spin text-cyan-500" size={40} />
                    </div>
                ) : (
                    <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="bg-slate-200/50 p-1 mb-8">
                            <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:text-cyan-600">
                                New Requests
                            </TabsTrigger>
                            <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-cyan-600">
                                Actioned History
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="pending" className="space-y-4 outline-none">
                           <div className="relative w-full sm:w-72 mb-4 mt-2">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
    <Input
      type="text"
      placeholder="Search history by doctor..."
      value={doctorSearchQuery}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDoctorSearchQuery(e.target.value)}
      className="pl-9 w-full border-slate-200 focus-visible:ring-cyan-500 bg-white text-xs h-9"
    />
  </div>

 {filteredRequests.length === 0 ? (
  <EmptyState message="No pending requests found." />
) : (
  filteredRequests.map(req => (
                                    <RequestCard 
                                        key={req._id} 
                                        req={req} 
                                        onAction={handleAction} 
                                        onDelete={handleDelete}
                                        loadingId={loadingAction} 
                                        formatDate={formatDate}
                                        formatTime={formatTime}
                                    />
                                ))
                            )}
                        </TabsContent>


                       <TabsContent value="history" className="space-y-4 outline-none">
  <div className="relative w-full sm:w-72 mb-4 mt-2">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
    <Input
      type="text"
      placeholder="Search history by doctor..."
      value={doctorSearchQuery}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDoctorSearchQuery(e.target.value)}
      className="pl-9 w-full border-slate-200 focus-visible:ring-cyan-500 bg-white text-xs h-9"
    />
  </div>

  {filteredHistoryRequests.length === 0 ? (
    <EmptyState message="History is empty." />
  ) : (
    filteredHistoryRequests.map((req: any) => (
      <RequestCard
        key={req._id}
        req={req}
        isHistory
        onAction={handleAction}
        onDelete={handleDelete}
        loadingId={loadingAction}
        formatDate={formatDate}
        formatTime={formatTime}
      />
    ))
  )}
  
                        </TabsContent>
                    </Tabs>
                )}
            </main>
        </div>     
    );
}

// --- SUB COMPONENTS ---


function RequestCard({ req, onAction, onDelete, loadingId, isHistory, formatDate, formatTime }: any) {
    const isLoading = loadingId === req._id;

    const getStatusBadge = (status: string) => {
        if (status === "approved") {
            return "bg-emerald-100 text-emerald-700";
        }
        if (status === "cancelled") {
            return "bg-amber-100 text-amber-700";
        }
        return "bg-rose-100 text-rose-700";
    };

    return (
        <Card className={`group border-slate-200 shadow-sm overflow-hidden transition-all duration-300 ${isHistory ? 'bg-slate-50/50' : 'hover:shadow-md hover:border-cyan-500/30 bg-white'}`}>
            <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    
                    {/* 1. Doctor Profile */}
                    <div className="flex items-center gap-4 w-full lg:w-1/3">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isHistory ? 'bg-slate-200 text-slate-500' : 'bg-cyan-50 text-cyan-600'}`}>
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 leading-tight">{req.doctorName}</h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{req.specialization || "Medical Staff"}</p>
                        </div>
                    </div>

                    {/* 2. Timing */}
                    <div className="flex flex-wrap items-center gap-5 w-full lg:w-auto">
                        <div className="flex items-center gap-2 text-slate-600">
                            <CalendarDays size={18} className="text-cyan-600" />
                            <span className="text-sm font-medium">{formatDate(req.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <Clock size={18} className="text-cyan-600" />
                            <span className="text-sm font-medium">{formatTime(req.startTime)}</span>
                        </div>
                        <Badge variant="outline" className="border-slate-200 text-slate-500 font-bold">
                            {req.isUnlimited ? "∞ Unlimited" : `${req.queueLimit || 0} Slots`}
                        </Badge>
                        {req.status === "approved" && (
                            <span className={`text-xs font-semibold ${req.allocatedRoom && req.allocatedNurse ? "text-cyan-700" : "text-amber-600"}`}>
                                {req.allocatedRoom || "No room"} · {req.allocatedNurse || "No nurse"}
                            </span>
                        )}
                    </div>

                    {/* 3. Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        {isHistory ? (
                            <div className="flex items-center gap-2">
                                <Badge className={`${getStatusBadge(req.status)} border-none px-3 py-1 uppercase text-[10px]`}>
                                    {req.status}
                                </Badge>
                                {req.status === "approved" && (
                                    <Button 
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onAction(req._id, "cancelled")}
                                        disabled={isLoading}
                                        className="text-[10px] h-7 px-2 border-slate-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100 rounded-lg font-bold"
                                    >
                                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : "Cancel Slot"}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <>
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => onAction(req._id, "rejected")}
                                    className="text-slate-400 hover:text-rose-500"
                                    disabled={isLoading}
                                >
                                    Reject
                                </Button>
                                <Button 
                                    size="sm"
                                    onClick={() => onAction(req._id, "approved")}
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[90px]"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Approve"}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="py-20 flex flex-col items-center justify-center bg-white border border-dashed rounded-2xl border-slate-200">
            <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
                <Check size={24} />
            </div>
            <p className="text-slate-400 font-medium text-sm">{message}</p>
        </div>
    );
}
