"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Loader2, DoorOpen, Save, Clock, CheckCircle2, AlertTriangle, 
  X, Pencil, Search, Calendar as CalendarIcon, Grid, List, UserCheck, ShieldAlert, Plus, CalendarPlus, UserX 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

// ─── Constants & Configurations ──────────────────────────────────────────────
const ROOM_DEPARTMENTS: Record<string, string> = {
  "Room 1": "Cardiology",
  "Room 2": "Cardiology",
  "Room 3": "Cardiology",
  "Room 4": "Pediatrics",
  "Room 5": "Pediatrics",
  "Room 6": "Pediatrics",
  "Room 7": "Dermatology",
  "Room 8": "Dermatology",
  "Room 9": "Dermatology",
  "Room 10": "Orthopedics",
  "Room 11": "Orthopedics",
  "Room 12": "Orthopedics",
  "Room 13": "General Medicine",
  "Room 14": "General Medicine",
  "Room 15": "General Medicine",
  "Room 16": "General Medicine",
  "Room 17": "General Medicine",
  "Room 18": "General Medicine",
  "Room 19": "General Medicine",
  "Room 20": "General Medicine"
};

// Helper to determine loose department from doctor specialization
const getDoctorDept = (specialization: string) => {
  const spec = (specialization || "").toLowerCase();
  if (spec.includes("cardio")) return "Cardiology";
  if (spec.includes("pedia") || spec.includes("child")) return "Pediatrics";
  if (spec.includes("derma") || spec.includes("skin")) return "Dermatology";
  if (spec.includes("ortho") || spec.includes("bone")) return "Orthopedics";
  return "General Medicine";
};

// Get rooms belonging to a doctor's department
const getRoomsForDoctor = (specialization: string) => {
  const dept = getDoctorDept(specialization);
  return Object.entries(ROOM_DEPARTMENTS)
    .filter(([_, rDept]) => rDept === dept)
    .map(([room]) => room);
};

// Check if two time blocks overlap: (StartA < EndB) && (EndA > StartB)
const checkTimeOverlap = (startA: string, endA: string, startB: string, endB: string) => {
  const tStartA = new Date(startA).getTime();
  const tEndA = new Date(endA).getTime();
  const tStartB = new Date(startB).getTime();
  const tEndB = new Date(endB).getTime();
  return tStartA < tEndB && tEndA > tStartB;
};

// Check if room is booked during a schedule's time slot
const isRoomBooked = (roomName: string, currentSched: any, allSchedules: any[]) => {
  if (!roomName) return false;
  return allSchedules.some(other => {
    if (other._id === currentSched._id) return false;
    if (other.allocatedRoom !== roomName) return false;
    
    // only check overlaps on the same day
    const dateA = new Date(currentSched.date).toDateString();
    const dateB = new Date(other.date).toDateString();
    if (dateA !== dateB) return false;

    return checkTimeOverlap(currentSched.startTime, currentSched.endTime, other.startTime, other.endTime);
  });
};

// Check if nurse is booked during a schedule's time slot
const isNurseBooked = (nurseName: string, currentSched: any, allSchedules: any[]) => {
  if (!nurseName) return false;
  return allSchedules.some(other => {
    if (other._id === currentSched._id) return false;
    if (other.allocatedNurse !== nurseName) return false;

    // only check overlaps on the same day
    const dateA = new Date(currentSched.date).toDateString();
    const dateB = new Date(other.date).toDateString();
    if (dateA !== dateB) return false;

    return checkTimeOverlap(currentSched.startTime, currentSched.endTime, other.startTime, other.endTime);
  });
};

// ─── Interfaces ──────────────────────────────────────────────────────────────
type ToastType = "success" | "warning" | "error";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface Nurse {
  _id: string;
  name: string;
  role: string;
}

interface ScheduleRequest {
  _id: string;
  doctorId: {
    _id: string;
    name: string;
    specialization: string;
    profileImage?: string;
  } | any;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
  allocatedRoom: string;
  allocatedNurse: string;
  status: string;
  isUnlimited?: boolean;
  queueLimit?: number;
}

// ─── Toast System ────────────────────────────────────────────────────────────
function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white transition-all duration-300 pointer-events-auto
            ${t.type === "success" ? "bg-green-600" : t.type === "warning" ? "bg-amber-600" : "bg-red-600"}`}
        >
          {t.type === "success" && <CheckCircle2 className="h-4 w-4" />}
          {t.type === "warning" && <AlertTriangle className="h-4 w-4" />}
          {t.type === "error" && <X className="h-4 w-4" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, remove };
}

// ─── Child Component: Allocation Card ─────────────────────────────────────────
function AllocationCard({ 
  sched, 
  allSchedules, 
  nurses, 
  showToast,
  onLocalUpdate 
}: { 
  sched: ScheduleRequest; 
  allSchedules: ScheduleRequest[];
  nurses: Nurse[]; 
  showToast: (msg: string, type?: ToastType) => void;
  onLocalUpdate: (id: string, field: "allocatedRoom" | "allocatedNurse", value: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const doctorSpec = sched.doctorId?.specialization || "General Medicine";
  const allowedRooms = getRoomsForDoctor(doctorSpec);
  const deptLabel = getDoctorDept(doctorSpec);

  const [isEditing, setIsEditing] = useState(!(sched.allocatedRoom || sched.allocatedNurse));
  const isSaved = !isEditing && (Boolean(sched.allocatedRoom) || Boolean(sched.allocatedNurse));

  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/schedule-requests/${sched._id}/allocate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ 
          allocatedRoom: sched.allocatedRoom, 
          allocatedNurse: sched.allocatedNurse 
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.msg || "Save failed");
      }

      setIsEditing(false);
      showToast("Room and Nurse allocated successfully", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save allocation", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFreeRoom = async () => {
    setIsConfirming(false);
    setIsSaving(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/schedule-requests/${sched._id}/allocate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ 
          allocatedRoom: "", 
          allocatedNurse: "" 
        })
      });

      if (!res.ok) throw new Error("Free failed");

      onLocalUpdate(sched._id, "allocatedRoom", "");
      onLocalUpdate(sched._id, "allocatedNurse", "");
      setIsEditing(true);
      showToast("Room and nurse resources released", "warning");
    } catch {
      showToast("Failed to release resources", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
      <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center gap-4 py-4">
        <div className="h-12 w-12 bg-cyan-600 rounded-full flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0">
          {sched.doctorId?.profileImage ? (
            <img src={sched.doctorId.profileImage} alt={sched.doctorName} className="w-full h-full object-cover" />
          ) : (
            sched.doctorName.charAt(0)
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-slate-800 font-bold">{sched.doctorName}</CardTitle>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-100">
              {deptLabel}
            </span>
          </div>
          <CardDescription className="text-xs text-slate-500 font-medium mt-0.5">{doctorSpec}</CardDescription>
          <div className="flex items-center gap-1 mt-1 text-xs text-[#06b6d4] font-bold">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(sched.startTime)} – {formatTime(sched.endTime)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {isSaved && (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
            <div className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Allocation active & locked
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 text-green-700 hover:text-green-900 font-semibold underline underline-offset-2"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
              <DoorOpen className="h-3.5 w-3.5" /> Department Rooms
            </label>
            <select
              disabled={!isEditing || isSaving}
              className={`w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors
                ${!isEditing || isSaving ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200"}`}
              value={sched.allocatedRoom}
              onChange={e => onLocalUpdate(sched._id, "allocatedRoom", e.target.value)}
            >
              <option value="">Select Room</option>
              {allowedRooms.map(roomName => {
                const isBookedElsewhere = isRoomBooked(roomName, sched, allSchedules);
                return (
                  <option 
                    key={roomName} 
                    value={roomName} 
                    disabled={isBookedElsewhere}
                    className={isBookedElsewhere ? "text-slate-300" : ""}
                  >
                    {roomName} {isBookedElsewhere ? "(Booked)" : ""}
                  </option>
                );
              })}
            </select>
            <p className="text-[10px] text-slate-400 italic">Only displays {deptLabel} rooms</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Assigned Nurse</label>
            <select
              disabled={!isEditing || isSaving}
              className={`w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors
                ${!isEditing || isSaving ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200"}`}
              value={sched.allocatedNurse}
              onChange={e => onLocalUpdate(sched._id, "allocatedNurse", e.target.value)}
            >
              <option value="">Select Nurse</option>
              {nurses.map(n => {
                const isBookedElsewhere = isNurseBooked(n.name, sched, allSchedules);
                return (
                  <option 
                    key={n._id} 
                    value={n.name}
                    disabled={isBookedElsewhere}
                    className={isBookedElsewhere ? "text-slate-300" : ""}
                  >
                    {n.name} {isBookedElsewhere ? "(Booked)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || isSaved || !sched.allocatedRoom || !sched.allocatedNurse}
            className={`flex-1 text-xs text-white transition-colors ${
              isSaved ? "bg-green-600 hover:bg-green-600 cursor-default" : "bg-cyan-600 hover:bg-cyan-700"
            }`}
          >
            {isSaving ? (
              <Loader2 className="animate-spin h-4 w-4" />
            ) : isSaved ? (
              <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Saved</>
            ) : (
              <><Save className="mr-1.5 h-4 w-4" /> Confirm Pair</>
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsConfirming(true)}
            disabled={isSaving || isConfirming || (!sched.allocatedRoom && !sched.allocatedNurse)}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs"
          >
            Release resources
          </Button>
        </div>

        {isConfirming && (
          <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-semibold">Release Room + Nurse resources?</span>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsConfirming(false)}
                className="h-7 px-3 text-xs border-red-200 text-red-600 hover:bg-red-100"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleFreeRoom}
                className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                Yes, Release
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RoomAllocation() {
  const router = useRouter();
  const { toasts, show: showToast, remove: removeToast } = useToast();

  const [schedules, setSchedules] = useState<ScheduleRequest[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  
  const [viewMode, setViewMode] = useState<"grid" | "list" | "requests">("grid");
  const [filterRequestsByDate, setFilterRequestsByDate] = useState(false);

  // Manual Allocation Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDocId, setModalDocId] = useState("");
  const [modalRoom, setModalRoom] = useState("");
  const [modalNurse, setModalNurse] = useState("");
  const [modalStartTime, setModalStartTime] = useState("08:00");
  const [modalEndTime, setModalEndTime] = useState("10:00");
  const [modalSaving, setModalSaving] = useState(false);

  // Approval Resource Dialog States
  const [approvalDialogReq, setApprovalDialogReq] = useState<any | null>(null);
  const [approvalRoom, setApprovalRoom] = useState("");
  const [approvalNurse, setApprovalNurse] = useState("");
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  useEffect(() => {
    const storedUser = getAdminUser();
    if (!storedUser || storedUser.role !== "receptionist") {
      clearAdminSession();
      router.push("/admin/dashboard");
    }
  }, [router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAdminToken() || "";
      const headers = { "Authorization": `Bearer ${token}`, "x-auth-token": token, "ngrok-skip-browser-warning": "true" };
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;

      const [resSchedules, resStaff, resDoctors] = await Promise.all([
        fetch(`${baseUrl}/schedule-requests/approved/today?all=true`, { headers }).catch(() => null),
        fetch(`${baseUrl}/admin/staff`, { headers }).catch(() => null),
        fetch(`${baseUrl}/admin/doctors`, { headers }).catch(() => null)
      ]);

      const fetchedSchedules = resSchedules?.ok ? await resSchedules.json() : [];
      const allStaff = resStaff?.ok ? await resStaff.json() : [];
      const fetchedDoctors = resDoctors?.ok ? await resDoctors.json() : [];

      setSchedules(fetchedSchedules);
      setNurses(Array.isArray(allStaff) ? allStaff.filter(s => s.role === "nurse") : []);
      setAllDoctors(fetchedDoctors);
    } catch (err) {
      console.error("Fetch Data Error:", err);
      showToast("Failed to load approved schedules", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lifted state handler
  const handleUpdateAllocation = (id: string, field: "allocatedRoom" | "allocatedNurse", value: string) => {
    setSchedules(prev => prev.map(s => 
      s._id === id ? { ...s, [field]: value } : s
    ));
  };

  // Find loose specialization for chosen manual doctor
  const selectedDoctorInfo = useMemo(() => {
    return allDoctors.find(d => d._id === modalDocId);
  }, [modalDocId, allDoctors]);

  const allowedRoomsForModal = useMemo(() => {
    if (!selectedDoctorInfo) return [];
    return getRoomsForDoctor(selectedDoctorInfo.specialization);
  }, [selectedDoctorInfo]);

  // Time format helper
  const formatTime = (timeStr: string) => {
    return new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get color styles for timeline blocks
  const getDeptColorStyle = (specialization: string) => {
    const dept = getDoctorDept(specialization);
    switch (dept) {
      case "Cardiology":
        return "bg-purple-50 border border-purple-200 text-purple-900";
      case "Pediatrics":
        return "bg-emerald-50 border border-emerald-200 text-emerald-950";
      case "Dermatology":
        return "bg-cyan-50 border border-cyan-200 text-cyan-950";
      case "Orthopedics":
        return "bg-blue-50 border border-blue-200 text-blue-950";
      default:
        return "bg-slate-50 border border-slate-200 text-slate-800";
    }
  };

  // Filter approved schedules for selectedDate only (used for Grid and Session List)
  const schedulesForSelectedDate = useMemo(() => {
    return schedules.filter(s => {
      const dateA = new Date(s.date).toDateString();
      const dateB = new Date(selectedDate).toDateString();
      return dateA === dateB;
    });
  }, [schedules, selectedDate]);

  // Filter unallocated approved schedule requests (approved, but missing room/nurse pairing, not outdated)
  const unallocatedSchedules = useMemo(() => {
    const now = new Date();
    return schedules.filter(s => {
      if (s.status !== "approved" || (s.allocatedRoom && s.allocatedNurse)) return false;
      const endTime = new Date(s.endTime);
      return endTime > now;
    });
  }, [schedules]);

  // Check manual conflicts locally
  const modalConflictMessage = useMemo(() => {
    if (!modalDocId || !modalRoom || !modalNurse || !modalStartTime || !modalEndTime) return null;
    
    const start = new Date(`${selectedDate}T${modalStartTime}:00`).getTime();
    const end = new Date(`${selectedDate}T${modalEndTime}:00`).getTime();

    if (end <= start) return "End time must be strictly after start time.";

    // Check Room conflicts
    const roomConflict = schedulesForSelectedDate.find(s => {
      if (s.allocatedRoom !== modalRoom) return false;
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      return start < sEnd && end > sStart;
    });
    if (roomConflict) {
      return `⚠️ Room Conflict: ${modalRoom} is already booked by Dr. ${roomConflict.doctorName} at this time (${formatTime(roomConflict.startTime)} – ${formatTime(roomConflict.endTime)}).`;
    }

    // Check Nurse conflicts
    const nurseConflict = schedulesForSelectedDate.find(s => {
      if (s.allocatedNurse !== modalNurse) return false;
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      return start < sEnd && end > sStart;
    });
    if (nurseConflict) {
      return `⚠️ Nurse Conflict: Nurse ${modalNurse} is already allocated to Dr. ${nurseConflict.doctorName} at this time (${formatTime(nurseConflict.startTime)} – ${formatTime(nurseConflict.endTime)}).`;
    }

    return null;
  }, [modalDocId, modalRoom, modalNurse, modalStartTime, modalEndTime, selectedDate, schedulesForSelectedDate]);

  // Check pending request conflicts locally
  const modalApprovalConflictMessage = useMemo(() => {
    if (!approvalDialogReq || !approvalRoom || !approvalNurse) return null;
    
    const isRBooked = isRoomBooked(approvalRoom, approvalDialogReq, schedules);
    if (isRBooked) {
      return `⚠️ Conflict: Room ${approvalRoom} is already booked at this time by another approved doctor session.`;
    }

    const isNBooked = isNurseBooked(approvalNurse, approvalDialogReq, schedules);
    if (isNBooked) {
      return `⚠️ Conflict: Nurse ${approvalNurse} is already assigned at this time to another approved doctor session.`;
    }

    return null;
  }, [approvalDialogReq, approvalRoom, approvalNurse, schedules]);

  // Handle manual allocation saving
  const handleSaveManualAllocation = async () => {
    if (modalConflictMessage) {
      showToast(modalConflictMessage, "error");
      return;
    }
    
    setModalSaving(true);
    try {
      const token = getAdminToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const startDateTime = new Date(`${selectedDate}T${modalStartTime}:00`);
      const endDateTime = new Date(`${selectedDate}T${modalEndTime}:00`);

      // 1. Create approved schedule
      const createRes = await fetch(`${baseUrl}/schedule-requests/admin/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({
          doctorId: modalDocId,
          date: selectedDate,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          isUnlimited: true
        })
      });

      if (!createRes.ok) {
        const errorData = await createRes.json();
        throw new Error(errorData.msg || "Failed to create schedule session");
      }

      const createData = await createRes.json();
      const requestId = createData.request?._id;

      // 2. Allocate room and nurse
      const allocateRes = await fetch(`${baseUrl}/schedule-requests/${requestId}/allocate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({
          allocatedRoom: modalRoom,
          allocatedNurse: modalNurse
        })
      });

      if (!allocateRes.ok) throw new Error("Failed to allocate resources");

      showToast("Manual Allocation pairing saved successfully", "success");
      setIsModalOpen(false);
      
      // Reset form
      setModalDocId("");
      setModalRoom("");
      setModalNurse("");
      setModalStartTime("08:00");
      setModalEndTime("10:00");
      
      // Refresh list
      fetchData();
    } catch (err: any) {
      showToast(err.message || "Manual allocation failed", "error");
    } finally {
      setModalSaving(false);
    }
  };

  // Handle pending schedule approval + resource allocation
  const handleConfirmApproval = async (id: string) => {
    if (!approvalRoom || !approvalNurse) {
      alert("Please select both a Room and a Nurse.");
      return;
    }
    
    setApprovalSubmitting(true);
    try {
      const token = getAdminToken() || "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/schedule-requests/${id}/allocate`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-auth-token": token
        },
        body: JSON.stringify({ 
          allocatedRoom: approvalRoom,
          allocatedNurse: approvalNurse
        }) 
      });
      
      if (res.ok) {
        showToast("Room and Nurse allocated successfully", "success");
        setApprovalDialogReq(null);
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.msg || "Failed to allocate resources");
      }
    } catch (error) {
      console.error("Allocation Error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const filteredSchedules = useMemo(() => {
    return schedulesForSelectedDate.filter(s => 
      s.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.doctorId?.specialization && s.doctorId.specialization.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.allocatedRoom && s.allocatedRoom.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.allocatedNurse && s.allocatedNurse.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [schedulesForSelectedDate, searchQuery]);

  const filteredUnallocatedRequests = useMemo(() => {
    return unallocatedSchedules.filter(s => {
      const matchesSearch = s.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (s.doctorId?.specialization && s.doctorId.specialization.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      if (filterRequestsByDate) {
        const dateA = new Date(s.date).toDateString();
        const dateB = new Date(selectedDate).toDateString();
        return dateA === dateB;
      }
      return true;
    });
  }, [unallocatedSchedules, searchQuery, filterRequestsByDate, selectedDate]);

  // Group allocations for the visual grid timeline by room name
  const getRoomAllocations = (roomName: string) => {
    return schedulesForSelectedDate.filter(s => s.allocatedRoom === roomName)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8 ml-0 md:ml-64 bg-slate-50 min-h-screen">
      <Sidebar />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <DoorOpen className="text-cyan-600 h-8 w-8" /> Room Allocation
          </h1>
          <p className="text-slate-500 mt-1">Allocate examination rooms and nurse resources dynamically with custom times.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm h-11">
            <CalendarIcon className="h-4 w-4 text-cyan-600" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="outline-none text-sm font-semibold text-slate-700 bg-transparent cursor-pointer"
            />
          </div>

          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold h-11 shadow"
          >
            <Plus className="mr-2 h-4 w-4" /> Allocate Room
          </Button>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search doctor, specialization, room or nurse..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors bg-slate-50"
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === "grid" 
                ? "bg-white text-cyan-700 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Grid className="h-3.5 w-3.5" /> Visual Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === "list" 
                ? "bg-white text-cyan-700 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Session List
          </button>
          <button
            onClick={() => setViewMode("requests")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all relative ${
              viewMode === "requests" 
                ? "bg-white text-cyan-700 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="h-3.5 w-3.5" /> Request Room
            {unallocatedSchedules.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[9px] font-extrabold text-white animate-pulse">
                {unallocatedSchedules.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-20 flex flex-col justify-center items-center gap-3">
          <Loader2 className="animate-spin text-cyan-600 h-8 w-8" />
          <span className="text-sm font-semibold text-slate-500">Loading allocations...</span>
        </div>
      ) : (
        <>
          {viewMode === "grid" && (
            <Card className="border-slate-200 overflow-hidden shadow-sm">
              <CardHeader className="bg-white border-b border-slate-100 py-4 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">Visual Allocation Timeline</CardTitle>
                <CardDescription className="text-xs">
                  Real-time timeline slots for Room + Nurse pairings for {new Date(selectedDate).toDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-slate-100">
                {Object.entries(ROOM_DEPARTMENTS).map(([roomName, dept]) => {
                  const roomAllocations = getRoomAllocations(roomName);

                  return (
                    <div key={roomName} className="p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Room Department Name */}
                        <div className="min-w-[200px]">
                          <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <DoorOpen className="h-4 w-4 text-slate-400" />
                            {roomName}
                          </span>
                          <span className="text-[10px] text-cyan-600 font-semibold uppercase tracking-wider block ml-5">
                            {dept}
                          </span>
                        </div>

                        {/* Timeline slots for the room */}
                        <div className="flex flex-1 flex-wrap gap-3 items-center">
                          {roomAllocations.length === 0 ? (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                                Available (No bookings scheduled)
                              </span>

                              <button
                                onClick={() => {
                                  setModalRoom(roomName);
                                  setIsModalOpen(true);
                                }}
                                className="text-[11px] font-bold text-cyan-600 hover:text-cyan-700 hover:underline flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" /> Quick Allocate
                              </button>
                            </div>
                          ) : (
                            roomAllocations.map(alloc => (
                              <div 
                                key={alloc._id} 
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs shadow-sm ${getDeptColorStyle(alloc.doctorId?.specialization)}`}
                              >
                                <div>
                                  <p className="font-bold text-slate-900">{alloc.doctorName}</p>
                                  <p className="text-[9px] opacity-75">{alloc.doctorId?.specialization || "Physician"}</p>
                                </div>
                                <div className="border-l border-slate-200/60 pl-3">
                                  <p className="font-bold text-slate-800 flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-cyan-600" />
                                    {formatTime(alloc.startTime)} – {formatTime(alloc.endTime)}
                                  </p>
                                  <p className="text-[10px] font-semibold mt-0.5 text-slate-600">
                                    👤 Nurse: <span className="font-bold">{alloc.allocatedNurse || "TBA"}</span>
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {viewMode === "list" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredSchedules.length === 0 ? (
                <div className="col-span-2 text-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-semibold">No approved and allocated schedules found for this date.</p>
                </div>
              ) : (
                filteredSchedules.map(sched => (
                  <AllocationCard 
                    key={sched._id} 
                    sched={sched} 
                    allSchedules={schedules} 
                    nurses={nurses} 
                    showToast={showToast} 
                    onLocalUpdate={handleUpdateAllocation}
                  />
                ))
              )}
            </div>
          )}

          {/* Pending Request Room View */}
          {viewMode === "requests" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm w-fit mb-2">
                <input 
                  type="checkbox"
                  id="filterRequestsDate"
                  checked={filterRequestsByDate}
                  onChange={(e) => setFilterRequestsByDate(e.target.checked)}
                  className="h-4 w-4 rounded text-cyan-600 focus:ring-cyan-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="filterRequestsDate" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                  Filter requests by selected date ({new Date(selectedDate).toLocaleDateString()})
                </label>
              </div>

              {filteredUnallocatedRequests.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <UserX className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-semibold">
                    {filterRequestsByDate 
                      ? `No unallocated doctor schedules found for ${new Date(selectedDate).toLocaleDateString()}.`
                      : "All approved schedules have been successfully allocated."}
                  </p>
                </div>
              ) : (
                filteredUnallocatedRequests.map(req => (
                  <Card key={req._id} className="border-slate-200 shadow-sm hover:shadow transition-shadow bg-white">
                    <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
                      {/* Doctor Profile */}
                      <div className="flex items-center gap-4 w-full md:w-1/3">
                        <div className="h-12 w-12 bg-cyan-600 rounded-full flex items-center justify-center font-bold text-white overflow-hidden flex-shrink-0">
                          {req.doctorId?.profileImage ? (
                            <img src={req.doctorId.profileImage} alt={req.doctorName} className="w-full h-full object-cover" />
                          ) : (
                            req.doctorName.charAt(0)
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 leading-tight">{req.doctorName}</h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                            {req.doctorId?.specialization || "Physician"}
                          </p>
                        </div>
                      </div>

                      {/* Request Details */}
                      <div className="flex flex-wrap items-center gap-5 w-full md:w-auto">
                        <div className="flex items-center gap-2 text-slate-600 text-xs">
                          <CalendarIcon className="h-4 w-4 text-cyan-600" />
                          <span className="font-semibold">{new Date(req.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 text-xs">
                          <Clock className="h-4 w-4 text-cyan-600" />
                          <span className="font-semibold">{formatTime(req.startTime)} – {formatTime(req.endTime)}</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {req.isUnlimited ? "∞ Unlimited" : `${req.queueLimit || 0} Slots`}
                        </span>
                      </div>

                      {/* Approval Action */}
                      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <Button
                          onClick={() => {
                            setApprovalDialogReq(req);
                            setApprovalRoom("");
                            setApprovalNurse("");
                          }}
                          className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow"
                        >
                          Allocate Room & Nurse
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Manual Allocation Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center py-4">
              <div>
                <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-1.5">
                  <CalendarPlus className="text-cyan-600 h-5 w-5" /> Allocate Custom Session
                </CardTitle>
                <CardDescription className="text-xs">Create and pair resources for any doctor</CardDescription>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              {/* Doctor select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Select Doctor *</label>
                <select 
                  value={modalDocId}
                  onChange={(e) => {
                    setModalDocId(e.target.value);
                    setModalRoom(""); // reset room as department changes
                  }}
                  className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                >
                  <option value="">Choose Doctor...</option>
                  {allDoctors.map(d => (
                    <option key={d._id} value={d._id}>{d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              {/* Room select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                  <span>Room Number *</span>
                  {selectedDoctorInfo && (
                    <span className="text-[10px] text-cyan-600 font-bold lowercase">
                      ({getDoctorDept(selectedDoctorInfo.specialization)} rooms)
                    </span>
                  )}
                </label>
                <select 
                  value={modalRoom}
                  onChange={(e) => setModalRoom(e.target.value)}
                  disabled={!modalDocId}
                  className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">Choose Room...</option>
                  {allowedRoomsForModal.map(room => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>

              {/* Nurse select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Assigned Nurse *</label>
                <select 
                  value={modalNurse}
                  onChange={(e) => setModalNurse(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                >
                  <option value="">Choose Nurse...</option>
                  {nurses.map(n => (
                    <option key={n._id} value={n.name}>{n.name}</option>
                  ))}
                </select>
              </div>

              {/* Custom Time Slot */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Start Time *</label>
                  <input 
                    type="time" 
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase">End Time *</label>
                  <input 
                    type="time" 
                    value={modalEndTime}
                    onChange={(e) => setModalEndTime(e.target.value)}
                    className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                  />
                </div>
              </div>

              {/* Conflict indicator / warnings */}
              {modalConflictMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="font-semibold leading-relaxed">{modalConflictMessage}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setIsModalOpen(false)}
                  variant="outline"
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveManualAllocation}
                  disabled={modalSaving || !!modalConflictMessage || !modalDocId || !modalRoom || !modalNurse}
                  className="flex-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {modalSaving ? <Loader2 className="animate-spin h-4 w-4" /> : "Save Allocation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- APPROVAL RESOURCE PAIR ALLOCATION DIALOG --- */}
      {approvalDialogReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-md bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row justify-between items-center py-4 px-6">
              <div>
                <h3 className="text-base text-slate-800 font-bold">Allocate Resources</h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign Room and Nurse for Dr. {approvalDialogReq.doctorName}</p>
              </div>
              <button 
                onClick={() => setApprovalDialogReq(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </CardHeader>

            <CardContent className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1">
                <p className="text-slate-600"><strong>Specialization:</strong> {approvalDialogReq.doctorId?.specialization || approvalDialogReq.specialization || "General Medicine"}</p>
                <p className="text-slate-600"><strong>Date:</strong> {new Date(approvalDialogReq.date).toLocaleDateString()}</p>
                <p className="text-slate-600"><strong>Time:</strong> {formatTime(approvalDialogReq.startTime)} – {formatTime(approvalDialogReq.endTime)}</p>
              </div>

              {/* Room select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase flex items-center justify-between">
                  <span>Select Room *</span>
                  <span className="text-[10px] text-cyan-600 font-bold lowercase">
                    ({getDoctorDept(approvalDialogReq.doctorId?.specialization || approvalDialogReq.specialization)} rooms)
                  </span>
                </label>
                <select 
                  value={approvalRoom}
                  onChange={(e) => setApprovalRoom(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                >
                  <option value="">Choose Room...</option>
                  {getRoomsForDoctor(approvalDialogReq.doctorId?.specialization || approvalDialogReq.specialization).map(room => {
                    const isBookedValue = isRoomBooked(room, approvalDialogReq, schedules);
                    return (
                      <option 
                        key={room} 
                        value={room} 
                        disabled={isBookedValue}
                        className={isBookedValue ? "text-slate-300" : ""}
                      >
                        {room} {isBookedValue ? "(Booked)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Nurse select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Assigned Nurse *</label>
                <select 
                  value={approvalNurse}
                  onChange={(e) => setApprovalNurse(e.target.value)}
                  className="w-full h-10 px-3 py-2 rounded-md border text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white border-slate-200"
                >
                  <option value="">Choose Nurse...</option>
                  {nurses.map(n => {
                    const isBookedValue = isNurseBooked(n.name, approvalDialogReq, schedules);
                    return (
                      <option 
                        key={n._id} 
                        value={n.name}
                        disabled={isBookedValue}
                        className={isBookedValue ? "text-slate-300" : ""}
                      >
                        {n.name} {isBookedValue ? "(Booked)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Conflict Check Info */}
              {modalApprovalConflictMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span className="font-semibold leading-relaxed">{modalApprovalConflictMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setApprovalDialogReq(null)}
                  variant="outline"
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleConfirmApproval(approvalDialogReq._id)}
                  disabled={approvalSubmitting || !!modalApprovalConflictMessage || !approvalRoom || !approvalNurse}
                  className="flex-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                >
                  {approvalSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : "Save Allocation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Auto-Release Explainer Info */}
      <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl flex gap-3 text-xs text-slate-600 shadow-inner">
        <ShieldAlert className="h-5 w-5 text-cyan-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-800">Room Allocation System Notes</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Rooms are partitioned strictly by department (e.g. Rooms 1-3 for Cardiology).</li>
            <li>Bookings are time-slot-based. An exam room can be booked by different doctors at separate non-overlapping intervals on the same day.</li>
            <li>Both Room and Nurse are locked together. Overlapping bookings for the same Room OR Nurse are rejected by the system automatically.</li>
            <li>**Automatic Release**: The system will automatically free the room and nurse as soon as the session's scheduled end time passes.</li>
          </ul>
        </div>
      </div>

      <ToastContainer toasts={toasts} remove={removeToast} />
    </div>
  );
}
