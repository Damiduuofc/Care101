"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, CalendarDays, Check, X, User, Bell } from "lucide-react";

export default function ChannelingRequestDemo() {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const response = await fetch(`${API_URL}/schedule-requests/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setRequests(data);
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
            const token = localStorage.getItem("adminToken");
            const response = await fetch(`${API_URL}/schedule-requests/${id}/status`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                setRequests(prev => 
                    prev.map(req => req._id === id ? { ...req, status: newStatus } : req)
                );
            }
        } catch (error) {
            console.error("Action Error:", error);
        } finally {
            setLoadingAction(null);
        }
    };

    const pendingRequests = requests.filter(r => r.status === "pending");
    const historyRequests = requests.filter(r => r.status !== "pending");

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    const formatTime = (timeStr: string) => {
        return new Date(timeStr).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 space-y-6">
                
                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Schedule Approvals</h1>
                        <p className="text-slate-500">Review and action time slot requests from medical staff.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 relative">
                            <Bell size={20} />
                            {pendingRequests.length > 0 && (
                                <span className="absolute top-2 right-2 h-2 w-2 bg-[#06b6d4] rounded-full"></span>
                            )}
                        </div>
                        <Badge className="bg-[#06b6d4] hover:bg-[#0891b2] text-white border-none px-4 py-1">
                            {pendingRequests.length} Pending
                        </Badge>
                    </div>
                </header>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="animate-spin text-[#06b6d4]" size={40} />
                    </div>
                ) : (

                <Tabs defaultValue="pending" className="w-full">
                    <TabsList className="bg-slate-200/50 p-1 mb-8">
                        <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:text-[#06b6d4]">
                            New Requests
                        </TabsTrigger>
                        <TabsTrigger value="history" className="data-[state=active]:bg-white data-[state=active]:text-[#06b6d4]">
                            Actioned History
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pending" className="space-y-4 outline-none">
                        {pendingRequests.length === 0 ? (
                            <EmptyState message="All caught up! No new requests." />
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
                            <EmptyState message="No history available yet." />
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

function RequestCard({ req, onAction, loadingId, isHistory, formatDate, formatTime }: any) {
    const isLoading = loadingId === req._id;

    return (
        <Card className={`group border-slate-200 shadow-sm overflow-hidden transition-all duration-300 ${isHistory ? 'bg-slate-50/50' : 'hover:shadow-md hover:border-[#06b6d4]/30 bg-white'}`}>
            <CardContent className="p-0">
                <div className="flex flex-col lg:flex-row items-center justify-between p-5 gap-6">
                    
                    {/* Doctor Info */}
                    <div className="flex items-center gap-4 w-full lg:w-1/3">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors ${isHistory ? 'bg-slate-200 text-slate-500' : 'bg-cyan-50 text-[#06b6d4]'}`}>
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 leading-tight">{req.doctorName}</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{req.specialization || "Specialist"}</p>
                        </div>
                    </div>

                    {/* Proposal Details */}
                    <div className="flex items-center gap-6 w-full lg:w-auto">
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                            <CalendarDays size={18} className="text-[#06b6d4]" />
                            <span className="text-sm">{formatDate(req.date)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                            <Clock size={18} className="text-[#06b6d4]" />
                            <span className="text-sm">{formatTime(req.startTime)} - {formatTime(req.endTime)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                            <Badge variant="outline" className="border-slate-200 text-slate-600 font-bold px-3 py-1">
                                {req.isUnlimited ? "∞ Unlimited" : `${req.queueLimit || 0} Patients MAX`}
                            </Badge>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        {isHistory ? (
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                req.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            }`}>
                                {req.status === "approved" ? <Check size={14} /> : <X size={14} />}
                                {req.status}
                            </div>
                        ) : (
                            <>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => onAction(req._id, "rejected")}
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    disabled={isLoading}
                                >
                                    Reject
                                </Button>
                                <Button 
                                    onClick={() => onAction(req._id, "approved")}
                                    className="bg-[#06b6d4] hover:bg-[#0891b2] text-white shadow-lg shadow-cyan-500/20 px-6 min-w-[120px]"
                                    disabled={isLoading}
                                >
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Confirm"}
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
            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-slate-200" />
            </div>
            <p className="text-slate-400 font-medium">{message}</p>
        </div>
    );
}