"use client";

import { useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Clock, CalendarDays, Check, X, User, Bell } from "lucide-react";

// Demo Data representing requests sent from the Doctor App
const INITIAL_DEMO_DATA = [
    {
        _id: "req_1",
        doctorName: "Dr. Lasantha Perera",
        specialization: "Cardiologist",
        requestedDate: "2026-03-20",
        requestedTime: "16:30",
        status: "Pending"
    },
    {
        _id: "req_2",
        doctorName: "Dr. Sarah Jayawardena",
        specialization: "Pediatrician",
        requestedDate: "2026-03-21",
        requestedTime: "09:00",
        status: "Pending"
    },
    {
        _id: "req_3",
        doctorName: "Dr. Kasun Rajapaksha",
        specialization: "Dermatologist",
        requestedDate: "2026-03-19",
        requestedTime: "14:00",
        status: "Confirmed"
    }
];

export default function ChannelingRequestDemo() {
    const [requests, setRequests] = useState(INITIAL_DEMO_DATA);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);

    const handleAction = (id: string, newStatus: "Confirmed" | "Rejected") => {
        setLoadingAction(id);
        
        // Simulate a network delay for the demo
        setTimeout(() => {
            setRequests(prev => 
                prev.map(req => req._id === id ? { ...req, status: newStatus } : req)
            );
            setLoadingAction(null);
        }, 800);
    };

    const pendingRequests = requests.filter(r => r.status === "Pending");
    const historyRequests = requests.filter(r => r.status !== "Pending");

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
                                />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="history" className="space-y-4 outline-none">
                        {historyRequests.length === 0 ? (
                            <EmptyState message="No history available yet." />
                        ) : (
                            historyRequests.map(req => (
                                <RequestCard key={req._id} req={req} isHistory />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}

function RequestCard({ req, onAction, loadingId, isHistory }: any) {
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
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{req.specialization}</p>
                        </div>
                    </div>

                    {/* Proposal Details */}
                    <div className="flex items-center gap-6 w-full lg:w-auto">
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                            <CalendarDays size={18} className="text-[#06b6d4]" />
                            <span className="text-sm">{req.requestedDate}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 font-medium">
                            <Clock size={18} className="text-[#06b6d4]" />
                            <span className="text-sm">{req.requestedTime}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        {isHistory ? (
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                req.status === "Confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                            }`}>
                                {req.status === "Confirmed" ? <Check size={14} /> : <X size={14} />}
                                {req.status}
                            </div>
                        ) : (
                            <>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => onAction(req._id, "Rejected")}
                                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    disabled={isLoading}
                                >
                                    Reject
                                </Button>
                                <Button 
                                    onClick={() => onAction(req._id, "Confirmed")}
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