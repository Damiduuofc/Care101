"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Loader2, Clock, CalendarDays, Check, User, ChevronDown, Search, X, AlertTriangle 
} from "lucide-react";
import { getAdminToken } from "@/lib/adminSession";
import { 
    Dialog, 
    DialogTrigger, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription 
} from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ─── Constants & Configurations ──────────────────────────────────────────────
const ROOM_DEPARTMENTS: Record<string, string> = {
  "Room 1": "Cardiology",
  "Room 2": "Cardiology",
  "Room 3": "Cardiology",
  "Room 4": "Pediatrics",
  "Room 5": "Pediatrics",
  "Room 6": "Pediatrics",
  "Room 7": "Dermatology",
  "Room 8": "Dermatology",
  "Room 9": "Dermatology",
  "Room 10": "Orthopedics",
  "Room 11": "Orthopedics",
  "Room 12": "Orthopedics",
  "Room 13": "General Medicine",
  "Room 14": "General Medicine",
  "Room 15": "General Medicine",
  "Room 16": "General Medicine",
  "Room 17": "General Medicine",
  "Room 18": "General Medicine",
  "Room 19": "General Medicine",
  "Room 20": "General Medicine"
};

const getDoctorDept = (specialization: string) => {
  const spec = (specialization || "").toLowerCase();
  if (spec.includes("cardio")) return "Cardiology";
  if (spec.includes("pedia") || spec.includes("child")) return "Pediatrics";
  if (spec.includes("derma") || spec.includes("skin")) return "Dermatology";
  if (spec.includes("ortho") || spec.includes("bone")) return "Orthopedics";
  return "General Medicine";
};

const getRoomsForDoctor = (specialization: string) => {
  const dept = getDoctorDept(specialization);
  return Object.entries(ROOM_DEPARTMENTS)
    .filter(([_, rDept]) => rDept === dept)
    .map(([room]) => room);
};

const checkTimeOverlap = (startA: string, endA: string, startB: string, endB: string) => {
  const tStartA = new Date(startA).getTime();
  const tEndA = new Date(endA).getTime();
  const tStartB = new Date(startB).getTime();
  const tEndB = new Date(endB).getTime();
  return tStartA < tEndB && tEndA > tStartB;
};

const isRoomBookedForTime = (roomName: string, req: any, allRequests: any[]) => {
  if (!roomName) return false;
  return allRequests.some(other => {
    if (other._id === req._id) return false;
    if (other.status !== 'approved') return false;
    if (other.allocatedRoom !== roomName) return false;
    
    const dateA = new Date(req.date).toDateString();
    const dateB = new Date(other.date).toDateString();
    if (dateA !== dateB) return false;

    return checkTimeOverlap(req.startTime, req.endTime, other.startTime, other.endTime);
  });
};

const isNurseBookedForTime = (nurseName: string, req: any, allRequests: any[]) => {
  if (!nurseName) return false;
  return allRequests.some(other => {
    if (other._id === req._id) return false;
    if (other.status !== 'approved') return false;
    if (other.allocatedNurse !== nurseName) return false;

    const dateA = new Date(req.date).toDateString();
    const dateB = new Date(other.date).toDateString();
    if (dateA !== dateB) return false;

    return checkTimeOverlap(req.startTime, req.endTime, other.startTime, other.endTime);
  });
};

export default function ChannelingRequestPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    // Form fields for direct scheduling
    const [doctorsList, setDoctorsList] = useState<any[]>([]);
    const [fetchingDoctors, setFetchingDoctors] = useState(true);
    const [selectedDoctorId, setSelectedDoctorId] = useState("");
    const [scheduleDate, setScheduleDate] = useState("");
    const [startTimeStr, setStartTimeStr] = useState("");
    const [endTimeStr, setEndTimeStr] = useState("");
    const [isUnlimited, setIsUnlimited] = useState(false);
    const [queueLimit, setQueueLimit] = useState("");
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Approval Dialog States
    const [approvalDialogReq, setApprovalDialogReq] = useState<any | null>(null);
    const [approvalRoom, setApprovalRoom] = useState("");
    const [approvalNurse, setApprovalNurse] = useState("");
    const [approvalSubmitting, setApprovalSubmitting] = useState(false);
    const [nursesList, setNursesList] = useState<any[]>([]);

    // Searchable dropdown states and refs
    const [searchQuery, setSearchQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchRequests();
        fetchDoctors();
        fetchStaff();
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

    const fetchStaff = async () => {
        try {
            const token = getAdminToken() || "";
            const response = await fetch(`${API_URL}/admin/staff`, {
                headers: { 
                    "Authorization": `Bearer ${token}`,
                    "x-auth-token": token,
                    "ngrok-skip-browser-warning": "true" 
                }
            });
            if (response.ok) {
                const data = await response.json();
                setNursesList(Array.isArray(data) ? data.filter((s: any) => s.role === "nurse") : []);
            }
        } catch (error) {
            console.error("Fetch Staff Error:", error);
        }
    };

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDoctorId || !scheduleDate || !startTimeStr || !endTimeStr) {
            alert("Please fill in all required fields.");
            return;
        }

        if (!isUnlimited && !queueLimit) {
            alert("Please provide a queue limit or select unlimited.");
            return;
        }

        const baseDate = new Date(scheduleDate);
        const [startHours, startMinutes] = startTimeStr.split(":");
        const [endHours, endMinutes] = endTimeStr.split(":");

        const startDateTime = new Date(baseDate);
        startDateTime.setHours(parseInt(startHours, 10), parseInt(startMinutes, 10), 0, 0);

        const endDateTime = new Date(baseDate);
        endDateTime.setHours(parseInt(endHours, 10), parseInt(endMinutes, 10), 0, 0);

        if (endDateTime <= startDateTime) {
            alert("End time must be after start time.");
            return;
        }

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
                    date: baseDate.toISOString(),
                    startTime: startDateTime.toISOString(),
                    endTime: endDateTime.toISOString(),
                    isUnlimited,
                    queueLimit: isUnlimited ? null : parseInt(queueLimit, 10)
                })
            });

            if (response.ok) {
                alert("Doctor schedule created and approved successfully.");
                setSelectedDoctorId("");
                setScheduleDate("");
                setStartTimeStr("");
                setEndTimeStr("");
                setIsUnlimited(false);
                setQueueLimit("");
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

    const handleAction = async (id: string, newStatus: "approved" | "rejected") => {
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
                setRequests(prev => 
                    prev.map(req => req._id === id ? { ...req, status: newStatus } : req)
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

    const handleConfirmApproval = async (id: string) => {
        if (!approvalRoom || !approvalNurse) {
            alert("Please select both a Room and a Nurse.");
            return;
        }
        
        setApprovalSubmitting(true);
        try {
            const token = getAdminToken() || "";
            const response = await fetch(`${API_URL}/schedule-requests/${id}/status`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "x-auth-token": token
                },
                body: JSON.stringify({ 
                    status: "approved",
                    allocatedRoom: approvalRoom,
                    allocatedNurse: approvalNurse
                }) 
            });
            
            if (response.ok) {
                setRequests(prev => 
                    prev.map(req => req._id === id ? { 
                        ...req, 
                        status: "approved",
                        allocatedRoom: approvalRoom,
                        allocatedNurse: approvalNurse 
                    } : req)
                );
                setApprovalDialogReq(null);
            } else {
                const errData = await response.json();
                alert(errData.msg || "Failed to approve schedule");
            }
        } catch (error) {
            console.error("Approval Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            setApprovalSubmitting(false);
        }
    };

    const modalApprovalConflictMessage = useMemo(() => {
        if (!approvalDialogReq || !approvalRoom || !approvalNurse) return null;
        
        const isRBooked = isRoomBookedForTime(approvalRoom, approvalDialogReq, requests);
        if (isRBooked) {
            return `⚠️ Conflict: Room ${approvalRoom} is already booked at this time by another approved doctor session.`;
        }

        const isNBooked = isNurseBookedForTime(approvalNurse, approvalDialogReq, requests);
        if (isNBooked) {
            return `⚠️ Conflict: Nurse ${approvalNurse} is already assigned at this time to another approved doctor session.`;
        }

        return null;
    }, [approvalDialogReq, approvalRoom, approvalNurse, requests]);

    const pendingRequests = requests.filter(r => r.status === "pending");
    const historyRequests = requests.filter(r => r.status !== "pending");

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
                            <DialogContent className="max-w-xl sm:rounded-2xl border-slate-200 shadow-xl bg-white p-0 overflow-hidden">
                                <DialogHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
                                    <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                        <Clock className="h-5 w-5 text-cyan-600" />
                                        Schedule Doctor Time Slot
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-500 text-xs mt-1">
                                        Create and automatically approve a channeling slot for a specific doctor.
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="p-6">
                                    <form onSubmit={handleCreateSchedule} className="space-y-4">
                                        
                                        {/* 1. Doctor Selection */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                Select Doctor
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

                                        {/* 2. Date Selection */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                Select Date
                                            </label>
<input
    type="date"
    value={scheduleDate}
    min={new Date().toISOString().split("T")[0]}
    onChange={(e) => setScheduleDate(e.target.value)}
    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all shadow-sm"
    required
/>
                                        </div>

                                        {/* 3. Time Selection */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                    Start Time
                                                </label>
                                                <input
                                                    type="time"
                                                    value={startTimeStr}
                                                    onChange={(e) => setStartTimeStr(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all shadow-sm"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                    End Time
                                                </label>
                                                <input
                                                    type="time"
                                                    value={endTimeStr}
                                                    onChange={(e) => setEndTimeStr(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all shadow-sm"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* 4. Queue Management */}
                                        <div className="border-t border-slate-100 pt-4 space-y-4">
                                            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Queue Management</h4>
                                            
                                            <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">Unlimited Queue</p>
                                                    <p className="text-xs text-slate-500">Allow patients to book slots without limits</p>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={isUnlimited}
                                                    onChange={(e) => setIsUnlimited(e.target.checked)}
                                                    className="h-5 w-5 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300"
                                                />
                                            </div>

                                            {!isUnlimited && (
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                                                        Maximum Patients (Queue Limit)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        placeholder="e.g. 25"
                                                        value={queueLimit}
                                                        onChange={(e) => setQueueLimit(e.target.value)}
                                                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all shadow-sm"
                                                        required
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Submit Button */}
                                        <Button
                                            type="submit"
                                            disabled={formSubmitting}
                                            className="w-full text-white bg-cyan-600 hover:bg-cyan-700 text-sm font-semibold rounded-xl py-2.5 shadow-md flex items-center justify-center gap-2 mt-4"
                                        >
                                            {formSubmitting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                                                    Creating Schedule...
                                                </>
                                            ) : (
                                                "Create & Approve Schedule"
                                            )}
                                        </Button>
                                    </form>
                                </div>
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
                            {pendingRequests.length === 0 ? (
                                <EmptyState message="No pending requests to review." />
                            ) : (
                                pendingRequests.map(req => (
                                    <RequestCard 
                                        key={req._id} 
                                        req={req} 
                                        onAction={handleAction} 
                                        onApproveClick={(selectedReq: any) => {
                                            setApprovalDialogReq(selectedReq);
                                            setApprovalRoom("");
                                            setApprovalNurse("");
                                        }}
                                        loadingId={loadingAction} 
                                        formatDate={formatDate}
                                        formatTime={formatTime}
                                    />
                                ))
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="space-y-4 outline-none">
                            {historyRequests.length === 0 ? (
                                <EmptyState message="History is empty." />
                            ) : (
                                historyRequests.map(req => (
                                    <RequestCard 
                                        key={req._id} 
                                        req={req} 
                                        isHistory 
                                        onAction={handleAction}
                                        loadingId={loadingAction}
                                        formatDate={formatDate}
                                        formatTime={formatTime}
                                    />
                                ))
                            )}
                        </TabsContent>
                    </Tabs>
                )}
                {/* --- APPROVAL RESOURCE PAIR ALLOCATION DIALOG --- */}
                {approvalDialogReq && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <Card className="w-full max-w-md bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center py-4 px-6">
                                <div>
                                    <h3 className="text-base text-slate-800 font-bold">Approve & Allocate Resources</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Assign Room and Nurse for Dr. {approvalDialogReq.doctorName}</p>
                                </div>
                                <button 
                                    onClick={() => setApprovalDialogReq(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X size={20} />
                                </button>
                            </CardHeader>

                            <CardContent className="p-6 space-y-4">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                                    <p className="text-slate-600"><strong>Specialization:</strong> {approvalDialogReq.specialization || "General Medicine"}</p>
                                    <p className="text-slate-600"><strong>Date:</strong> {formatDate(approvalDialogReq.date)}</p>
                                    <p className="text-slate-600"><strong>Time:</strong> {formatTime(approvalDialogReq.startTime)} – {formatTime(approvalDialogReq.endTime)}</p>
                                </div>

                                {/* Room select */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                                        <span>Select Room *</span>
                                        <span className="text-[10px] text-cyan-600 font-bold lowercase">
                                            ({getDoctorDept(approvalDialogReq.specialization)} rooms)
                                        </span>
                                    </label>
                                    <select 
                                        value={approvalRoom}
                                        onChange={(e) => setApprovalRoom(e.target.value)}
                                        className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                                    >
                                        <option value="">Choose Room...</option>
                                        {getRoomsForDoctor(approvalDialogReq.specialization).map(room => {
                                            const isBooked = isRoomBookedForTime(room, approvalDialogReq, requests);
                                            return (
                                                <option 
                                                    key={room} 
                                                    value={room} 
                                                    disabled={isBooked}
                                                    className={isBooked ? "text-slate-300" : ""}
                                                >
                                                    {room} {isBooked ? "(Booked)" : ""}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* Nurse select */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Assigned Nurse *</label>
                                    <select 
                                        value={approvalNurse}
                                        onChange={(e) => setApprovalNurse(e.target.value)}
                                        className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                                    >
                                        <option value="">Choose Nurse...</option>
                                        {nursesList.map(n => {
                                            const isBooked = isNurseBookedForTime(n.name, approvalDialogReq, requests);
                                            return (
                                                <option 
                                                    key={n._id} 
                                                    value={n.name}
                                                    disabled={isBooked}
                                                    className={isBooked ? "text-slate-300" : ""}
                                                >
                                                    {n.name} {isBooked ? "(Booked)" : ""}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* Conflict Check Info */}
                                {modalApprovalConflictMessage && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        <span className="font-semibold leading-relaxed">{modalApprovalConflictMessage}</span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        onClick={() => setApprovalDialogReq(null)}
                                        variant="outline"
                                        className="flex-1 text-xs"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => handleConfirmApproval(approvalDialogReq._id)}
                                        disabled={approvalSubmitting || !!modalApprovalConflictMessage || !approvalRoom || !approvalNurse}
                                        className="flex-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                                    >
                                        {approvalSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Approve Request"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>
        </div>
    );
}

// --- SUB COMPONENTS ---

function RequestCard({ req, onAction, onApproveClick, loadingId, isHistory, formatDate, formatTime }: any) {
    const isLoading = loadingId === req._id;

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
                    </div>

                    {/* 3. Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        {isHistory ? (
                            <div className="flex items-center gap-2">
                                <Badge className={`${req.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} border-none px-3 py-1 uppercase text-[10px]`}>
                                    {req.status}
                                </Badge>
                                {req.status === "approved" && (
                                    <Button 
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onAction(req._id, "rejected")}
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
                                    onClick={() => onApproveClick(req)}
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
