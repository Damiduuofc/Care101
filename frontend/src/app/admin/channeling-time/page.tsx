"use client";

import { confirmDialog } from "@/lib/confirmDialog";
import { notify } from "@/lib/notify";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { Skeleton } from "@/components/ui/skeleton";
import { TextSkeleton, CardGridSkeleton } from "@/components/ui/skeleton-presets";
import { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
    Loader2, Clock, CalendarDays, Check, User, ChevronDown, Search, X, AlertTriangle, Trash2, Building2 
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
import { DatePicker } from "@/components/ui/date-picker";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

    // Free hours per day for the chosen doctor's department (shown on the date chips)
    const [daySummary, setDaySummary] = useState<Record<string, { freeHours: number; totalHours: number }>>({});
    const [summaryDept, setSummaryDept] = useState("");
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [summaryVersion, setSummaryVersion] = useState(0);

    // Department full → schedule in a room of any department, picked by hand
    const [outsideMode, setOutsideMode] = useState(false);
    const [outRoom, setOutRoom] = useState("");
    const [outNurse, setOutNurse] = useState("");
    const [freeRes, setFreeRes] = useState<{ rooms: FreeRoom[]; nurses: FreeNurse[] }>({ rooms: [], nurses: [] });
    const [loadingRes, setLoadingRes] = useState(false);

    // Searchable dropdown states and refs
    const [searchQuery, setSearchQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchRequests();
        fetchDoctors();
    }, []);

    // Live: new session requests from doctors appear without a reload
    useLiveRefresh(() => fetchRequests());

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
        setOutsideMode(false);
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

    // Free-hour count per day for the next 30 days, once a doctor is chosen
    useEffect(() => {
        setDaySummary({});
        setSummaryDept("");
        if (!selectedDoctorId) return;
        let cancelled = false;
        setLoadingSummary(true);
        const token = getAdminToken() || "";
        fetch(`${API_URL}/schedule-requests/availability/summary?from=${toDateKey(new Date())}&days=30&doctorId=${selectedDoctorId}`, {
            headers: { "Authorization": `Bearer ${token}`, "x-auth-token": token, "ngrok-skip-browser-warning": "true" },
        })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (cancelled || !data) return;
                const map: Record<string, { freeHours: number; totalHours: number }> = {};
                (data.days || []).forEach((d: any) => { map[d.date] = d; });
                setDaySummary(map);
                setSummaryDept(data.department || "");
            })
            .catch(err => console.error("Fetch Summary Error:", err))
            .finally(() => { if (!cancelled) setLoadingSummary(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDoctorId, summaryVersion]);

    // Outside-department mode: load rooms (all departments) and nurses free for the chosen hours
    useEffect(() => {
        setOutRoom("");
        setOutNurse("");
        setFreeRes({ rooms: [], nurses: [] });
        if (!outsideMode || !sessionRange || !scheduleDate) return;
        let cancelled = false;
        const base = new Date(`${scheduleDate}T00:00:00`);
        const start = new Date(base); start.setHours(sessionRange.start, 0, 0, 0);
        const end = new Date(base); end.setHours(sessionRange.end + 1, 0, 0, 0);
        setLoadingRes(true);
        const token = getAdminToken() || "";
        fetch(`${API_URL}/schedule-requests/free-resources?doctorId=${selectedDoctorId}&startTime=${encodeURIComponent(start.toISOString())}&endTime=${encodeURIComponent(end.toISOString())}`, {
            headers: { "Authorization": `Bearer ${token}`, "x-auth-token": token, "ngrok-skip-browser-warning": "true" },
        })
            .then(r => (r.ok ? r.json() : Promise.reject(r)))
            .then(data => { if (!cancelled) setFreeRes({ rooms: data.rooms || [], nurses: data.nurses || [] }); })
            .catch(() => { if (!cancelled) notify("Could not load free rooms and nurses."); })
            .finally(() => { if (!cancelled) setLoadingRes(false); });
        return () => { cancelled = true; };
    }, [outsideMode, sessionRange, scheduleDate, selectedDoctorId]);

    const scheduleDates = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Array.from({ length: 30 }, (_, i) => {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            return d;
        });
    }, []);


    const hourLabel = (h: number) => {
        const period = h >= 12 && h < 24 ? "PM" : "AM";
        const display = h % 12 === 0 ? 12 : h % 12;
        return `${display}:00 ${period}`;
    };

    const queueNumber = parseInt(queueLimit, 10);
    const queueValid = isUnlimited || (Number.isFinite(queueNumber) && queueNumber >= 1);
    const dayIsFull = timelineSlots.length > 0 && timelineSlots.every(s => !s.isAvailable);
    // Outside-department mode: any hour that hasn't passed can be scheduled
    const activeSlots = outsideMode ? timelineSlots.map(s => ({ ...s, isAvailable: !s.isPast })) : timelineSlots;
    const rangeValid = !!sessionRange && activeSlots
        .filter(s => s.hour >= sessionRange.start && s.hour <= sessionRange.end)
        .every(s => s.isAvailable);
    const resourcesValid = !outsideMode || (!!outRoom && !!outNurse);
    const canCreate = !!selectedDoctorId && !!scheduleDate && rangeValid && queueValid && resourcesValid && !formSubmitting;
    const createLabel = !selectedDoctorId
        ? "Choose a doctor"
        : !scheduleDate
            ? "Choose a date"
            : !sessionRange
                ? "Choose the hours"
                : !queueValid
                    ? "Set patient limit"
                    : !resourcesValid
                        ? "Choose a room and nurse"
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
                    queueLimit: isUnlimited ? null : queueNumber,
                    ...(outsideMode ? { anyDepartment: true, allocatedRoom: outRoom, allocatedNurse: outNurse } : {})
                })
            });

            if (response.ok) {
                const data = await response.json();
                setOutsideMode(false);
                setSummaryVersion(v => v + 1);
                const room = data.request?.allocatedRoom;
                const nurse = data.request?.allocatedNurse;
                notify(
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
                notify(data.msg || "Failed to create schedule.");
            }
        } catch (error) {
            console.error("Submit Error:", error);
            notify("An error occurred. Please try again.");
        } finally {
            setFormSubmitting(false);
        }
    };

    // Pending requests load in full; the (very long) history loads a page at a time
    const HISTORY_PAGE = 50;
    const [pendingList, setPendingList] = useState<any[]>([]);
    const [historyList, setHistoryList] = useState<any[]>([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
    const historyLoadedRef = useRef(HISTORY_PAGE);
    const historyQueryRef = useRef("");

    const requestHeaders = () => {
        const token = getAdminToken() || "";
        return { "Authorization": `Bearer ${token}`, "x-auth-token": token, "ngrok-skip-browser-warning": "true" };
    };

    const fetchHistoryPage = async (skip: number, limit: number) => {
        const q = encodeURIComponent(historyQueryRef.current);
        const res = await fetch(`${API_URL}/schedule-requests/all?scope=history&skip=${skip}&limit=${limit}&q=${q}`, { headers: requestHeaders() });
        if (!res.ok) return null;
        return res.json() as Promise<{ items: any[]; total: number; hasMore: boolean }>;
    };

    // Reloads pending + as much history as is already on screen (so live refreshes don't collapse it)
    const fetchRequests = async () => {
        try {
            const [pendingRes, history] = await Promise.all([
                fetch(`${API_URL}/schedule-requests/all?scope=pending`, { headers: requestHeaders() }),
                fetchHistoryPage(0, historyLoadedRef.current),
            ]);
            if (pendingRes.ok) {
                const data = await pendingRes.json();
                setPendingList(Array.isArray(data) ? data : []);
            }
            if (history) {
                setHistoryList(history.items);
                setHistoryTotal(history.total);
            }
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadMoreHistory = async () => {
        setLoadingMoreHistory(true);
        try {
            const page = await fetchHistoryPage(historyList.length, HISTORY_PAGE);
            if (page) {
                setHistoryList(prev => [...prev, ...page.items]);
                setHistoryTotal(page.total);
                historyLoadedRef.current = historyList.length + page.items.length;
            }
        } finally {
            setLoadingMoreHistory(false);
        }
    };

    // Searching history asks the server (only one page is loaded at a time)
    useEffect(() => {
        const timer = setTimeout(() => {
            const q = doctorSearchQuery.trim();
            if (q === historyQueryRef.current) return;
            historyQueryRef.current = q;
            historyLoadedRef.current = HISTORY_PAGE;
            fetchHistoryPage(0, HISTORY_PAGE).then(page => {
                if (page) {
                    setHistoryList(page.items);
                    setHistoryTotal(page.total);
                }
            });
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctorSearchQuery]);

    useEffect(() => {
        setRequests([...pendingList, ...historyList]);
    }, [pendingList, historyList]);

    const handleAction = async (
        id: string,
        newStatus: "approved" | "rejected" | "cancelled",
        allocation?: { allocatedRoom: string; allocatedNurse: string }
    ) => {
        if (newStatus === "cancelled") {
            const confirmed = await confirmDialog(
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
                body: JSON.stringify({ status: newStatus, ...(allocation || {}) }) 
            });
            
            if (response.ok) {
                const data = await response.json();
                // Room and nurse are auto-assigned by the server on approval
                if (newStatus === "approved" && (!data.request?.allocatedRoom || !data.request?.allocatedNurse)) {
                    notify("Approved, but no free room or nurse was found for this time. Please assign one in Room Allocation.");
                }
                setRequests(prev => 
                    prev.map(req => req._id === id ? { 
                        ...req, 
                        status: newStatus,
                        allocatedRoom: data.request?.allocatedRoom ?? "",
                        allocatedNurse: data.request?.allocatedNurse ?? ""
                    } : req)
                );
                return true;
            } else {
                const errData = await response.json();
                notify(errData.msg || "Failed to update status");
            }
        } catch (error) {
            console.error("Action Error:", error);
            notify("An error occurred. Please try again.");
        } finally {
            setLoadingAction(null);
        }
        return false;
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirmDialog(
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
                    notify(`Schedule deleted successfully. ${data.cancelledAppointmentsCount} associated booked appointment(s) were cancelled.`);
                }
            } else {
                const errData = await response.json();
                notify(errData.msg || "Failed to delete schedule");
            }
        } catch (error) {
            console.error("Delete Error:", error);
            notify("An error occurred. Please try again.");
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
                                                                <TextSkeleton lines={4} className="px-3 py-3" />
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
                                                <DatePicker
                                                    value={scheduleDate}
                                                    min={toDateKey(new Date())}
                                                    onChange={setScheduleDate}
                                                    aria-label="Pick any date"
                                                    placeholder="Pick date"
                                                    align="end"
                                                    displayFormat="d MMM yyyy"
                                                    className="h-8 w-auto rounded-lg px-2.5 text-xs font-semibold text-cyan-700 border-cyan-200 bg-cyan-50/60 hover:bg-cyan-50"
                                                />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                                                {scheduleDates.map((d) => {
                                                    const key = toDateKey(d);
                                                    const selected = key === scheduleDate;
                                                    const info = daySummary[key];
                                                    const level = !info ? "unknown" : info.freeHours === 0 ? "full" : info.freeHours <= 4 ? "limited" : "free";
                                                    const levelClass = {
                                                        free: "bg-emerald-50 border-emerald-200",
                                                        limited: "bg-amber-50 border-amber-200",
                                                        full: "bg-rose-50 border-rose-200",
                                                        unknown: "bg-white border-slate-200",
                                                    }[level];
                                                    const subClass = {
                                                        free: "text-emerald-600",
                                                        limited: "text-amber-600",
                                                        full: "text-rose-600",
                                                        unknown: "text-slate-400",
                                                    }[level];
                                                    return (
                                                        <button
                                                            type="button"
                                                            key={key}
                                                            ref={selected ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }) : undefined}
                                                            onClick={() => setScheduleDate(key)}
                                                            aria-pressed={selected}
                                                            title={info ? (info.freeHours === 0 ? "Fully booked" : `${info.freeHours} free hours`) : undefined}
                                                            className={`shrink-0 w-14 py-2 rounded-xl border text-center transition-colors ${
                                                                selected
                                                                    ? "bg-cyan-600 border-cyan-600 text-white"
                                                                    : `${levelClass} text-slate-800 hover:border-cyan-400`
                                                            }`}
                                                        >
                                                            <span className={`block text-[10px] font-semibold ${selected ? "text-white" : "text-slate-500"}`}>
                                                                {d.toLocaleDateString("en-US", { weekday: "short" })}
                                                            </span>
                                                            <span className="block text-lg font-bold leading-tight">{d.getDate()}</span>
                                                            <span className={`block text-[9px] font-semibold ${selected ? "text-white" : "text-slate-400"}`}>
                                                                {d.toLocaleDateString("en-US", { month: "short" })}
                                                            </span>
                                                            {selectedDoctorId && (
                                                                <span className={`block text-[10px] font-bold mt-0.5 ${selected ? "text-white" : subClass}`}>
                                                                    {info ? (info.freeHours === 0 ? "Full" : `${info.freeHours}h`) : loadingSummary ? "·" : ""}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {selectedDoctorId && (
                                                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-slate-500">
                                                    {summaryDept && <span className="font-semibold text-slate-600">{summaryDept}:</span>}
                                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Free</span>
                                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Few hours</span>
                                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Full</span>
                                                </div>
                                            )}
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
                                            {sessionRange ? "Click another hour to change the end." : "Click a start hour, then an end hour."}
                                        </p>
                                        {outsideMode && (
                                            <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                                <Building2 size={16} className="shrink-0 mt-0.5" />
                                                <p className="flex-1">
                                                    <span className="font-bold">Another department.</span>{" "}
                                                    {summaryDept ? `${summaryDept} rooms are full. ` : ""}Pick the hours, then a free room from any department and a nurse.
                                                </p>
                                                <button type="button" onClick={() => { setOutsideMode(false); setSessionRange(null); }} className="font-semibold text-cyan-700 hover:underline">
                                                    Back
                                                </button>
                                            </div>
                                        )}
                                        <div className="rounded-2xl border border-slate-200 p-4 pt-5 min-h-[200px]">
                                            {!selectedDoctorId || !scheduleDate ? (
                                                <p className="text-xs text-slate-400 text-center py-16">
                                                    {!selectedDoctorId ? "Choose a doctor first." : "Choose a date first."}
                                                </p>
                                            ) : loadingSlots ? (
                                                <div className="grid grid-cols-4 gap-2 py-4">
                                                    {Array.from({ length: 12 }).map((_, i) => (
                                                        <Skeleton key={i} className="h-10 rounded-lg" />
                                                    ))}
                                                </div>
                                            ) : dayIsFull && !outsideMode ? (
                                                <div className="text-center py-10">
                                                    <p className="text-sm font-bold text-red-600">Fully booked</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        All {summaryDept || "department"} rooms are taken this day.
                                                    </p>
                                                    {timelineSlots.some(s => !s.isPast) && (
                                                        <Button
                                                            type="button"
                                                            onClick={() => { setOutsideMode(true); setSessionRange(null); }}
                                                            className="mt-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2"
                                                        >
                                                            <Building2 size={16} /> Use a room from another department
                                                        </Button>
                                                    )}
                                                    <p className="text-[11px] text-slate-400 mt-3">or pick another date</p>
                                                </div>
                                            ) : (
                                                <HourTimeline slots={activeSlots} range={sessionRange} onChange={setSessionRange} />
                                            )}
                                        </div>
                                        {outsideMode && sessionRange && (
                                            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
                                                <RoomNursePicker
                                                    loading={loadingRes}
                                                    rooms={freeRes.rooms}
                                                    nurses={freeRes.nurses}
                                                    room={outRoom}
                                                    nurse={outNurse}
                                                    onRoom={setOutRoom}
                                                    onNurse={setOutNurse}
                                                />
                                            </div>
                                        )}
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
                    <div className="space-y-6">
                        <div className="flex gap-2">
                            <Skeleton className="h-10 w-32 rounded-lg" />
                            <Skeleton className="h-10 w-32 rounded-lg" />
                        </div>
                        <CardGridSkeleton cards={6} />
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

  {historyList.length < historyTotal && (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-slate-400">Showing {historyList.length} of {historyTotal}</p>
      <Button variant="outline" onClick={loadMoreHistory} disabled={loadingMoreHistory} className="h-9 text-sm">
        {loadingMoreHistory ? "Loading..." : `Load ${Math.min(HISTORY_PAGE, historyTotal - historyList.length)} more`}
      </Button>
    </div>
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
    const isHospitalRequest = req.requestType === "hospital_contact";
    const [assignOpen, setAssignOpen] = useState(false);

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
                            {isHospitalRequest && (
                                <Badge className="mt-1.5 bg-amber-100 text-amber-800 border-none hover:bg-amber-100 text-[10px] font-bold gap-1">
                                    <Building2 size={12} /> Hospital request · dept. full
                                </Badge>
                            )}
                            {req.note && (
                                <p className="text-xs text-slate-500 mt-1 italic max-w-xs">&ldquo;{req.note}&rdquo;</p>
                            )}
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
                            <span className="text-sm font-medium">{formatTime(req.startTime)} – {formatTime(req.endTime)}</span>
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
                                {isHospitalRequest ? (
                                    <Button
                                        size="sm"
                                        onClick={() => setAssignOpen(true)}
                                        className="bg-amber-600 hover:bg-amber-700 text-white min-w-[90px]"
                                        disabled={isLoading}
                                    >
                                        Assign & Approve
                                    </Button>
                                ) : (
                                    <Button 
                                        size="sm"
                                        onClick={() => onAction(req._id, "approved")}
                                        className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[90px]"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Approve"}
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </CardContent>
            {isHospitalRequest && !isHistory && (
                <AssignResourcesDialog
                    open={assignOpen}
                    onOpenChange={setAssignOpen}
                    req={req}
                    saving={isLoading}
                    formatDate={formatDate}
                    formatTime={formatTime}
                    onConfirm={async (allocatedRoom: string, allocatedNurse: string) => {
                        const ok = await onAction(req._id, "approved", { allocatedRoom, allocatedNurse });
                        if (ok) setAssignOpen(false);
                    }}
                />
            )}
        </Card>
    );
}

type FreeRoom = { room: string; department: string; isDoctorDept: boolean; free: boolean };
type FreeNurse = { name: string; free: boolean };

// Reception picks a free room from ANY department plus a free nurse for a
// request the doctor sent while their own department was fully booked.
function AssignResourcesDialog({ open, onOpenChange, req, saving, onConfirm, formatDate, formatTime }: any) {
    const [rooms, setRooms] = useState<FreeRoom[]>([]);
    const [nurses, setNurses] = useState<FreeNurse[]>([]);
    const [loading, setLoading] = useState(false);
    const [room, setRoom] = useState("");
    const [nurse, setNurse] = useState("");

    useEffect(() => {
        if (!open) return;
        setRoom("");
        setNurse("");
        setLoading(true);
        const token = getAdminToken() || "";
        fetch(`${API_URL}/schedule-requests/${req._id}/free-resources`, {
            headers: { "Authorization": `Bearer ${token}`, "x-auth-token": token, "ngrok-skip-browser-warning": "true" },
        })
            .then(r => (r.ok ? r.json() : Promise.reject(r)))
            .then(data => {
                setRooms(data.rooms || []);
                setNurses(data.nurses || []);
            })
            .catch(() => notify("Could not load free rooms and nurses."))
            .finally(() => setLoading(false));
    }, [open, req._id]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl sm:rounded-2xl bg-white p-0 overflow-hidden max-h-[90vh] flex flex-col">
                <DialogHeader className="border-b border-slate-100 bg-amber-50/60 p-6">
                    <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-amber-600" />
                        Assign room & nurse
                    </DialogTitle>
                    <DialogDescription className="text-slate-600 text-xs mt-1">
                        {req.doctorName} · {formatDate(req.date)} · {formatTime(req.startTime)} – {formatTime(req.endTime)} ·{" "}
                        {req.isUnlimited ? "Unlimited queue" : `${req.queueLimit || 0} patients`}
                    </DialogDescription>
                    {req.note && <p className="text-xs text-slate-500 italic mt-2">Doctor&apos;s note: &ldquo;{req.note}&rdquo;</p>}
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                    <RoomNursePicker
                        loading={loading}
                        rooms={rooms}
                        nurses={nurses}
                        room={room}
                        nurse={nurse}
                        onRoom={setRoom}
                        onNurse={setNurse}
                    />
                </div>

                <div className="border-t border-slate-100 p-4 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Close</Button>
                    <Button
                        className="bg-cyan-600 hover:bg-cyan-700 text-white"
                        disabled={!room || !nurse || saving}
                        onClick={() => onConfirm(room, nurse)}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : "Approve with this room & nurse"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Free rooms (grouped by department, the doctor's own first) and free nurses to choose from.
function RoomNursePicker({ loading, rooms, nurses, room, nurse, onRoom, onNurse }: {
    loading: boolean;
    rooms: FreeRoom[];
    nurses: FreeNurse[];
    room: string;
    nurse: string;
    onRoom: (room: string) => void;
    onNurse: (nurse: string) => void;
}) {
    const roomGroups = useMemo(() => {
        const groups: Record<string, FreeRoom[]> = {};
        rooms.filter(r => r.free).forEach(r => { (groups[r.department] ||= []).push(r); });
        return Object.entries(groups).sort(([, a], [, b]) => Number(b[0].isDoctorDept) - Number(a[0].isDoctorDept));
    }, [rooms]);
    const freeNurses = nurses.filter(n => n.free);

    return (
        <div className="space-y-6">
        {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                <Loader2 className="animate-spin" size={18} /> Checking free rooms and nurses…
            </div>
        ) : (
            <>
                <section>
                    <h4 className="text-sm font-bold text-slate-800 mb-1">Room (any department)</h4>
                    <p className="text-xs text-slate-500 mb-3">Only rooms free for the whole session are shown.</p>
                    {roomGroups.length === 0 ? (
                        <p className="text-sm text-rose-600">No room in the hospital is free at this time.</p>
                    ) : (
                        <div className="space-y-3">
                            {roomGroups.map(([dept, list]) => (
                                <div key={dept}>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                                        {dept}{list[0].isDoctorDept ? " · doctor's department" : ""}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {list.map(r => (
                                            <button
                                                key={r.room}
                                                type="button"
                                                onClick={() => onRoom(r.room)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${room === r.room ? "bg-cyan-600 border-cyan-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:border-cyan-400"}`}
                                            >
                                                {r.room}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section>
                    <h4 className="text-sm font-bold text-slate-800 mb-3">Nurse</h4>
                    {freeNurses.length === 0 ? (
                        <p className="text-sm text-rose-600">No nurse is free at this time.</p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {freeNurses.map(n => (
                                <button
                                    key={n.name}
                                    type="button"
                                    onClick={() => onNurse(n.name)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${nurse === n.name ? "bg-cyan-600 border-cyan-600 text-white" : "bg-white border-slate-200 text-slate-700 hover:border-cyan-400"}`}
                                >
                                    {n.name}
                                </button>
                            ))}
                        </div>
                    )}
                </section>
            </>
        )}
        </div>
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
