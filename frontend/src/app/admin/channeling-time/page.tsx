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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ChannelingRequestPage() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
    }, []);

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
                        <Badge className="bg-cyan-500 hover:bg-cyan-600 text-white border-none px-4 py-1">
                            {pendingRequests.length} Pending
                        </Badge>
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
                            <Badge className={`${req.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"} border-none px-3 py-1 uppercase text-[10px]`}>
                                {req.status}
                            </Badge>
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