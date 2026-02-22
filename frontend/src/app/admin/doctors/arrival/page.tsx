"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, UserX, Loader2 } from "lucide-react";

import { useRouter } from "next/navigation";

export default function DoctorArrivals() {
    const router = useRouter();
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem("adminUser");
        if (!storedUser || JSON.parse(storedUser).role !== "receptionist") {
            router.push("/admin/dashboard");
        }
    }, [router]);

    const fetchDoctors = async () => {
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (!res.ok) {
                console.error(`Server Error: ${res.status}`);
                return;
            }

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await res.text();
                console.error("Expected JSON but got:", contentType, text);
                return;
            }

            const data = await res.json();
            if (Array.isArray(data)) {
                setDoctors(data);
            } else {
                setDoctors([]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const token = localStorage.getItem("adminToken");
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                },
                body: JSON.stringify({ isArrived: !currentStatus })
            });
            fetchDoctors();
        } catch (err) {
            console.error("Failed to update status", err);
        }
    };

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600" /></div>;

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Doctor Arrival Status</h1>
                <p className="text-slate-500">Confirm doctors checking in for today's sessions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {doctors.map(doc => (
                    <Card key={doc._id} className="border-slate-200 shadow-sm">
                        <CardContent className="p-6 flex flex-col items-center">
                            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold text-slate-400 mb-4">
                                {doc.profileImage ? (
                                    <img src={doc.profileImage} alt={doc.name} className="h-full w-full rounded-full object-cover" />
                                ) : doc.name.charAt(0)}
                            </div>
                            <h3 className="font-bold text-slate-800 text-lg text-center">{doc.name}</h3>
                            <p className="text-sm text-slate-500 mb-4">{doc.specialization || "General"}</p>

                            <div className="w-full mt-2">
                                {doc.isArrived ? (
                                    <Button
                                        className="w-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-semibold flex items-center gap-2"
                                        onClick={() => toggleStatus(doc._id, doc.isArrived)}
                                    >
                                        <UserCheck className="h-5 w-5" /> Arrived
                                    </Button>
                                ) : (
                                    <Button
                                        className="w-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-semibold flex items-center gap-2"
                                        onClick={() => toggleStatus(doc._id, doc.isArrived)}
                                    >
                                        <UserX className="h-5 w-5" /> Not Arrived
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
