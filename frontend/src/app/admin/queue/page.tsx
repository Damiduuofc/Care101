"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge"; // Ensure you have this UI component
import { Loader2, Play, Square, Users, Plus, Minus, AlertCircle, BookOpen, Activity, Download, X, UploadCloud, Volume2, ClipboardList, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";
import { io } from "socket.io-client";
import { playDingSound } from "@/lib/soundUtils";
import NurseHeader from "@/components/admin/NurseHeader";
import LabTestPicker from "@/components/admin/LabTestPicker";
import { useSidebar } from "@/components/admin/SidebarContext";

export default function NurseQueueDashboard() {
    const router = useRouter();
    const { contentMarginClass } = useSidebar();
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
    const [isInstructionShareOpen, setIsInstructionShareOpen] = useState(false);

    // Surgical Instruction Share States
    const [doctorInstructions, setDoctorInstructions] = useState<any[]>([]);
    const [loadingInstructions, setLoadingInstructions] = useState(false);
    const [instructionsError, setInstructionsError] = useState("");
    const [shareInstructionId, setShareInstructionId] = useState("");
    const [shareSection, setShareSection] = useState<"preOp" | "postOp" | "both">("both");
    const [shareExpiry, setShareExpiry] = useState("");
    const [sharingInstruction, setSharingInstruction] = useState(false);
    const [shareResult, setShareResult] = useState<any>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    // Data States
    const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [labRequests, setLabRequests] = useState<any[]>([]);
    const [loadingLabs, setLoadingLabs] = useState(false);

    // Form States for Upload / Update Record
    const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
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
    const [newLabData, setNewLabData] = useState<{ testIds: string[]; description: string }>({
        testIds: [],
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

    const defaultShareExpiry = () => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().substring(0, 10);
    };

    const openInstructionShare = async (patient: { id: string; fullName: string; doctorId: string; doctorName: string }) => {
        setSelectedPatient(patient);
        setShareInstructionId("");
        setShareSection("both");
        setShareExpiry(defaultShareExpiry());
        setShareResult(null);
        setLinkCopied(false);
        setInstructionsError("");
        setDoctorInstructions([]);
        setIsInstructionShareOpen(true);

        setLoadingInstructions(true);
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/instructions/doctor/${patient.doctorId}`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                setDoctorInstructions(Array.isArray(data) ? data : []);
            } else {
                setInstructionsError(data?.msg || "Failed to load surgical instructions.");
            }
        } catch (err) {
            console.error("Fetch instructions error:", err);
            setInstructionsError("An error occurred loading surgical instructions.");
        } finally {
            setLoadingInstructions(false);
        }
    };

    const handleShareInstruction = async () => {
        if (!selectedPatient || !shareInstructionId || !shareExpiry) {
            alert("Please select a surgical instruction and an expiry date.");
            return;
        }

        setSharingInstruction(true);
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/instructions/nurse-share`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                },
                body: JSON.stringify({
                    instructionId: shareInstructionId,
                    patientId: selectedPatient.id,
                    section: shareSection,
                    expiresAt: shareExpiry
                })
            });
            const data = await res.json().catch(() => null);
            if (res.ok) {
                setShareResult(data);
            } else {
                alert(data?.msg || "Failed to share surgical instructions.");
            }
        } catch (err) {
            console.error("Share instruction error:", err);
            alert("An error occurred while sharing instructions.");
        } finally {
            setSharingInstruction(false);
        }
    };

    const handleCopyShareLink = async () => {
        if (!shareResult?.link) return;
        try {
            await navigator.clipboard.writeText(shareResult.link);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch {
            window.prompt("Copy this link:", shareResult.link);
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

    const openEditRecordModal = (rec: any) => {
        setEditingRecordId(rec._id);
        setNewRecordData({
            title: rec.title || "OPD Consultation",
            type: rec.type || "consultations",
            date: rec.date ? new Date(rec.date).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
            description: rec.description || "",
            diagnosis: rec.diagnosis || "",
            medications: rec.medications || "",
            fileData: "",
            fileType: rec.fileType || ""
        });
        setIsNewRecordOpen(true);
    };

    const handleUploadRecord = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient) return;
        setUploadingRecord(true);
        try {
            const token = getAdminToken();
            const payload = {
                patientId: selectedPatient.id,
                doctorId: selectedPatient.doctorId,
                doctorName: selectedPatient.doctorName,
                ...newRecordData
            };
            const url = editingRecordId
                ? `${process.env.NEXT_PUBLIC_API_URL}/medical-records/${editingRecordId}`
                : `${process.env.NEXT_PUBLIC_API_URL}/medical-records/upload`;
            const method = editingRecordId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert(editingRecordId ? "Medical Record Updated Successfully!" : "Medical Record Uploaded Successfully!");
                setIsNewRecordOpen(false);
                setEditingRecordId(null);
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
                fetchMedicalRecords(selectedPatient.id);
            } else {
                alert("Failed to save medical record.");
            }
        } catch (err) {
            console.error("Upload error:", err);
            alert("An error occurred during save.");
        } finally {
            setUploadingRecord(false);
        }
    };

    const handleCreateLabRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || newLabData.testIds.length === 0) {
            alert("Please select at least one lab test.");
            return;
        }
        setSubmittingLab(true);
        try {
            const token = getAdminToken();
            const payload = {
                patientId: selectedPatient.id,
                doctorId: selectedPatient.doctorId,
                doctorName: selectedPatient.doctorName,
                testIds: newLabData.testIds,
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
                const created = await res.json();
                alert(`Lab Request Created! Total: LKR ${Number(created.totalAmount || 0).toLocaleString()}`);
                setNewLabData({ testIds: [], description: "" });
                fetchLabRequests(selectedPatient.id);
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.msg || "Failed to create lab request.");
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

    // Unpaid patients keep their token but are kept out of the queue until they pay
    const isPaid = (appt: any) => appt.paymentStatus?.toLowerCase() === "paid";

    const getDoctorTodayAppointments = (doctorDocId: string) => {
        const todayList = appointments.filter(appt => {
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            return apptDocId === doctorDocId && isToday(appt.date) && appt.status !== 'cancelled' && isPaid(appt);
        }).sort((a, b) => {
            if (a.queueNumber && b.queueNumber) return a.queueNumber - b.queueNumber;
            return new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime();
        });
        return todayList.map((appt, idx) => ({
            ...appt,
            effectiveQueueNumber: appt.queueNumber || (idx + 1)
        }));
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
        
        const token = getAdminToken() || "";
        const socket = io(socketUrl, {
            auth: { token },
            extraHeaders: {
                "Authorization": `Bearer ${token}`,
                "x-auth-token": token
            }
        });

        socket.on("connect", () => {
            console.log("🔌 Connected to Socket.IO Server");
        });

        socket.on("doctorStatusUpdated", (updatedDoc: any) => {
            setDoctors(prev => prev.map(d => {
                if (d._id !== updatedDoc._id) return d;
                return {
                    ...d,
                    ...updatedDoc,
                    allocatedNurse: updatedDoc.allocatedNurse !== undefined ? updatedDoc.allocatedNurse : d.allocatedNurse,
                    allocatedRoom: updatedDoc.allocatedRoom !== undefined ? updatedDoc.allocatedRoom : d.allocatedRoom
                };
            }));
        });

        socket.on("doctorDelayAlert", (alertData: any) => {
            console.log("🚨 Received doctor delay alert in queue dashboard:", alertData);
            playDingSound();
            if (alertData?.doctorId) {
                setDoctors(prev => prev.map(d => {
                    if (d._id !== alertData.doctorId) return d;
                    return {
                        ...d,
                        channelingStatus: alertData.channelingStatus || alertData.status || d.channelingStatus,
                        allocatedNurse: alertData.allocatedNurse !== undefined ? alertData.allocatedNurse : d.allocatedNurse,
                        allocatedRoom: alertData.allocatedRoom !== undefined ? alertData.allocatedRoom : d.allocatedRoom
                    };
                }));
            }
        });

        socket.on("queueUpdated", (payload: any) => {
            if (!payload?.doctorId) return;
            setDoctors(prev => prev.map(d => {
                if (d._id !== payload.doctorId) return d;
                return {
                    ...d,
                    currentQueueNumber: payload.currentServingNumber ?? payload.currentToken ?? d.currentQueueNumber,
                    sessionStarted: payload.sessionStarted !== undefined ? payload.sessionStarted : d.sessionStarted,
                    sessionEndedToday: payload.sessionEndedToday !== undefined ? payload.sessionEndedToday : d.sessionEndedToday,
                    allocatedNurse: payload.allocatedNurse !== undefined ? payload.allocatedNurse : d.allocatedNurse,
                    allocatedRoom: payload.allocatedRoom !== undefined ? payload.allocatedRoom : d.allocatedRoom
                };
            }));
        });

        socket.on("appointmentUpdated", (updatedAppt: any) => {
            if (updatedAppt?._id) {
                setAppointments(prev => prev.map(a => a._id === updatedAppt._id ? { ...a, ...updatedAppt } : a));
            } else {
                fetchData();
            }
        });

        socket.on("nurseReleased", (payload: any) => {
            if (payload?.doctorId) {
                setDoctors(prev => prev.map(d => d._id === payload.doctorId ? { ...d, allocatedNurse: "" } : d));
            }
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
        try {
            const d = new Date(dateStr);
            const today = new Date();
            const isLocalSame = d.getDate() === today.getDate() &&
                                d.getMonth() === today.getMonth() &&
                                d.getFullYear() === today.getFullYear();
            const dateOnlyStr = dateStr.substring(0, 10);
            const todayOnlyStr = today.toISOString().substring(0, 10);
            return isLocalSame || dateOnlyStr === todayOnlyStr;
        } catch {
            return false;
        }
    };

    const getMaxQueueNumber = (doctorDocId: string) => {
        const doctorTodayAppts = appointments.filter(appt => {
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            return apptDocId === doctorDocId && isToday(appt.date) && appt.status !== 'cancelled' && isPaid(appt);
        });

        const maxQ = doctorTodayAppts.reduce((max, appt) => {
            const qNum = appt.queueNumber || 0;
            return qNum > max ? qNum : max;
        }, doctorTodayAppts.length);

        return maxQ;
    };

    const getActiveAppointment = (doctorDocId: string, currentQueueNumber: number) => {
        const todayList = getDoctorTodayAppointments(doctorDocId);
        if (todayList.length === 0) return undefined;
        return todayList.find(appt => appt.queueNumber === currentQueueNumber || appt.effectiveQueueNumber === currentQueueNumber);
    };

    // Next/previous paid token, skipping tokens held by unpaid patients
    const getAdjacentPaidToken = (doctorDocId: string, currentQueueNumber: number, direction: 1 | -1) => {
        const tokens = getDoctorTodayAppointments(doctorDocId).map(appt => appt.effectiveQueueNumber);
        const found = direction === 1
            ? tokens.filter(t => t > currentQueueNumber).sort((a, b) => a - b)[0]
            : tokens.filter(t => t < currentQueueNumber).sort((a, b) => b - a)[0];
        return found ?? Math.max(0, currentQueueNumber + direction);
    };

    const getActiveAppointmentId = (doctorDocId: string, currentQueueNumber: number) => {
        const matched = appointments.find(appt => {
            const apptDocId = appt.doctorId?._id || appt.doctorId;
            return apptDocId === doctorDocId && 
                   appt.queueNumber === currentQueueNumber && 
                   isToday(appt.date) && 
                   appt.status !== 'cancelled' &&
                   isPaid(appt);
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
                    currentQueueNumber: updatedDoc.currentQueueNumber,
                    allocatedNurse: updatedDoc.allocatedNurse !== undefined ? updatedDoc.allocatedNurse : d.allocatedNurse,
                    allocatedRoom: updatedDoc.allocatedRoom !== undefined ? updatedDoc.allocatedRoom : d.allocatedRoom
                } : d));

                if (appointmentId && action === "complete") {
                    setAppointments(prev => prev.map(a => a._id === appointmentId ? { ...a, status: "completed" } : a));
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.msg || "Could not update the session. Please try again.");
            }
        } catch (err) {
            console.error("Failed to update doctor", err);
        } finally {
            setSaving(prev => ({ ...prev, [doc._id]: false }));
        }
    };

    const handleToggleDoctorArrival = async (doctor: any) => {
        const newStatus = !doctor.isArrived;
        setSaving(prev => ({ ...prev, [doctor._id]: true }));
        try {
            const token = getAdminToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/doctors/${doctor._id}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token || "",
                },
                body: JSON.stringify({ isArrived: newStatus })
            });
            if (res.ok) {
                const updatedDoc = await res.json();
                setDoctors(prev => prev.map(d => d._id === doctor._id ? {
                    ...d,
                    ...updatedDoc,
                    isArrived: newStatus,
                    allocatedNurse: updatedDoc.allocatedNurse !== undefined ? updatedDoc.allocatedNurse : d.allocatedNurse,
                    allocatedRoom: updatedDoc.allocatedRoom !== undefined ? updatedDoc.allocatedRoom : d.allocatedRoom
                } : d));
            } else {
                alert("Failed to update doctor arrival status.");
            }
        } catch (err) {
            console.error("Arrival update error:", err);
            alert("Error updating arrival status.");
        } finally {
            setSaving(prev => ({ ...prev, [doctor._id]: false }));
        }
    };

    if (loading || !user) {
        return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600 h-8 w-8" /></div>;
    }

    const assignedDoctors = doctors.filter(doc => {
        if (!doc.allocatedNurse) return false;
        const nurseName = String(doc.allocatedNurse).trim().toLowerCase();
        const userName = String(user?.name || "").trim().toLowerCase();
        return nurseName === userName;
    });

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className={`flex-1 min-w-0 transition-all duration-300 p-3 sm:p-4 md:p-6 ${contentMarginClass}`}>
                {/* Unified Tablet-Optimized Nurse Header */}
                <NurseHeader
                    title="Nurse OPD Queue"
                    subtitle="Manage doctor sessions and update patient queue numbers."
                    userName={user?.name}
                    rightSlot={
                        <div className="flex items-center gap-2">
                            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs">
                                <Activity className="h-3.5 w-3.5 text-emerald-600 animate-pulse shrink-0" />
                                <span>{assignedDoctors.filter(d => d.sessionStarted).length} / {assignedDoctors.length} Active Sessions</span>
                            </div>
                        </div>
                    }
                />

                {assignedDoctors.length === 0 ? (
                    <Card className="bg-slate-50 border-dashed border-2 text-center p-8 sm:p-12 rounded-2xl">
                        <CardContent>
                            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-slate-700">No Doctors Assigned</h2>
                            <p className="text-slate-500 mt-2 text-sm">No doctors are assigned to you currently.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:gap-6">
                        {assignedDoctors.map(doc => (
                            <Card key={doc._id} className="border-slate-200 overflow-hidden shadow-sm transition-all rounded-2xl">
                                <div className={`h-2 w-full ${doc.sessionStarted ? "bg-emerald-500" : "bg-slate-300"}`}></div>
                                <CardHeader className="bg-slate-50/60 border-b border-slate-100 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                        <div className="h-12 w-12 sm:h-14 sm:w-14 bg-white border border-slate-200 shadow-sm rounded-full flex items-center justify-center font-bold text-slate-600 overflow-hidden shrink-0">
                                            {doc.profileImage ? <img src={doc.profileImage} alt="" className="w-full h-full object-cover" /> : doc.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <CardTitle className="text-lg sm:text-xl text-slate-800 font-bold truncate">{doc.name}</CardTitle>
                                            <CardDescription className="text-xs sm:text-sm font-semibold text-slate-500 truncate">
                                                {doc.specialization} • Room: {doc.allocatedRoom || "Unassigned"}
                                            </CardDescription>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                                        {!doc.isArrived ? (
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex gap-1 text-[11px] font-bold">
                                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Doctor Not Arrived
                                                </Badge>
                                                <Button
                                                    size="sm"
                                                    disabled={saving[doc._id]}
                                                    onClick={() => handleToggleDoctorArrival(doc)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-3 rounded-lg text-xs shadow-sm flex items-center gap-1 active:scale-95"
                                                >
                                                    {saving[doc._id] ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check In"}
                                                </Button>
                                            </div>
                                        ) : doc.sessionStarted ? (
                                            <div className="bg-emerald-50 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-bold border border-emerald-200 animate-pulse">
                                                Session Active
                                            </div>
                                        ) : doc.sessionEndedToday ? (
                                            <div className="bg-rose-50 text-rose-700 px-3.5 py-1.5 rounded-full text-xs font-bold border border-rose-200">
                                                Session Ended
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Arrived
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    disabled={saving[doc._id]}
                                                    onClick={() => handleToggleDoctorArrival(doc)}
                                                    className="text-slate-500 hover:text-rose-600 h-8 px-2 text-xs font-semibold"
                                                >
                                                    Mark Away
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardHeader>

                            <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 items-center gap-6 md:gap-8">
                                <div className="border-b md:border-b-0 md:border-r border-slate-200 pb-5 md:pb-0 md:pr-6 space-y-3 sm:space-y-4 text-center md:text-left">
                                    <h3 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mb-1 sm:mb-2">Session Control</h3>

                                    {doc.sessionStarted ? (
                                        <Button
                                            onClick={() => {
                                                if (window.confirm("End this session? It cannot be restarted. The doctor's later sessions today can still be started.")) {
                                                    handleUpdateDoctor(doc, { sessionStarted: false, currentQueueNumber: 0 }, "end");
                                                }
                                            }}
                                            disabled={saving[doc._id]}
                                            variant="destructive"
                                            className="w-full md:w-auto font-bold h-11 sm:h-12 px-6 rounded-xl shadow-sm active:scale-95"
                                        >
                                            {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : <><Square className="mr-2 h-4 w-4 sm:h-5 sm:w-5" /> End Session</>}
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            <Button
                                                onClick={() => handleUpdateDoctor(doc, { sessionStarted: true, currentQueueNumber: 1 }, "start")}
                                                disabled={saving[doc._id] || !doc.isArrived || doc.sessionEndedToday}
                                                className={`w-full md:w-auto font-bold h-11 sm:h-12 px-6 sm:px-8 rounded-xl shadow-md active:scale-95 ${(!doc.isArrived || doc.sessionEndedToday) ? 'bg-slate-300' : 'bg-cyan-600 hover:bg-cyan-700 text-white'}`}
                                            >
                                                {saving[doc._id] ? <Loader2 className="animate-spin h-5 w-5 mx-auto" /> : <><Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5 fill-white" /> Start Session</>}
                                            </Button>
                                            {doc.sessionEndedToday ? (
                                                <p className="text-[11px] text-rose-600 font-bold italic">All of this doctor's sessions today have been completed.</p>
                                            ) : !doc.isArrived ? (
                                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                                                    <p className="text-[11px] text-amber-600 font-bold italic">Doctor must be checked in to start session.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleDoctorArrival(doc)}
                                                        className="text-[11px] text-cyan-700 font-bold underline hover:text-cyan-800"
                                                    >
                                                        Check In Doctor Now
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Queue Counter */}
                                <div className="pl-0 md:pl-4 text-center">
                                    <h3 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Current Patient Queue</h3>

                                    <div className={`inline-flex items-center justify-center gap-4 sm:gap-6 p-3 sm:p-4 rounded-3xl ${doc.sessionStarted ? 'bg-slate-50 border border-slate-200 shadow-sm' : 'opacity-40 pointer-events-none'}`}>
                                        <Button
                                            onClick={() => handleUpdateDoctor(doc, { currentQueueNumber: getAdjacentPaidToken(doc._id, doc.currentQueueNumber || 0, -1) })}
                                            variant="outline"
                                            size="icon"
                                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-slate-200 hover:bg-slate-100 active:scale-95 shrink-0"
                                            disabled={!doc.sessionStarted || saving[doc._id]}
                                        >
                                            <Minus className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600" />
                                        </Button>

                                        <div className="w-20 sm:w-24 text-center">
                                            <span className="text-5xl sm:text-6xl font-black text-slate-800 tracking-tighter">
                                                {doc.currentQueueNumber || 0}
                                            </span>
                                        </div>

                                        <Button
                                            onClick={() => {
                                                const nextQ = getAdjacentPaidToken(doc._id, doc.currentQueueNumber || 0, 1);
                                                const currentApptId = getActiveAppointmentId(doc._id, doc.currentQueueNumber);
                                                handleUpdateDoctor(doc, { currentQueueNumber: nextQ }, "complete", currentApptId);
                                            }}
                                            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200 active:scale-95 shrink-0"
                                            size="icon"
                                            disabled={!doc.sessionStarted || saving[doc._id]}
                                        >
                                            <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
                                        </Button>
                                    </div>
                                    <p className="text-xs font-semibold text-slate-400 mt-3">
                                      Update Number for Next Patient {getMaxQueueNumber(doc._id) > 0 ? `(Scheduled: ${getMaxQueueNumber(doc._id)})` : ''}
                                    </p>
                                </div>
                            </CardContent>
                            
                            {/* Currently Serving Patient & Clinical Action Panel */}
                            {(() => {
                                const todayDoctorAppts = getDoctorTodayAppointments(doc._id);
                                const activeAppt = getActiveAppointment(doc._id, doc.currentQueueNumber);
                                return (
                                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 md:p-7 space-y-5">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                            <div>
                                                <span className="text-xs font-bold text-cyan-600 uppercase tracking-widest">
                                                    {doc.sessionStarted ? "Currently Serving" : "Next / Selected Patient in Queue"}
                                                </span>
                                                {activeAppt ? (
                                                    <div className="mt-1">
                                                        <h4 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                                                            <span>{activeAppt.patientId?.fullName || "Walk-in Patient"}</span>
                                                            <Badge className="bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-200">
                                                                Token #{activeAppt.queueNumber || activeAppt.effectiveQueueNumber}
                                                            </Badge>
                                                        </h4>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            Patient ID: <span className="font-semibold text-slate-700">{activeAppt.patientId?.patientId || activeAppt.patientId?._id?.substring(0, 8) || "N/A"}</span>
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="mt-1">
                                                        <h4 className="text-base sm:text-lg font-bold text-slate-500 italic">No patient currently scheduled for today</h4>
                                                        <p className="text-xs text-slate-400 mt-0.5">Patients with appointments today will appear below.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {activeAppt && (
                                                <div className="flex flex-wrap gap-2">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="bg-white border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5 h-9 px-3 rounded-xl shadow-sm active:scale-95"
                                                        onClick={() => {
                                                            const patId = activeAppt.patientId?._id || activeAppt.patientId;
                                                            setSelectedPatient({
                                                                id: patId,
                                                                fullName: activeAppt.patientId?.fullName || "Patient",
                                                                doctorId: doc._id,
                                                                doctorName: doc.name
                                                            });
                                                            fetchMedicalRecords(patId);
                                                            fetchLabRequests(patId);
                                                            setIsMedicalBookOpen(true);
                                                        }}
                                                    >
                                                        <BookOpen className="h-4 w-4 text-slate-500" />
                                                        Medical Book
                                                    </Button>

                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="bg-white border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5 h-9 px-3 rounded-xl shadow-sm active:scale-95"
                                                        onClick={() => {
                                                            setEditingRecordId(null);
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
                                                        Add / Update Record
                                                    </Button>

                                                    <Button 
                                                        variant="outline" 
                                                        size="sm"
                                                        className="bg-white border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center gap-1.5 h-9 px-3 rounded-xl shadow-sm active:scale-95"
                                                        onClick={() => {
                                                            const patId = activeAppt.patientId?._id || activeAppt.patientId;
                                                            setSelectedPatient({
                                                                id: patId,
                                                                fullName: activeAppt.patientId?.fullName || "Patient",
                                                                doctorId: doc._id,
                                                                doctorName: doc.name
                                                            });
                                                            fetchLabRequests(patId);
                                                            setIsLabRequestOpen(true);
                                                        }}
                                                    >
                                                        <Activity className="h-4 w-4 text-slate-500" />
                                                        Lab Requests
                                                    </Button>

                                                    {doc.sessionStarted && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm"
                                                            className="bg-cyan-50 border-cyan-200 text-cyan-700 font-bold text-xs hover:bg-cyan-100 flex items-center gap-1.5 h-9 px-3 rounded-xl shadow-sm active:scale-95"
                                                            onClick={() => openInstructionShare({
                                                                id: activeAppt.patientId?._id || activeAppt.patientId,
                                                                fullName: activeAppt.patientId?.fullName || "Patient",
                                                                doctorId: doc._id,
                                                                doctorName: doc.name
                                                            })}
                                                        >
                                                            <ClipboardList className="h-4 w-4" />
                                                            Surgical Instructions
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Full Today's Queue List for this Doctor with Quick Clinical Actions */}
                                        <div className="pt-3 border-t border-slate-100">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2.5">Today&apos;s Patients in Queue</span>
                                            {todayDoctorAppts.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No appointments scheduled for this doctor today.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                                    {todayDoctorAppts.map(appt => {
                                                        const patId = appt.patientId?._id || appt.patientId;
                                                        const isCurrent = activeAppt && activeAppt._id === appt._id;
                                                        return (
                                                            <div key={appt._id} className={`bg-white border rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2 text-xs transition-all ${isCurrent ? 'border-cyan-400 ring-2 ring-cyan-100 shadow-sm' : 'border-slate-200/80 hover:border-slate-300'}`}>
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className={`font-black h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center text-[11px] shrink-0 ${isCurrent ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'}`}>
                                                                        {appt.queueNumber || appt.effectiveQueueNumber}
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-slate-800 truncate text-xs sm:text-sm">{appt.patientId?.fullName || "Walk-in"}</p>
                                                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">ID: {appt.patientId?.patientId || appt.patientId?._id?.substring(0, 8) || "N/A"}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px] font-bold text-slate-600 hover:text-cyan-700 hover:bg-cyan-50"
                                                                        onClick={() => {
                                                                            setSelectedPatient({
                                                                                id: patId,
                                                                                fullName: appt.patientId?.fullName || "Patient",
                                                                                doctorId: doc._id,
                                                                                doctorName: doc.name
                                                                            });
                                                                            fetchMedicalRecords(patId);
                                                                            fetchLabRequests(patId);
                                                                            setIsMedicalBookOpen(true);
                                                                        }}
                                                                    >
                                                                        <BookOpen className="h-3.5 w-3.5 mr-1 text-slate-400" /> Book
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px] font-bold text-slate-600 hover:text-cyan-700 hover:bg-cyan-50"
                                                                        onClick={() => {
                                                                            setEditingRecordId(null);
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
                                                                            setSelectedPatient({
                                                                                id: patId,
                                                                                fullName: appt.patientId?.fullName || "Patient",
                                                                                doctorId: doc._id,
                                                                                doctorName: doc.name
                                                                            });
                                                                            setIsNewRecordOpen(true);
                                                                        }}
                                                                    >
                                                                        <Plus className="h-3.5 w-3.5 mr-1 text-slate-400" /> Record
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-[11px] font-bold text-slate-600 hover:text-cyan-700 hover:bg-cyan-50"
                                                                        onClick={() => {
                                                                            setSelectedPatient({
                                                                                id: patId,
                                                                                fullName: appt.patientId?.fullName || "Patient",
                                                                                doctorId: doc._id,
                                                                                doctorName: doc.name
                                                                            });
                                                                            fetchLabRequests(patId);
                                                                            setIsLabRequestOpen(true);
                                                                        }}
                                                                    >
                                                                        <Activity className="h-3.5 w-3.5 mr-1 text-slate-400" /> Lab
                                                                    </Button>
                                                                    {doc.sessionStarted && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-[11px] font-bold text-cyan-700 hover:text-cyan-800 hover:bg-cyan-50"
                                                                            onClick={() => openInstructionShare({
                                                                                id: patId,
                                                                                fullName: appt.patientId?.fullName || "Patient",
                                                                                doctorId: doc._id,
                                                                                doctorName: doc.name
                                                                            })}
                                                                        >
                                                                            <ClipboardList className="h-3.5 w-3.5 mr-1" /> Instructions
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-2.5 bg-slate-50/60">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">Patient Medical Book</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Viewing records for <span className="font-semibold text-slate-700">{selectedPatient.fullName}</span> • On behalf of <span className="font-semibold text-cyan-700">{selectedPatient.doctorName}</span></p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold h-8 px-3 rounded-lg active:scale-95 shadow-sm"
                                    onClick={() => {
                                        setEditingRecordId(null);
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
                                        setIsNewRecordOpen(true);
                                    }}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Record
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-200 text-slate-700 text-xs font-bold h-8 px-3 rounded-lg active:scale-95"
                                    onClick={() => {
                                        fetchLabRequests(selectedPatient.id);
                                        setIsLabRequestOpen(true);
                                    }}
                                >
                                    <Activity className="h-3.5 w-3.5 mr-1" /> Request Lab
                                </Button>
                                <button onClick={() => setIsMedicalBookOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
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
                                <div className="space-y-3.5">
                                    {medicalRecords.map((rec) => (
                                        <Card key={rec._id} className="border-slate-100 shadow-none bg-slate-50/40 rounded-xl">
                                            <CardContent className="p-4 sm:p-5 space-y-3">
                                                <div className="flex justify-between items-start flex-wrap gap-2">
                                                    <div>
                                                        <Badge className="bg-cyan-50 text-cyan-700 border-cyan-100 hover:bg-cyan-50 capitalize text-[10px] font-bold">
                                                            {rec.type?.replace('_', ' ')}
                                                        </Badge>
                                                        <h4 className="font-bold text-slate-800 text-base sm:text-lg mt-0.5">{rec.title}</h4>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 px-2.5 text-xs font-bold text-cyan-700 border-cyan-200 hover:bg-cyan-50 active:scale-95"
                                                            onClick={() => openEditRecordModal(rec)}
                                                        >
                                                            Update Record
                                                        </Button>
                                                        <span className="text-xs font-semibold text-slate-400">
                                                            {new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div className="text-xs sm:text-sm text-slate-600 whitespace-pre-line space-y-2">
                                                    {rec.description && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 block text-[11px] uppercase tracking-wider">Notes/Description:</span>
                                                            <p className="mt-0.5">{rec.description}</p>
                                                        </div>
                                                    )}
                                                    {rec.diagnosis && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 block text-[11px] uppercase tracking-wider">Diagnosis:</span>
                                                            <p className="mt-0.5 text-rose-600 font-semibold">{rec.diagnosis}</p>
                                                        </div>
                                                    )}
                                                    {rec.medications && (
                                                        <div>
                                                            <span className="font-bold text-slate-500 block text-[11px] uppercase tracking-wider">Prescribed Medications:</span>
                                                            <p className="mt-0.5 text-emerald-600 font-semibold whitespace-pre-wrap">{rec.medications}</p>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="pt-2.5 border-t border-slate-100/60 flex flex-wrap justify-between items-center gap-2 text-xs">
                                                    <span className="text-slate-400 font-medium text-[11px]">
                                                        Entered by: <span className="font-semibold text-slate-600">{rec.doctorName || "Unknown"}</span>
                                                    </span>
                                                    {rec.fileType && (
                                                        <div className="flex gap-1.5">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="text-cyan-600 hover:text-cyan-700 font-bold hover:bg-cyan-50 flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs"
                                                                onClick={() => togglePreview(rec._id)}
                                                            >
                                                                {showPreviews[rec._id] ? "Hide Preview" : "Show Preview"}
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="text-cyan-600 hover:text-cyan-700 font-bold hover:bg-cyan-50 flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs"
                                                                onClick={() => handleDownload(rec._id, rec.title)}
                                                            >
                                                                <Download className="h-3.5 w-3.5" /> Download
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Inline File Preview Panel */}
                                                {showPreviews[rec._id] && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100/60">
                                                        {loadingPreviews[rec._id] ? (
                                                            <div className="flex items-center gap-2 text-xs text-slate-400 py-3 justify-center">
                                                                <Loader2 className="animate-spin h-4 w-4 text-cyan-600" />
                                                                <span>Loading preview...</span>
                                                            </div>
                                                        ) : previews[rec._id] ? (
                                                            (() => {
                                                                    const preview = previews[rec._id];
                                                                    const src = preview.fileData.startsWith("data:") ? preview.fileData : `data:${preview.fileType};base64,${preview.fileData}`;
                                                                    
                                                                    if (preview.fileType.startsWith("image/")) {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-100/30 flex items-center justify-center p-2">
                                                                                <img src={src} alt={rec.title} className="max-w-full max-h-[300px] sm:max-h-[450px] object-contain rounded-lg" />
                                                                            </div>
                                                                        );
                                                                    } else if (preview.fileType === "application/pdf") {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-xl overflow-hidden h-[300px] sm:h-[450px]">
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
                        
                        <div className="p-3 sm:p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                            <Button onClick={() => setIsMedicalBookOpen(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 rounded-xl h-9 text-xs sm:text-sm">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD / UPDATE MEDICAL RECORD MODAL */}
            {isNewRecordOpen && selectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                                    {editingRecordId ? "Update Patient Medical Record" : "Add Patient Medical Record"}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {editingRecordId ? "Updating record for " : "Entering record for "}
                                    <span className="font-semibold text-slate-700">{selectedPatient.fullName}</span> on behalf of <span className="font-semibold text-cyan-700">{selectedPatient.doctorName}</span>
                                </p>
                            </div>
                            <button onClick={() => { setIsNewRecordOpen(false); setEditingRecordId(null); }} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleUploadRecord} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date *</label>
                                <input 
                                    type="date" 
                                    required
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent" 
                                    value={newRecordData.date}
                                    onChange={(e) => setNewRecordData(prev => ({ ...prev, date: e.target.value }))}
                                />
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
                                    rows={2}
                                    placeholder="Add doctor session summary and clinical notes..."
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none" 
                                    value={newRecordData.description}
                                    onChange={(e) => setNewRecordData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Attachment (PDF/Image)</label>
                                <div className="border-2 border-dashed border-slate-200 hover:border-cyan-300 rounded-xl p-3 sm:p-4 transition-colors flex flex-col items-center justify-center text-center cursor-pointer relative">
                                    <UploadCloud className="h-7 w-7 text-slate-400 mb-1" />
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

                            <div className="p-3 sm:p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 mt-4">
                                <Button type="button" variant="outline" onClick={() => { setIsNewRecordOpen(false); setEditingRecordId(null); }} className="border-slate-200 text-slate-700 font-bold px-4 rounded-xl text-xs sm:text-sm h-9">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={uploadingRecord} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-5 rounded-xl shadow-md shadow-cyan-100 text-xs sm:text-sm h-9 active:scale-95">
                                    {uploadingRecord ? <Loader2 className="animate-spin h-4 w-4" /> : (editingRecordId ? "Save Changes" : "Upload Record")}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SURGICAL INSTRUCTIONS SHARE MODAL */}
            {isInstructionShareOpen && selectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
                        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">Share Surgical Instructions</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    For <span className="font-semibold text-slate-700">{selectedPatient.fullName}</span> • {selectedPatient.doctorName}
                                </p>
                            </div>
                            <button onClick={() => setIsInstructionShareOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                            {shareResult ? (
                                <div className="text-center space-y-4">
                                    <div className="inline-block bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                        <QRCodeSVG value={shareResult.link} size={200} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{shareResult.surgeryName}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {shareResult.section === "preOp" ? "Pre-Operative" : shareResult.section === "postOp" ? "Post-Operative" : "Pre & Post-Operative"} • Valid until{" "}
                                            <span className="font-semibold text-slate-700">{new Date(shareResult.expiresAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                                        <input readOnly value={shareResult.link} className="flex-1 min-w-0 bg-transparent text-xs text-slate-600 outline-none px-1" />
                                        <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs font-bold shrink-0" onClick={handleCopyShareLink}>
                                            {linkCopied ? <><Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Copied</> : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>}
                                        </Button>
                                    </div>
                                    <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                                        Link saved to the patient&apos;s medical records.
                                    </p>
                                </div>
                            ) : loadingInstructions ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                                    <p className="text-sm font-medium">Loading surgical instructions...</p>
                                </div>
                            ) : instructionsError ? (
                                <div className="text-center py-10 text-rose-600 bg-rose-50 rounded-xl border border-rose-100 text-sm font-semibold px-4">
                                    {instructionsError}
                                </div>
                            ) : doctorInstructions.length === 0 ? (
                                <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <ClipboardList className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                                    <p className="text-xs font-semibold">{selectedPatient.doctorName} has no surgical instructions yet.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">1. Select Surgical Instruction</label>
                                        <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                                            {doctorInstructions.map((ins) => {
                                                const hasPre = !!(ins.preOp?.video || ins.preOp?.audio || ins.preOp?.document);
                                                const hasPost = !!(ins.postOp?.video || ins.postOp?.audio || ins.postOp?.document);
                                                const selected = shareInstructionId === ins._id;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={ins._id}
                                                        onClick={() => setShareInstructionId(ins._id)}
                                                        className={`w-full text-left p-3 rounded-xl border transition-all ${selected ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                                                    >
                                                        <p className="font-bold text-sm text-slate-800">{ins.surgeryName}</p>
                                                        {ins.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{ins.description}</p>}
                                                        <div className="flex gap-1.5 mt-1.5">
                                                            <Badge variant="outline" className={`text-[10px] font-bold ${hasPre ? "bg-blue-50 text-blue-700 border-blue-100" : "text-slate-400"}`}>Pre-Op {hasPre ? "✓" : "—"}</Badge>
                                                            <Badge variant="outline" className={`text-[10px] font-bold ${hasPost ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "text-slate-400"}`}>Post-Op {hasPost ? "✓" : "—"}</Badge>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">2. What to Share</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {([
                                                { value: "preOp", label: "Pre-Op" },
                                                { value: "postOp", label: "Post-Op" },
                                                { value: "both", label: "Both" },
                                            ] as const).map(opt => (
                                                <button
                                                    type="button"
                                                    key={opt.value}
                                                    onClick={() => setShareSection(opt.value)}
                                                    className={`h-10 rounded-xl border text-xs font-bold transition-all ${shareSection === opt.value ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">3. Link Expiry Date</label>
                                        <input
                                            type="date"
                                            value={shareExpiry}
                                            min={new Date().toISOString().substring(0, 10)}
                                            onChange={(e) => setShareExpiry(e.target.value)}
                                            className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-3.5 sm:p-5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/60">
                            {shareResult ? (
                                <Button onClick={() => setIsInstructionShareOpen(false)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl">
                                    Done
                                </Button>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={() => setIsInstructionShareOpen(false)} className="font-bold rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleShareInstruction}
                                        disabled={sharingInstruction || !shareInstructionId || !shareExpiry}
                                        className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl"
                                    >
                                        {sharingInstruction ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate QR & Save"}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* LAB REQUESTS MODAL */}
            {isLabRequestOpen && selectedPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-3.5 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800">Lab Request & Reports Manager</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Managing lab details for <span className="font-semibold text-slate-700">{selectedPatient.fullName}</span></p>
                            </div>
                            <button onClick={() => setIsLabRequestOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Request history (Left side) */}
                            <div className="space-y-3 border-r-0 lg:border-r border-slate-100 pr-0 lg:pr-6">
                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Requested Reports</h4>
                                {loadingLabs ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                        <Loader2 className="animate-spin h-8 w-8 mb-2 text-cyan-600" />
                                        <p className="text-sm font-medium">Loading requests...</p>
                                    </div>
                                ) : labRequests.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <Activity className="h-9 w-9 mx-auto mb-2 text-slate-300" />
                                        <p className="text-xs font-semibold">No lab requests recorded for this patient.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5 max-h-[35vh] sm:max-h-[45vh] overflow-y-auto pr-1">
                                        {labRequests.map((req) => (
                                            <Card key={req._id} className="border-slate-100 shadow-none bg-slate-50/40 rounded-xl">
                                                <CardContent className="p-3.5 space-y-2">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <h5 className="font-bold text-slate-800 text-xs sm:text-sm">{req.title}</h5>
                                                        <Badge className={`text-[10px] font-bold ${
                                                            req.status === 'completed'
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50"
                                                            : "bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-50"
                                                        }`}>
                                                            {req.status}
                                                        </Badge>
                                                    </div>
                                                    {req.description && <p className="text-xs text-slate-500">{req.description}</p>}
                                                    {req.totalAmount > 0 && <p className="text-xs font-semibold text-slate-600">Total: LKR {Number(req.totalAmount).toLocaleString()}</p>}
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
                                                                    <Download className="h-3 w-3" /> Download
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Lab Request Inline Preview */}
                                                    {showPreviews[req.recordId] && (
                                                        <div className="mt-2.5 pt-2.5 border-t border-slate-100/60">
                                                            {loadingPreviews[req.recordId] ? (
                                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 py-2 justify-center">
                                                                    <Loader2 className="animate-spin h-3.5 w-3.5 text-cyan-600" />
                                                                    <span>Loading preview...</span>
                                                                </div>
                                                            ) : previews[req.recordId] ? (
                                                                (() => {
                                                                    const preview = previews[req.recordId];
                                                                    const src = preview.fileData.startsWith("data:") ? preview.fileData : `data:${preview.fileType};base64,${preview.fileData}`;
                                                                    
                                                                    if (preview.fileType.startsWith("image/")) {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-lg overflow-hidden bg-slate-100/30 flex items-center justify-center p-1">
                                                                                <img src={src} alt={req.title} className="max-w-full max-h-56 object-contain rounded-md" />
                                                                            </div>
                                                                        );
                                                                    } else if (preview.fileType === "application/pdf") {
                                                                        return (
                                                                            <div className="border border-slate-200/80 rounded-lg overflow-hidden h-[260px] sm:h-[300px]">
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
                            <form onSubmit={handleCreateLabRequest} className="space-y-3.5">
                                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2">Request New Lab Report</h4>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lab Tests *</label>
                                    <LabTestPicker
                                        selectedIds={newLabData.testIds}
                                        onChange={(testIds) => setNewLabData(prev => ({ ...prev, testIds }))}
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Instructions / Notes</label>
                                    <textarea 
                                        rows={3}
                                        placeholder="Add specific instructions for the lab assistant..."
                                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none" 
                                        value={newLabData.description}
                                        onChange={(e) => setNewLabData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>

                                <Button type="submit" disabled={submittingLab} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 rounded-xl shadow-md shadow-cyan-100 flex items-center justify-center gap-1.5 active:scale-95 text-xs sm:text-sm">
                                    {submittingLab ? <Loader2 className="animate-spin h-5 w-5" /> : <><Plus className="h-4 w-4" /> Request Report</>}
                                </Button>
                            </form>
                        </div>
                        
                        <div className="p-3 sm:p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                            <Button onClick={() => setIsLabRequestOpen(false)} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 rounded-xl h-9 text-xs sm:text-sm">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            </main>
        </div>
    );
}