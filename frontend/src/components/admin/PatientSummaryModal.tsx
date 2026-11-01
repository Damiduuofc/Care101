"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileText, FlaskConical, HeartPulse, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { getAdminToken } from "@/lib/adminSession";

interface PatientSummaryModalProps {
    patientId: string;
    patientName?: string;
    queueNumber?: number;
    onClose: () => void;
}

interface PatientSummary {
    fullName: string;
    patientCode?: string;
    age: number | null;
    gender?: string;
    allergies: string;
    medicalConditions: string;
    summary: string[];
    source: "ai" | "fallback" | "data";
    counts: { records: number; pendingLabs: number; surgeries: number };
    generatedAt: string;
}

export default function PatientSummaryModal({ patientId, patientName, queueNumber, onClose }: PatientSummaryModalProps) {
    const [data, setData] = useState<PatientSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchSummary = useCallback(async (refresh = false) => {
        setLoading(true);
        setError("");
        try {
            const token = getAdminToken();
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/chat/patient-summary/${patientId}${refresh ? "?refresh=1" : ""}`,
                {
                    headers: {
                        "x-auth-token": token || "",
                        "ngrok-skip-browser-warning": "true"
                    }
                }
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.msg || "Could not load summary");
            setData(body);
        } catch (err: any) {
            setError(err.message || "Could not load summary");
        } finally {
            setLoading(false);
        }
    }, [patientId]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
            <div
                className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Patient summary"
            >
                <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Pre-consultation summary
                        </p>
                        <h3 className="text-lg font-black text-slate-900 truncate">
                            {queueNumber ? `#${queueNumber} · ` : ""}{data?.fullName || patientName || "Patient"}
                        </h3>
                        {data && (
                            <p className="text-xs text-slate-500">
                                {[data.age != null ? `${data.age} yrs` : null, data.gender, data.patientCode].filter(Boolean).join(" · ")}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" /> Summarising patient history…
                        </div>
                    )}

                    {!loading && error && (
                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
                    )}

                    {!loading && data && (
                        <>
                            <div className={`rounded-lg border p-3 flex gap-2 ${data.allergies ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${data.allergies ? "text-red-600" : "text-slate-400"}`} />
                                <div className="text-sm">
                                    <p className={`font-bold ${data.allergies ? "text-red-800" : "text-slate-600"}`}>Allergies</p>
                                    <p className={data.allergies ? "text-red-700" : "text-slate-500"}>{data.allergies || "None recorded"}</p>
                                </div>
                            </div>

                            {data.medicalConditions && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
                                    <HeartPulse className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                                    <div className="text-sm">
                                        <p className="font-bold text-amber-800">Known conditions</p>
                                        <p className="text-amber-700">{data.medicalConditions}</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Summary</p>
                                <ul className="space-y-1.5">
                                    {data.summary.map((line, i) => (
                                        <li key={i} className="text-sm text-slate-800 flex gap-2">
                                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-cyan-600 shrink-0" />
                                            <span>{line}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                                    <FileText className="h-3 w-3" /> {data.counts.records} records
                                </span>
                                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${data.counts.pendingLabs ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                                    <FlaskConical className="h-3 w-3" /> {data.counts.pendingLabs} pending labs
                                </span>
                                {data.counts.surgeries > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                                        {data.counts.surgeries} surgery records
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {!loading && data && (
                    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/60">
                        <p className="text-[11px] text-slate-500">
                            {data.source === "ai"
                                ? "AI-generated from Care101 records. Verify before clinical use."
                                : data.source === "fallback"
                                    ? "AI unavailable. Showing a basic summary from records."
                                    : "Generated from Care101 records."}
                        </p>
                        <button
                            onClick={() => fetchSummary(true)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-cyan-700 hover:text-cyan-900 shrink-0"
                        >
                            <RefreshCw className="h-3.5 w-3.5" /> Refresh
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
