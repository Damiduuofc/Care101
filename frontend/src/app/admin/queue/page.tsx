"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Ensure you have this UI component
import { Loader2, Play, Square, Users, Plus, Minus, AlertCircle, BookOpen, Activity, Download, X, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";
import { io } from "socket.io-client";

export default function NurseQueueDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<{ [key: string]: boolean }>({});

    // Clinical Modal States
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [isMedicalBookOpen, setIsMedicalBookOpen] = useState(false);
    const [isNewRecordOpen, setIsNewRecordOpen] = useState(false);
    const [isLabRequestOpen, setIsLabRequestOpen] = useState(false);

    // Data States
    const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [labRequests, setLabRequests] = useState<any[]>([]);
    const [loadingLabs, setLoadingLabs] = useState(false);

    // Form States for Upload Record
    const [newRecordData, setNewRecordData] = useState({
        title: "OPD Consultation",
        type: "consultations",
        date: new Date().toISOString().substring(0, 10),
        description: "",
        diagnosis: "",
        medications: "",
        fileData: "",
        fileType: ""
    });
    const [uploadingRecord, setUploadingRecord] = useState(false);

    // Form States for Lab Request
    const [newLabData, setNewLabData] = useState({
        title: "",
        description: ""
    });
    const [submittingLab, setSubmittingLab] = useState(false);

    // Preview States for Medical Record attachments
    const [previews, setPreviews] = useState<{ [recordId: string]: { fileData: string, fileType: string } }>({});
    const [loadingPreviews, setLoadingPreviews] = useState<{ [recordId: string]: boolean }>({});
    const [showPreviews, setShowPreviews] = useState<{ [recordId: string]: boolean }>({});

    const togglePreview = async (recordId: string) => {
        if (showPreviews[recordId]) {
            setShowPreviews(prev => ({ ...prev, [recordId]: false }));
            return;
        }

        if (previews[recordId]) {
            setShowPreviews(prev => ({ ...prev, [recordId]: true }));
            return;
        }

        setLoadingPreviews(prev => ({ ...prev, [recordId]: true }));
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/medical-records/download/${recordId}`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.fileData) {
                    setPreviews(prev => ({ ...prev, [recordId]: { fileData: data.fileData, fileType: data.fileType } }));
                    setShowPreviews(prev => ({ ...prev, [recordId]: true }));
                } else {
                    alert("No attachment file data found.");
                }
            } else {
                alert("Failed to fetch preview file.");
            }
        } catch (err) {
            console.error("Preview fetch error:", err);
            alert("An error occurred fetching preview.");
        } finally {
            setLoadingPreviews(prev => ({ ...prev, [recordId]: false }));
        }
    };

    const fetchMedicalRecords = async (patientId: string) => {
        setLoadingRecords(true);
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/medical-records/patient/${patientId}`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setMedicalRecords(data);
            }
        } catch (err) {
            console.error("Fetch records error:", err);
        } finally {
            setLoadingRecords(false);
        }
    };

    const fetchLabRequests = async (patientId: string) => {
        setLoadingLabs(true);
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-requests/patient/${patientId}`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (res.ok) {
                const data = await res.json();
                setLabRequests(data);
            }
        } catch (err) {
            console.error("Fetch lab requests error:", err);
        } finally {
            setLoadingLabs(false);
        }
    };

    const handleDownload = async (recordId: string, fileName: string) => {
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/medical-records/download/${recordId}`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.fileData) {
                    const linkSource = data.fileData.startsWith("data:") ? data.fileData : `data:${data.fileType};base64,${data.fileData}`;
                    const downloadLink = document.createElement("a");
                    downloadLink.href = linkSource;
                    downloadLink.download = data.fileName || fileName || "medical_record";
                    downloadLink.click();
                } else {
                    alert("No file data associated with this record.");
                }
            } else {
                alert("Failed to download record file.");
            }
        } catch (err) {
            console.error("Download Error:", err);
        }
    };

    const handleUploadRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient) return;
        setUploadingRecord(true);
        try {
            const token = getAdminToken();
            const payload = {
                patientId: selectedPatient.id,
                doctorName: selectedPatient.doctorName,
                ...newRecordData
            };
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/medical-records/upload`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert("Medical Record Uploaded Successfully!");
                setIsNewRecordOpen(false);
                setNewRecordData({
                    title: "OPD Consultation",
                    type: "consultations",
                    date: new Date().toISOString().substring(0, 10),
                    description: "",
                    diagnosis: "",
                    medications: "",
                    fileData: "",
                    fileType: ""
                });
            } else {
                alert("Failed to upload medical record.");
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("An error occurred during upload.");
        } finally {
            setUploadingRecord(false);
        }
    };

    const handleCreateLabRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || !newLabData.title.trim()) return;
        setSubmittingLab(true);
        try {
            const token = getAdminToken();
            const payload = {
                patientId: selectedPatient.id,
                doctorId: selectedPatient.doctorId,
                doctorName: selectedPatient.doctorName,
                title: newLabData.title,
                description: newLabData.description
            };
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-requests/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert("Lab Request Created Successfully!");
                setNewLabData({ title: "", description: "" });
                fetchLabRequests(selectedPatient.id);
            } else {
                alert("Failed to create lab request.");
            }
        } catch (err) {
            console.error("Create lab request error:", err);
            alert("An error occurred.");
        } finally {
            setSubmittingLab(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewRecordData(prev => ({
                    ...prev,
                    fileData: reader.result as string,
                    fileType: file.type
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const getActiveAppointment = (doctorDocId: string, currentQueueNumber: number) => {
        return appointments.find(appt => {
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            return apptDocId === doctorDocId && 
                   appt.queueNumber === currentQueueNumber && 
                   isToday(appt.date) && 
                   appt.status !== 'cancelled';
        });
    };

    useEffect(() => {
        const storedUser = getAdminUser();
        if (storedUser) {
            if (storedUser.role !== "nurse") {
                router.push("/admin/dashboard");
                return;
            }
            setUser(storedUser);
        } else {
            clearAdminSession();
            router.push("/admin/login");
            return;
        }
    }, [router]);

    const fetchData = async () => {
        try {
            const token = getAdminToken();
            
            // 1. Fetch Doctors
            const docRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });

            if (docRes.ok) {
                const docData = await docRes.json();
                if (Array.isArray(docData)) {
                    setDoctors(docData);
                }
            }

            // 2. Fetch Appointments
            const apptRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });

            if (apptRes.ok) {
                const apptData = await apptRes.json();
                if (Array.isArray(apptData)) {
                    setAppointments(apptData);
                }
            }
        } catch (err) {
            console.error("Fetch Data Error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    useEffect(() => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002";
        let socketUrl = apiUrl;
        try {
            const urlObj = new URL(apiUrl);
            socketUrl = urlObj.origin;
        } catch (e) {
            console.error("Invalid API URL for socket:", e);
        }
        
        const socket = io(socketUrl);

        socket.on("connect", () => {
            console.log("🔌 Connected to Socket.IO Server");
        });

        socket.on("doctorStatusUpdated", (updatedDoc: any) => {
            setDoctors(prev => prev.map(d => d._id === updatedDoc._id ? updatedDoc : d));
        });

        socket.on("disconnect", () => {
            console.log("🔌 Disconnected from Socket.IO Server");
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const today = new Date();
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    };

    const getMaxQueueNumber = (doctorDocId: string) => {
        const doctorTodayAppts = appointments.filter(appt => {
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            return apptDocId === doctorDocId && isToday(appt.date) && appt.status !== 'cancelled';
        });

        const maxQ = doctorTodayAppts.reduce((max, appt) => {
            const qNum = appt.queueNumber || 0;
            return qNum > max ? qNum : max;
        }, doctorTodayAppts.length);

        return maxQ;
    };

    const getActiveAppointmentId = (doctorDocId: string, currentQueueNumber: number) => {
        const matched = appointments.find(appt => {
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            return apptDocId === doctorDocId && 
                   appt.queueNumber === currentQueueNumber && 
                   isToday(appt.date) && 
                   appt.status !== 'cancelled';
        });
        return matched ? matched._id : undefined;
    };

    const handleUpdateDoctor = async (doc: any, updates: any, action?: string, appointmentId?: string) => {
        setSaving({ ...saving, [doc._id]: true });
        try {
            const token = getAdminToken();
            
            const payload = {
                doctorId: doc._id,
                currentServingNumber: updates.currentQueueNumber !== undefined ? updates.currentQueueNumber : doc.currentQueueNumber,
                action: action || (updates.sessionStarted === false ? "end" : updates.sessionStarted === true ? "start" : undefined),
                appointmentId
            };

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/queue/update`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const updatedDoc = await res.json();
                setDoctors(prev => prev.map(d => d._id === updatedDoc._id ? {
                    ...d,
                    sessionStarted: updatedDoc.sessionStarted,
                    sessionEndedToday: updatedDoc.sessionEndedToday,
                    currentQueueNumber: updatedDoc.currentQueueNumber
                } : d));
            }
        } catch (err) {
            console.error("Failed to update doctor", err);
        } finally {
            setSaving({ ...saving, [doc._id]: false });
        }
    };

    if (loading || !user) {
        return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600 h-8 w-8" /></div>;
    }

    const assignedDoctors = doctors.filter(doc => doc.allocatedNurse === user.name);

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64">
            <Sidebar />

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Nurse OPD Queue</h1>
                    <p className="text-slate-500 mt-1">Manage doctor sessions and update patient queue numbers.</p>
                </div>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Nurse: {user.name}
                </div>
            </div>

            {assignedDoctors.length === 0 ? (
                <Card className="bg-slate-50 border-dashed border-2 text-center p-12">
                    <CardContent>
                        <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-700">No Doctors Assigned</h2>
                        <p className="text-slate-500 mt-2">No doctors are assigned to you currently.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {assignedDoctors.map(doc => (
                        <Card key={doc._id} className="border-slate-200 overflow-hidden shadow-sm transition-all">
                            <div className={`h-2 w-full ${doc.sessionStarted ? "bg-emerald-500" : "bg-slate-300"}`}></div>
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                                        {doc.profileImage ? <img src={doc.profileImage} alt="" className="w-full h-full object-cover" /> : doc.name.charAt(0)}
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl text-slate-800 font-bold">{doc.name}</CardTitle>
                                        <CardDescription className="text-sm font-semibold text-slate-500">
                                            {doc.specialization} • Room: {doc.allocatedRoom || "Unassigned"}
                                        </CardDescription>
                                    </div>
                                </div>

                                <div className="text-right flex flex-col items-end gap-2">
                                    {!doc.isArrived ? (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex gap-1">
                                            <AlertCircle className="h-3.5 w-3.5" /> Doctor Not Arrived
                                        </Badge>
                                    ) : doc.sessionStarted ? (
                                        <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-200 animate-pulse">
                                            Session Active
                                        </div>
                                    ) : doc.sessionEndedToday ? (
                                        <div className="bg-rose-50 text-rose-700 px-4 py-1.5 rounded-full text-sm font-bold border border-rose-200">
                                            Session Ended
                                        </div>
                                    ) : (
                                        <div className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-sm font-bold border border-slate-200">
                                            Ready to Start
                                        </div>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="flex-1 w-full border-r-0 md:border-r border-slate-200 pr-0 md:pr-8 space-y-4 text-center md:text-left">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Session Control</h3>

                                    {doc.sessionStarted ? (
                                        <Button
                                            onClick={() => {
                                                if (window.confirm("Are you sure you want to end this session? Once ended, you will not be able to restart it today.")) {
                                                    handleUpdateDoctor(doc, { sessionStarted: false, currentQueueNumber: 0 }, "end");
                                                }
                                            }}
                                            disabled={saving[doc._id]}
                                            variant="destructive"
                                            className="w-full md:w-auto font-bold h-12 px-6"
                                        >
                                            {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : <><Square className="mr-2 h-5 w-5" /> End Session</>}
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            <Button
                                                onClick={() => handleUpdateDoctor(doc, { sessionStarted: true, currentQueueNumber: 1 }, "start")}
                                                disabled={saving[doc._id] || !doc.isArrived || doc.sessionEndedToday}
                                                className={`w-full md:w-auto font-bold h-12 px-8 shadow-md ${(!doc.isArrived || doc.sessionEndedToday) ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                                            >
                                                {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : <><Play className="mr-2 h-5 w-5 fill-white" /> Start Session</>}
                                            </Button>
                                            {doc.sessionEndedToday ? (
                                                <p className="text-[11px] text-rose-600 font-bold italic">Session has already been completed today and cannot be restarted.</p>
                                            ) : !doc.isArrived ? (
                                                <p className="text-[11px] text-amber-600 font-bold italic">Waiting for receptionist confirmation...</p>
                                            ) : null}
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Queue Counter */}
                                <div className="flex-1 w-full pl-0 md:pl-4 text-center">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Current Patient Queue</h3>

                                    <div className={`inline-flex items-center gap-6 p-4 rounded-3xl ${doc.sessionStarted ? 'bg-slate-50 border border-slate-200' : 'opacity-40 pointer-events-none'}`}>
                                        <Button
                                            onClick={() => handleUpdateDoctor(doc, { currentQueueNumber: Math.max(0, (doc.currentQueueNumber || 0) - 1) }, "decrement")}
                                            variant="outline"
                                            size="icon"
                                            className="h-14 w-14 rounded-full border-2 border-slate-200 hover:bg-slate-100"
                                            disabled={!doc.sessionStarted || saving[doc._id]}
                                        >
                                            <Minus className="h-6 w-6 text-slate-600" />
                                        </Button>

                                        <div className="w-24 text-center">
                                            <span className="text-6xl font-black text-slate-800 tracking-tighter">
                                                {doc.currentQueueNumber || 0}
                                            </span>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                const maxQ = getMaxQueueNumber(doc._id);
                                                const nextQ = (doc.currentQueueNumber || 0) + 1;
                                                if (nextQ <= maxQ) {
                                                    const currentApptId = getActiveAppointmentId(doc._id, doc.currentQueueNumber);
                                                    handleUpdateDoctor(doc, { currentQueueNumber: nextQ }, "complete", currentApptId);
                                                }
                                            }}
                                            className="h-14 w-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200"
                                            size="icon"
                                            disabled={!doc.sessionStarted || saving[doc._id] || (doc.currentQueueNumber || 0) >= getMaxQueueNumber(doc._id)}
                                        >
                                            <Plus className="h-6 w-6" />
                                        </Button>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-400 mt-4">Update Number for Next Patient (Max: {getMaxQueueNumber(doc._id)})</p>
                                </div>
                            </CardContent>
                            
                            {/* Currently Serving Patient & Clinical Action Panel */}
                            {doc.sessionStarted && (() => {
                                const activeAppt = getActiveAppointment(doc._id, doc.currentQueueNumber);
                                return (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-6 md:p-8 space-y-6">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div>
                                                <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest">Currently Serving</span>
                                                {activeAppt ? (
                                                    <div className="mt-1">
                                                        <h4 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                                            {activeAppt.patientId?.fullName || "Walk-in Patient"}
                                                            <Badge className="bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-200">
                                                                Token #{activeAppt.queueNumber}
                                                            </Badge>
                                                        </h4>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Patient ID: <span className="font-semibold text-slate-700">{activeAppt.patientId?.patientId || activeAppt.patientId?._id?.substring(0, 8) || "N/A"}</span>
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1">
                                                        <h4 className="text-lg font-bold text-slate-500 italic">No patient currently active for Token #{doc.currentQueueNumber || 0}</h4>
                                                        <p className="text-xs text-slate-400 mt-0.5">Please update the counter to call the next patient.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {activeAppt && (
                                                <div className="flex flex-wrap gap-2.5">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="bg-white border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center gap-1.5 h-9 rounded-lg"
                                                        onClick={() => {
                                                            setSelectedPatient({
                                                                id: activeAppt.patientId?._id || activeAppt.patientId,
                                                                fullName: activeAppt.patientId?.fullName || "Patient",
                                                                doctorId: doc._id,
                                                                doctorName: doc.name
                                                            });
                                                            fetchMedicalRecords(activeAppt.patientId?._id || activeAppt.patientId);
                                                            setIsMedicalBookOpen(true);
                                                        }}
                                                    >
                                                        <BookOpen className="h-4 w-4 text-slate-500" />
                                                        Medical Book
                                                    </Button>

                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="bg-white border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center gap-1.5 h-9 rounded-lg"
                                                        onClick={() => {
                                                            setSelectedPatient({
                                                                id: activeAppt.patientId?._id || activeAppt.patientId,
                                                                fullName: activeAppt.patientId?.fullName || "Patient",
                                                                doctorId: doc._id,
                                                                doctorName: doc.name
                                                            });
                                                            setIsNewRecordOpen(true);
                                                        }}
                                                    >
                                                        <Plus className="h-4 w-4 text-slate-500" />
                                                        Add Medical Record
                                                    </Button>

                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="bg-white border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 flex items-center gap-1.5 h-9 rounded-lg"
                                                        onClick={() => {
                                                            setSelectedPatient({
                                                                id: activeAppt.patientId?._id || activeAppt.patientId,
                                                                fullName: activeAppt.patientId?.fullName || "Patient",
                                                                doctorId: doc._id,
                                                                doctorName: doc.name
                                                            });
                                                            fetchLabRequests(activeAppt.patientId?._id || activeAppt.patientId);
                                                            setIsLabRequestOpen(true);
                                                        }}
                                                    >
                                                        <Activity className="h-4 w-4 text-slate-500" />
                                                        Lab Requests
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Waiting List for this Doctor */}
                                        <div className="pt-4 border-t border-slate-100">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-3 font-semibold">Patients Waiting in Queue</span>
                                            {(() => {
                                                const waitingAppts = appointments.filter(appt => {
                                                    const apptDocId = appt.doctorId?._id || appt.doctorId;
                                                    return apptDocId === doc._id && 
                                                           isToday(appt.date) && 
                                                           appt.status !== 'cancelled' &&
                                                           (appt.queueNumber || 0) > (doc.currentQueueNumber || 0);
                                                }).sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));

                                                if (waitingAppts.length === 0) {
                                                    return <p className="text-xs text-slate-400 italic">No more waiting patients today.</p>;
                                                }

                                                return (
                                                    <div className="flex flex-wrap gap-2">
                                                        {waitingAppts.map(appt => (
                                                            <div key={appt._id} className="bg-white border border-slate-200/80 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs">
                                                                <span className="font-black text-slate-700 bg-slate-100 h-5 w-5 rounded-full flex items-center justify-center text-[10px]">
                                                                    {appt.queueNumber}
                                                                </span>
                                                                <div>
                                                                    <p className="font-bold text-slate-800 leading-none">{appt.patientId?.fullName || "Walk-in"}</p>
                                                                    <p className="text-[9px] text-slate-400 mt-0.5">ID: {appt.patientId?.patientId || appt.patientId?._id?.substring(0, 8) || "N/A"}</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                );
                            })()}
                        </Card>
                    ))}
                </div>
            )}

            {/* MEDICAL BOOK MODAL */}
            {isMedicalBookOpen && selectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Patient Medical Book</h3>
                                <p className="text-xs text-slate-500 mt-1">Viewing records for <span className="font-semibold text-slate-700">{selectedPatient.fullName}</span></p>
                            </div>
                            <button onClick={() => setIsMedicalBookOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {loadingRecords ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                                    <p className="text-sm font-medium">Loading history...</p>
                                </div>
                            ) : medicalRecords.length === 0 ? (
                                <div className="text-center py-16 text-slate-400">
                                    <BookOpen className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                                    <p className="text-sm font-medium">This patient does not have any medical records yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {medicalRecords.map((rec) => (
                                        <Card key={rec._id} className="border-slate-100 shadow-none bg-slate-50/30">
                                            <CardContent className="p-5 space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <Badge className="bg-cyan-50 text-cyan-700 border-cyan-100 hover:bg-cyan-50 capitalize">
                                                            {rec.type?.replace('_', ' ')}
                                                        </Badge>
                                                        <h4 className="font-bold text-slate-800 text-lg mt-1">{rec.title}</h4>
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-400">
                                                        {new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                    </span>
                                                </div>
                                                
                                                <div className="text-sm text-slate-600 whitespace-pre-line space-y-2">
                                                    {rec.description && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 block text-xs uppercase tracking-wider">Notes/Description:</span>
                                                            <p className="mt-0.5">{rec.description}</p>
                                                        </div>
                                                    )}
                                                    {rec.diagnosis && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 block text-xs uppercase tracking-wider">Diagnosis:</span>
                                                            <p className="mt-0.5 text-rose-600 font-medium">{rec.diagnosis}</p>
                                                        </div>
                                                    )}
                                                    {rec.medications && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 block text-xs uppercase tracking-wider">Prescribed Medications:</span>
                                                            <p className="mt-0.5 text-emerald-600 font-medium whitespace-pre-wrap">{rec.medications}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="pt-3 border-t border-slate-100/60 flex justify-between items-center text-xs">
                                                    <span className="text-slate-400 font-medium">
                                                        Uploaded/Entered by: <span className="font-semibold text-slate-600">{rec.doctorName || "Unknown"}</span>
                                                    </span>
                                                    {rec.fileType && (
                                                        <div className="flex gap-2">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="text-cyan-600 hover:text-cyan-700 font-bold hover:bg-cyan-50 flex items-center gap-1 h-8 px-3 rounded-lg text-xs"
                                                                onClick={() => togglePreview(rec._id)}
                                                            >
                                                                {showPreviews[rec._id] ? "Hide Preview" : "Show Preview"}
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="text-cyan-600 hover:text-cyan-700 font-bold hover:bg-cyan-50 flex items-center gap-1 h-8 px-3 rounded-lg text-xs"
                                                                onClick={() => handleDownload(rec._id, rec.title)}
                                                            >
                                                                <Download className="h-3.5 w-3.5" /> Download
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Inline File Preview Panel */}
                                                {showPreviews[rec._id] && (
                                                    <div className="mt-4 pt-4 border-t border-slate-100/60">
                                                        {loadingPreviews[rec._id] ? (
                                                            <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                                                                <Loader2 className="animate-spin h-4 w-4 text-cyan-600 animate-spin" />
                                                                <span>Loading preview...</span>
                                                            </div>
                                                        ) : previews[rec._id] ? (
                                                            (() => {
                                                                    const preview = previews[rec._id];
                                                                    const src = preview.fileData.startsWith("data:") ? preview.fileData : `data:${preview.fileType};base64,${preview.fileData}`;
                                                                    
                                                                    if (preview.fileType.startsWith("image/")) {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-100/30 flex items-center justify-center p-2">
                                                                                <img src={src} alt={rec.title} className="max-w-full max-h-[500px] object-contain rounded-lg" />
                                                                            </div>
                                                                        );
                                                                    } else if (preview.fileType === "application/pdf") {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-xl overflow-hidden h-[500px]">
                                                                                <iframe src={src} className="w-full h-full border-0" title={rec.title}></iframe>
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <p className="text-xs text-slate-500 italic py-2 text-center">
                                                                                Preview not supported for file type: {preview.fileType}. Please download to view.
                                                                            </p>
                                                                        );
                                                                    }
                                                            })()
                                                        ) : null}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                            <Button onClick={() => setIsMedicalBookOpen(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD MEDICAL RECORD MODAL */}
            {isNewRecordOpen && selectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Add Patient Medical Record</h3>
                                <p className="text-xs text-slate-500 mt-1">Entering record for <span className="font-semibold text-slate-700">{selectedPatient.fullName}</span></p>
                            </div>
                            <button onClick={() => setIsNewRecordOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUploadRecord} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Record Title *</label>
                                    <input 
                                        type="text" 
                                        required
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" 
                                        value={newRecordData.title}
                                        onChange={(e) => setNewRecordData(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Record Type *</label>
                                    <select 
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent bg-white"
                                        value={newRecordData.type}
                                        onChange={(e) => setNewRecordData(prev => ({ ...prev, type: e.target.value }))}
                                    >
                                        <option value="consultations">OPD Consultation</option>
                                        <option value="prescriptions">Prescription</option>
                                        <option value="reports">Clinical Report</option>
                                        <option value="lab_tests">Lab Test Report</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date *</label>
                                    <input 
                                        type="date" 
                                        required
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" 
                                        value={newRecordData.date}
                                        onChange={(e) => setNewRecordData(prev => ({ ...prev, date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Diagnosis</label>
                                <textarea 
                                    rows={2}
                                    placeholder="Enter diagnosis if applicable..."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none" 
                                    value={newRecordData.diagnosis}
                                    onChange={(e) => setNewRecordData(prev => ({ ...prev, diagnosis: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Medications / Prescription</label>
                                <textarea 
                                    rows={2}
                                    placeholder="List prescribed medicines and dosages..."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none" 
                                    value={newRecordData.medications}
                                    onChange={(e) => setNewRecordData(prev => ({ ...prev, medications: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Notes / Description</label>
                                <textarea 
                                    rows={3}
                                    placeholder="Add doctor session summary and clinical notes..."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none" 
                                    value={newRecordData.description}
                                    onChange={(e) => setNewRecordData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachment (PDF/Image)</label>
                                <div className="border-2 border-dashed border-slate-200 hover:border-cyan-300 rounded-xl p-4 transition-colors flex flex-col items-center justify-center text-center cursor-pointer relative">
                                    <UploadCloud className="h-8 w-8 text-slate-400 mb-1" />
                                    <span className="text-xs text-slate-500 font-medium">
                                        {newRecordData.fileType ? `File selected (${newRecordData.fileType.substring(0, 15)}...)` : "Click to select a file (Max 10MB)"}
                                    </span>
                                    <input 
                                        type="file" 
                                        accept="image/*,application/pdf"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 -mx-6 -mb-6 mt-6">
                                <Button type="button" variant="outline" onClick={() => setIsNewRecordOpen(false)} className="border-slate-200 text-slate-700 font-bold px-5">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={uploadingRecord} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-6 shadow-md shadow-cyan-100">
                                    {uploadingRecord ? <Loader2 className="animate-spin h-5 w-5" /> : "Upload Record"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LAB REQUESTS MODAL */}
            {isLabRequestOpen && selectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Lab Request & Reports Manager</h3>
                                <p className="text-xs text-slate-500 mt-1">Managing lab details for <span className="font-semibold text-slate-700">{selectedPatient.fullName}</span></p>
                            </div>
                            <button onClick={() => setIsLabRequestOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Request history (Left side) */}
                            <div className="space-y-4 border-r-0 lg:border-r border-slate-100 pr-0 lg:pr-8">
                                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2 font-semibold">Requested Reports</h4>
                                {loadingLabs ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                        <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                                        <p className="text-sm font-medium">Loading requests...</p>
                                    </div>
                                ) : labRequests.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Activity className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                                        <p className="text-xs font-semibold">No lab requests recorded for this patient.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                                        {labRequests.map((req) => (
                                            <Card key={req._id} className="border-slate-100 shadow-none bg-slate-50/30">
                                                <CardContent className="p-4 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <h5 className="font-bold text-slate-800 text-sm">{req.title}</h5>
                                                        <Badge className={
                                                            req.status === 'completed'
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50"
                                                            : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50"
                                                        }>
                                                            {req.status}
                                                        </Badge>
                                                    </div>
                                                    {req.description && <p className="text-xs text-slate-500">{req.description}</p>}
                                                    <div className="pt-2 border-t border-slate-100/60 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                                                        <span>Doctor: {req.doctorName}</span>
                                                        {req.status === 'completed' && req.recordId && (
                                                            <div className="flex gap-1.5">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="text-cyan-600 hover:text-cyan-700 font-bold hover:bg-cyan-50 flex items-center gap-1 h-7 px-2 rounded-md text-[10px]"
                                                                    onClick={() => togglePreview(req.recordId)}
                                                                >
                                                                    {showPreviews[req.recordId] ? "Hide" : "Preview"}
                                                                </Button>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="text-cyan-600 hover:text-cyan-700 font-bold hover:bg-cyan-50 flex items-center gap-1 h-7 px-2 rounded-md text-[10px]"
                                                                    onClick={() => handleDownload(req.recordId, req.title)}
                                                                >
                                                                    <Download className="h-3.5 w-3.5" /> Download
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Lab Request Inline Preview */}
                                                    {showPreviews[req.recordId] && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100/60">
                                                            {loadingPreviews[req.recordId] ? (
                                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 py-2 justify-center">
                                                                    <Loader2 className="animate-spin h-3.5 w-3.5 text-cyan-600 animate-spin" />
                                                                    <span>Loading preview...</span>
                                                                </div>
                                                            ) : previews[req.recordId] ? (
                                                                (() => {
                                                                    const preview = previews[req.recordId];
                                                                    const src = preview.fileData.startsWith("data:") ? preview.fileData : `data:${preview.fileType};base64,${preview.fileData}`;
                                                                    
                                                                    if (preview.fileType.startsWith("image/")) {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-lg overflow-hidden bg-slate-100/30 flex items-center justify-center p-1">
                                                                                <img src={src} alt={req.title} className="max-w-full max-h-64 object-contain rounded-md" />
                                                                            </div>
                                                                        );
                                                                    } else if (preview.fileType === "application/pdf") {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-lg overflow-hidden h-[300px]">
                                                                                <iframe src={src} className="w-full h-full border-0" title={req.title}></iframe>
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        return (
                                                                            <p className="text-[10px] text-slate-500 italic py-1 text-center">
                                                                                Preview not supported for file type: {preview.fileType}. Please download.
                                                                            </p>
                                                                        );
                                                                    }
                                                                })()
                                                            ) : null}
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Request form (Right side) */}
                            <form onSubmit={handleCreateLabRequest} className="space-y-4">
                                <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-2 font-semibold">Request New Lab Report</h4>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Test / Report Name *</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g., Full Blood Count (FBC), Serum Creatinine..."
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" 
                                        value={newLabData.title}
                                        onChange={(e) => setNewLabData(prev => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instructions / Notes</label>
                                    <textarea 
                                        rows={4}
                                        placeholder="Add specific instructions for the lab assistant..."
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none" 
                                        value={newLabData.description}
                                        onChange={(e) => setNewLabData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                <Button type="submit" disabled={submittingLab} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 rounded-xl shadow-md shadow-cyan-100 flex items-center justify-center gap-1.5">
                                    {submittingLab ? <Loader2 className="animate-spin h-5 w-5" /> : <><Plus className="h-4 w-4" /> Request Report</>}
                                </Button>
                            </form>
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                            <Button onClick={() => setIsLabRequestOpen(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}