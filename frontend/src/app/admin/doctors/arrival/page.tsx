"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    UserCheck, UserX, Loader2, Search, 
    CheckCircle2, CircleOff, Users 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

export default function DoctorArrivals() {
    const router = useRouter();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        const storedUser = getAdminUser();
        if (!storedUser || storedUser.role !== "receptionist") {
            clearAdminSession();
            router.push("/admin/dashboard");
            return;
        }
        fetchDoctors();
    }, [router]);

    const fetchDoctors = async () => {
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setDoctors(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        setUpdatingId(id);
        const newStatus = !currentStatus;
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify({ isArrived: newStatus })
            });

            if (res.ok) {
                // Optimistic update for better UX
                setDoctors(prev => prev.map(doc => 
                    doc._id === id ? { ...doc, isArrived: newStatus } : doc
                ));
            }
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredDoctors = doctors.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const arrivedCount = doctors.filter(d => d.isArrived).length;

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 transition-all">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Doctor Arrivals</h1>
                        <p className="text-slate-500 mt-1">Manage and confirm daily attendance for the medical team.</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <Card className="px-4 py-2 flex items-center gap-3 bg-white shadow-sm border-slate-200">
                            <Users className="text-cyan-600 h-5 w-5" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Status</p>
                                <p className="text-sm font-bold text-slate-700">{arrivedCount} / {doctors.length} Present</p>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Filters */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Search by doctor name or specialty..." 
                        className="pl-10 bg-white border-slate-200 focus-visible:ring-cyan-500 max-w-md shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                        <p className="text-sm font-medium">Loading medical staff...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredDoctors.map(doc => (
                            <Card key={doc._id} className={`group transition-all duration-200 border-slate-200 hover:border-cyan-200 shadow-sm ${doc.isArrived ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="relative">
                                            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                {doc.profileImage ? (
                                                    <img src={doc.profileImage} alt={doc.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-bold text-slate-400">{doc.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            {doc.isArrived && (
                                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 truncate">{doc.name}</h3>
                                            <p className="text-xs font-medium text-cyan-600 uppercase tracking-wider">{doc.specialization || "General"}</p>
                                            
                                            <div className="mt-4 flex items-center justify-between">
                                                <Badge variant="secondary" className={doc.isArrived ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500"}>
                                                    {doc.isArrived ? "Active Today" : "Away"}
                                                </Badge>

                                                <Button
                                                    size="sm"
                                                    disabled={updatingId === doc._id}
                                                    onClick={() => toggleStatus(doc._id, doc.isArrived)}
                                                    className={`rounded-xl px-4 transition-all ${
                                                        doc.isArrived 
                                                        ? "bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 shadow-none border border-rose-100" 
                                                        : "bg-cyan-600 text-white hover:bg-cyan-700 shadow-md shadow-cyan-100"
                                                    }`}
                                                >
                                                    {updatingId === doc._id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : doc.isArrived ? (
                                                        <>Mark Away</>
                                                    ) : (
                                                        <>Check In</>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredDoctors.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <CircleOff className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">No doctors found</h3>
                        <p className="text-slate-500">Try adjusting your search query.</p>
                    </div>
                )}
            </main>
        </div>
    );
}                }
            });
            if (res.ok) {
                const data = await res.json();
                setDoctors(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        setUpdatingId(id);
        const newStatus = !currentStatus;
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify({ isArrived: newStatus })
            });

            if (res.ok) {
                // Optimistic update for better UX
                setDoctors(prev => prev.map(doc => 
                    doc._id === id ? { ...doc, isArrived: newStatus } : doc
                ));
            }
        } catch (err) {
            console.error("Failed to update status", err);
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredDoctors = doctors.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const arrivedCount = doctors.filter(d => d.isArrived).length;

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 transition-all">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Doctor Arrivals</h1>
                        <p className="text-slate-500 mt-1">Manage and confirm daily attendance for the medical team.</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <Card className="px-4 py-2 flex items-center gap-3 bg-white shadow-sm border-slate-200">
                            <Users className="text-cyan-600 h-5 w-5" />
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Status</p>
                                <p className="text-sm font-bold text-slate-700">{arrivedCount} / {doctors.length} Present</p>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Filters */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="Search by doctor name or specialty..." 
                        className="pl-10 bg-white border-slate-200 focus-visible:ring-cyan-500 max-w-md shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                        <p className="text-sm font-medium">Loading medical staff...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredDoctors.map(doc => (
                            <Card key={doc._id} className={`group transition-all duration-200 border-slate-200 hover:border-cyan-200 shadow-sm ${doc.isArrived ? 'bg-white' : 'bg-slate-50/50'}`}>
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="relative">
                                            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                {doc.profileImage ? (
                                                    <img src={doc.profileImage} alt={doc.name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-xl font-bold text-slate-400">{doc.name.charAt(0)}</span>
                                                )}
                                            </div>
                                            {doc.isArrived && (
                                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 truncate">{doc.name}</h3>
                                            <p className="text-xs font-medium text-cyan-600 uppercase tracking-wider">{doc.specialization || "General"}</p>
                                            
                                            <div className="mt-4 flex items-center justify-between">
                                                <Badge variant="secondary" className={doc.isArrived ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500"}>
                                                    {doc.isArrived ? "Active Today" : "Away"}
                                                </Badge>

                                                <Button
                                                    size="sm"
                                                    disabled={updatingId === doc._id}
                                                    onClick={() => toggleStatus(doc._id, doc.isArrived)}
                                                    className={`rounded-xl px-4 transition-all ${
                                                        doc.isArrived 
                                                        ? "bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 shadow-none border border-rose-100" 
                                                        : "bg-cyan-600 text-white hover:bg-cyan-700 shadow-md shadow-cyan-100"
                                                    }`}
                                                >
                                                    {updatingId === doc._id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : doc.isArrived ? (
                                                        <>Mark Away</>
                                                    ) : (
                                                        <>Check In</>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && filteredDoctors.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <CircleOff className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">No doctors found</h3>
                        <p className="text-slate-500">Try adjusting your search query.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
