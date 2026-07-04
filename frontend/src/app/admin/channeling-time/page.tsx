"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Loader2, Clock, CalendarDays, Check, User 
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

    useEffect(() => {
        fetchRequests();
        fetchDoctors();
    }, []);

    const fetchDoctors = async () => {
        try {
            const token = getAdminToken();
            const response = await fetch(`${API_URL}/admin/doctors`, {
                headers: { 
                    "x-auth-token": token || "",
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
            const token = getAdminToken();
            const response = await fetch(`${API_URL}/schedule-requests/all`, {
                headers: { 
                    "x-auth-token": token || "",
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
            const token = getAdminToken();
            const response = await fetch(`${API_URL}/schedule-requests/${id}/status`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "x-auth-token": token || ""
                },
                body: JSON.stringify({ status: newStatus }) 
            });
            
            if (response.ok) {
                setRequests(prev => 
                    prev.map(req => req._id === id ? { ...req, status: newStatus } : req)
                );
            } else {
                const errData = await response.json();
                // If this alert still triggers "Room/Nurse required", 
                // you MUST remove that validation from your Backend Express route.
                alert(errData.msg || "Failed to update status");
            }
        } catch (error) {
            console.error("Action Error:", error);
            alert("An error occurred. Please try again.");
        } finally {
            setLoadingAction(null);
        }
    };

    const pendingRequests = requests.filter(r => r.status === "pending");
    const historyRequests = requests.filter(r => r.status !== "pending");

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
                                            <select
                                                value={selectedDoctorId}
                                                onChange={(e) => setSelectedDoctorId(e.target.value)}
                                                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all shadow-sm"
                                                required
                                            >
                                                <option value="">Choose a doctor...</option>
                                                {fetchingDoctors ? (
                                                    <option disabled>Loading doctors...</option>
                                                ) : (
                                                    doctorsList.map((doc) => (
                                                        <option key={doc._id} value={doc._id}>
                                                            {doc.name || doc.fullName} ({doc.specialization})
                                                        </option>
                                                    ))
                                                )}
                                            </select>
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
            </main>
        </div>
    );
}

// --- SUB COMPONENTS ---

function RequestCard({ req, onAction, loadingId, isHistory, formatDate, formatTime }: any) {
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
