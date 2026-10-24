"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, DoorOpen, Stethoscope, Users } from "lucide-react";
import { getAdminToken } from "@/lib/adminSession";

interface NurseTodayAssignmentsProps {
    nurseName?: string;
    assignedDoctors: any[];
    appointments: any[];
    /** Narrow layout for use in a half-width dashboard column. */
    compact?: boolean;
}

interface AssignmentRow {
    doctorId: string;
    doctorName: string;
    specialization?: string;
    room: string;
    timeSlot: string;
    sortKey: number;
    currentQueueNumber: number;
    patients: any[];
}

const sameName = (a?: string, b?: string) =>
    !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const today = new Date();
    return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
};

const formatTime = (value: string | Date) =>
    new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function NurseTodayAssignments({ nurseName, assignedDoctors, appointments, compact = false }: NurseTodayAssignmentsProps) {
    const [schedules, setSchedules] = useState<any[]>([]);

    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                const token = getAdminToken();
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/schedule-requests/approved/today`, {
                    headers: {
                        "x-auth-token": token || "",
                        "ngrok-skip-browser-warning": "true"
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) setSchedules(data);
                }
            } catch (err) {
                console.error("Fetch today's schedules error:", err);
            }
        };
        fetchSchedules();
    }, []);

    const getTodayPatients = (doctorId: string) =>
        appointments
            .filter(appt => {
                const apptDocId = appt.doctorId?._id || appt.doctorId;
                return apptDocId === doctorId && isToday(appt.date) && appt.status !== "cancelled" && appt.paymentStatus?.toLowerCase() === "paid";
            })
            .sort((a, b) => (a.queueNumber || 9999) - (b.queueNumber || 9999));

    // Build one row per session: approved schedules allocated to this nurse first,
    // then any assigned doctor that has no schedule entry today.
    const rows: AssignmentRow[] = [];
    const seenDoctors = new Set<string>();

    schedules
        .filter(s => sameName(s.allocatedNurse, nurseName))
        .forEach(s => {
            const doctorId = s.doctorId?._id || s.doctorId;
            const liveDoc = assignedDoctors.find(d => d._id === doctorId);
            seenDoctors.add(doctorId);
            rows.push({
                doctorId,
                doctorName: s.doctorId?.name || s.doctorName,
                specialization: s.doctorId?.specialization || liveDoc?.specialization,
                room: s.allocatedRoom || liveDoc?.allocatedRoom || "",
                timeSlot: `${formatTime(s.startTime)} – ${formatTime(s.endTime)}`,
                sortKey: new Date(s.startTime).getTime(),
                currentQueueNumber: liveDoc?.currentQueueNumber || 0,
                patients: getTodayPatients(doctorId),
            });
        });

    assignedDoctors
        .filter(d => !seenDoctors.has(d._id))
        .forEach(d => {
            rows.push({
                doctorId: d._id,
                doctorName: d.name,
                specialization: d.specialization,
                room: d.allocatedRoom || "",
                timeSlot: d.channelingTime || "Not scheduled",
                sortKey: Number.MAX_SAFE_INTEGER,
                currentQueueNumber: d.currentQueueNumber || 0,
                patients: getTodayPatients(d._id),
            });
        });

    rows.sort((a, b) => a.sortKey - b.sortKey);

    const totalPatients = rows.reduce((sum, r) => sum + r.patients.length, 0);
    const todayLabel = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    return (
        <section className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col ${compact ? "h-full" : "mb-4 sm:mb-6"}`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 ${compact ? "p-4" : "p-4 sm:p-5"}`}>
                <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-cyan-600 shrink-0" />
                        Today&apos;s Assignments
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{todayLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-cyan-50 text-cyan-800 border border-cyan-200/80 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs">
                        <Stethoscope className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                        {rows.length} {rows.length === 1 ? "Session" : "Sessions"}
                    </div>
                    <div className="bg-indigo-50 text-indigo-800 border border-indigo-200/80 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        {totalPatients} {totalPatients === 1 ? "Patient" : "Patients"}
                    </div>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <CalendarDays className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">No sessions are assigned to you today.</p>
                </div>
            ) : (
                <div className={`divide-y divide-slate-100 ${compact ? "flex-1 overflow-y-auto max-h-[28rem]" : ""}`}>
                    {rows.map(row => (
                        <div key={row.doctorId} className={compact ? "p-4 space-y-3" : "p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4"}>
                            <div className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-2"}`}>
                                <div className={compact ? "col-span-3" : "col-span-2"}>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doctor</p>
                                    <p className="text-base font-bold text-slate-800 truncate">{row.doctorName}</p>
                                    {row.specialization && <p className="text-xs text-slate-500 truncate">{row.specialization}</p>}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time Slot</p>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" /> {row.timeSlot}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room</p>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                        <DoorOpen className="h-3.5 w-3.5 text-cyan-600 shrink-0" /> {row.room || "Unassigned"}
                                    </p>
                                </div>
                                <div className={compact ? "" : "col-span-2 sm:col-span-4 lg:col-span-2"}>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Patients</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {row.patients.length}
                                        <span className={`text-xs font-semibold text-slate-500 ${compact ? "block" : "ml-2"}`}>
                                            ({row.patients.filter(p => p.status === "completed").length} done · {row.patients.filter(p => p.status !== "completed").length} remaining)
                                        </span>
                                    </p>
                                </div>
                            </div>

                            <div className="min-w-0">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Patients</p>
                                {row.patients.length === 0 ? (
                                    <p className="text-sm text-slate-400">No patients booked yet.</p>
                                ) : (
                                    <ul className={`grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1 ${compact ? "" : "sm:grid-cols-2"}`}>
                                        {row.patients.map((appt, idx) => {
                                            const queueNo = appt.queueNumber || idx + 1;
                                            const isServing = row.currentQueueNumber > 0 && queueNo === row.currentQueueNumber;
                                            const isDone = appt.status === "completed";
                                            return (
                                                <li
                                                    key={appt._id}
                                                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                                                        isServing ? "bg-emerald-50 border-emerald-200" : isDone ? "bg-slate-50 border-slate-100 text-slate-400" : "bg-white border-slate-200"
                                                    }`}
                                                >
                                                    <span className={`h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-xs font-black ${
                                                        isServing ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {queueNo}
                                                    </span>
                                                    <span className={`truncate font-semibold ${isDone ? "line-through" : "text-slate-800"}`}>
                                                        {appt.patientId?.fullName || "Walk-in Patient"}
                                                    </span>
                                                    {isServing && <span className="ml-auto text-[10px] font-bold text-emerald-700 uppercase shrink-0">Now</span>}
                                                    {!isServing && appt.arrived && !isDone && <span className="ml-auto text-[10px] font-bold text-cyan-700 uppercase shrink-0">Arrived</span>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
