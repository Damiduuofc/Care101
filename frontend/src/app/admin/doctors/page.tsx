"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Mail,
  IdCard,
  Search,
  Loader2,
  User,
  X,
  Calendar,
  ShieldCheck,
  Phone,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  PlusCircle,
  Pencil,
} from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";
import { useRouter } from "next/navigation";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";
import { departments } from "@/lib/data";

interface Doctor {
  _id: string;
  name: string;
  fullName?: string;
  nameWithInitials?: string;
  email: string;
  specialization: string;
  nic?: string;
  phone?: string;
  slmcReg?: string;
  profileImage?: string;
  isApproved: boolean;
  createdAt: string;
}

export default function AllDoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved">("all");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

  useEffect(() => {
    const storedUser = getAdminUser();
    if (!storedUser || storedUser.role !== "system_admin") {
      clearAdminSession();
      router.push("/admin/dashboard");
      return;
    }
    fetchDoctors();
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchDoctors = async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/all-doctors`, {
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (doctorId: string, approve: boolean) => {
    setActionLoading(doctorId);
    try {
      const token = getAdminToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/all-doctors/${doctorId}/approve`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": token || "",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ isApproved: approve }),
        }
      );

      const data = await res.json();

      if (res.ok) {
        showToast(approve ? "Doctor Approved" : "Status Updated", "success");
        setDoctors((prev) =>
          prev.map((d) => (d._id === doctorId ? { ...d, isApproved: approve } : d))
        );
        if (selectedDoctor?._id === doctorId) {
          setSelectedDoctor((prev) => (prev ? { ...prev, isApproved: approve } : null));
        }
      } else {
        showToast(data.msg || "Failed to update status", "error");
      }
    } catch (err) {
      showToast("Connection error", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // Called by the edit modal with the saved doctor
  const handleDoctorUpdated = (updated: Doctor) => {
    setDoctors((prev) => prev.map((d) => (d._id === updated._id ? { ...d, ...updated } : d)));
    setSelectedDoctor((prev) => (prev && prev._id === updated._id ? { ...prev, ...updated } : prev));
    setEditingDoctor(null);
    showToast("Doctor details updated", "success");
  };

  // Called by the create-account modal once the doctor is successfully created
  const handleDoctorCreated = (newDoctor?: Doctor) => {
    showToast("Doctor account created successfully. Welcome email sent!", "success");
    setShowCreateModal(false);
    fetchDoctors();
  };

const filtered = doctors.filter((d) => {
  const displayName = String(d.fullName || d.nameWithInitials || d.name || "").toLowerCase();
  const search = searchTerm.toLowerCase();
  const matchesSearch =
    displayName.includes(search) ||
    String(d.specialization || "").toLowerCase().includes(search) ||
    String(d.slmcReg || "").toLowerCase().includes(search);

  if (filterStatus === "pending") return matchesSearch && !d.isApproved;
  if (filterStatus === "approved") return matchesSearch && d.isApproved;
  return matchesSearch;
});

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-[#06B6D4]" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold bg-white ${
              toast.type === "success" ? "border-emerald-100 text-emerald-800" : "border-red-100 text-red-800"
            }`}>
              {toast.type === "success" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
              {toast.msg}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Practitioners</h1>
            <p className="text-slate-500 text-sm">Manage verification and access for medical staff.</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex bg-slate-200/60 p-1 rounded-xl">
              {(["all", "pending", "approved"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all capitalize ${
                    filterStatus === status ? "bg-white shadow-sm text-[#06B6D4]" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <Button
              onClick={() => setShowCreateModal(true)}
              style={{ backgroundColor: "#06B6D4" }}
              className="hover:bg-[#0891B2] text-white text-xs font-bold h-9 px-4 rounded-xl shadow-sm shrink-0 flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Account
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or SLMC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
          />
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
            <User className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium">No practitioners found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((doc) => (
              <DoctorCard 
                key={doc._id} 
                doc={doc} 
                isProcessing={actionLoading === doc._id} 
                onView={() => setSelectedDoctor(doc)} 
                onAction={handleApproval}
              />
            ))}
          </div>
        )}

        {/* View/Approve Modal */}
        {selectedDoctor && (
          <DoctorDetailModal
            doctor={selectedDoctor}
            actionLoading={actionLoading}
            onClose={() => setSelectedDoctor(null)}
            onApprove={handleApproval}
            onEdit={() => setEditingDoctor(selectedDoctor)}
          />
        )}

        {/* Edit Details Modal */}
        {editingDoctor && (
          <EditDoctorModal
            doctor={editingDoctor}
            onClose={() => setEditingDoctor(null)}
            onSaved={handleDoctorUpdated}
          />
        )}

        {/* Create Account Modal */}
        {showCreateModal && (
          <CreateDoctorModal
            onClose={() => setShowCreateModal(false)}
            onCreated={handleDoctorCreated}
            showToast={showToast}
          />
        )}
      </main>
    </div>
  );
}

// ─── Elements ───────────────────────────────────────────────────────────

function DoctorCard({ doc, isProcessing, onView, onAction }: any) {
  return (
    <Card 
      onClick={onView}
      className="group cursor-pointer hover:border-[#06B6D4]/50 transition-all duration-300 shadow-sm border-slate-200 bg-white rounded-2xl overflow-hidden"
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
            {doc.profileImage ? <img src={doc.profileImage} className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-slate-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900 truncate">{doc.fullName || doc.name}</h3>
            <p className="text-[11px] text-[#06B6D4] font-bold uppercase tracking-wider truncate">{doc.specialization}</p>
          </div>
        </div>

        <div className="space-y-1.5 mb-5 text-[11px] text-slate-500">
          <div className="flex items-center gap-2 truncate"><Mail className="h-3 w-3 shrink-0" /> {doc.email}</div>
          <div className="flex items-center gap-2"><IdCard className="h-3 w-3 shrink-0" /> {doc.slmcReg || "Pending SLMC"}</div>
        </div>

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {!doc.isApproved ? (
            <>
              <Button 
                size="sm" 
                onClick={() => onAction(doc._id, true)} 
                disabled={isProcessing}
                style={{ backgroundColor: '#06B6D4' }}
                className="flex-[2] hover:bg-[#0891B2] text-white text-[11px] h-8 rounded-lg shadow-sm"
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onAction(doc._id, false)} 
                disabled={isProcessing}
                className="flex-1 border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 text-[11px] h-8 rounded-lg"
              >
                Reject
              </Button>
            </>
          ) : (
            <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onAction(doc._id, false)} 
                disabled={isProcessing}
                className="w-full border-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 text-[11px] h-8 rounded-lg"
            >
                Revoke Access
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DoctorDetailModal({ doctor, actionLoading, onClose, onApprove, onEdit }: any) {
  const isProcessing = actionLoading === doctor._id;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#06B6D4] rounded-lg shadow-[#06B6D4]/20 shadow-md">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <h2 className="font-bold text-slate-900 text-sm">Verification Profile</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-[#0891B2] hover:bg-cyan-50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit details
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center gap-5">
             <div className="h-20 w-20 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {doctor.profileImage ? <img src={doctor.profileImage} className="h-full w-full object-cover" /> : <User className="h-8 w-8 text-slate-200" />}
             </div>
             <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-900 truncate leading-tight">{doctor.fullName || doctor.name}</h3>
                <p className="text-[#06B6D4] text-xs font-bold uppercase mt-1">{doctor.specialization}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    <Calendar className="h-3 w-3" /> Member Since {new Date(doctor.createdAt).getFullYear()}
                </div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1">SLMC Number</p>
                <p className="text-sm font-bold text-slate-700">{doctor.slmcReg || 'N/A'}</p>
             </div>
             <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest mb-1">National ID</p>
                <p className="text-sm font-bold text-slate-700">{doctor.nic || 'N/A'}</p>
             </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <Mail className="h-4 w-4 text-slate-300" />
                <span className="text-xs text-slate-600 font-semibold truncate">{doctor.email}</span>
             </div>
             <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <Phone className="h-4 w-4 text-slate-300" />
                <span className="text-xs text-slate-600 font-semibold">{doctor.phone || "No phone provided"}</span>
             </div>
          </div>

          <div className="pt-4 flex gap-3">
            {!doctor.isApproved ? (
              <>
                <Button 
                  onClick={() => onApprove(doctor._id, true)} 
                  disabled={isProcessing}
                  style={{ backgroundColor: '#06B6D4' }}
                  className="flex-[2] hover:bg-[#0891B2] h-12 rounded-2xl text-xs font-bold shadow-lg shadow-cyan-100 transition-all active:scale-95"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve Account"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => { onApprove(doctor._id, false); onClose(); }} 
                  disabled={isProcessing}
                  className="flex-1 border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 h-12 rounded-2xl text-xs font-bold"
                >
                  Reject
                </Button>
              </>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => onApprove(doctor._id, false)} 
                disabled={isProcessing}
                className="w-full border-red-100 text-red-500 hover:bg-red-50 h-12 rounded-2xl text-xs font-bold"
              >
                Revoke Credentials
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Create Doctor Modal (ported from Doctor Account Provisioning page) ─

function CreateDoctorModal({ onClose, onCreated, showToast }: any) {
  const [fullName, setFullName] = useState("");
  const [nameWithInitials, setNameWithInitials] = useState("");
  const [slmcRegistrationNumber, setSlmcRegistrationNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [nicNumber, setNicNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    generateTempPassword();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateTempPassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = uppercase + lowercase + numbers + symbols;

    let generated = "";
    generated += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    generated += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    generated += numbers.charAt(Math.floor(Math.random() * numbers.length));
    generated += symbols.charAt(Math.floor(Math.random() * symbols.length));

    for (let i = 0; i < 8; i++) {
      generated += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    generated = generated.split("").sort(() => 0.5 - Math.random()).join("");
    setPassword(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !nameWithInitials || !slmcRegistrationNumber || !specialization || !nicNumber || !email || !phoneNumber || !password) {
      showToast("Please fill in all fields.", "error");
      return;
    }

    if (password.length < 8) {
      showToast("Password must be at least 8 characters.", "error");
      return;
    }

    setFormLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-doctor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          fullName,
          nameWithInitials,
          slmcRegistrationNumber,
          specialization,
          nicNumber,
          email,
          phoneNumber,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onCreated(data);
      } else {
        showToast(data.msg || "Failed to create doctor account.", "error");
      }
    } catch (err) {
      showToast("A network error occurred. Please try again.", "error");
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#06B6D4] rounded-lg shadow-[#06B6D4]/20 shadow-md">
              <PlusCircle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Create Doctor Account</h2>
              <p className="text-[11px] text-slate-500">Account is pre-approved and a welcome email is sent immediately.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Name with Initials & SLMC Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Name with Initials
                </label>
                <input
                  type="text"
                  placeholder="e.g. Dr. J. A. Doe"
                  value={nameWithInitials}
                  onChange={(e) => setNameWithInitials(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  SLMC Reg. Number
                </label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. 54321"
                    value={slmcRegistrationNumber}
                    onChange={(e) => setSlmcRegistrationNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Specialization */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Specialization / Department
              </label>
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                required
              >
                <option value="">Select Specialization...</option>
                {departments.map((dept: any) => (
                  <option key={dept.slug} value={dept.name}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* NIC & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  National ID (NIC)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 199012345678"
                  value={nicNumber}
                  onChange={(e) => setNicNumber(e.target.value)}
                  className="w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. +94 77 123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="e.g. doctor@hospital.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Temporary Password
              </label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter or generate password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={generateTempPassword}
                  variant="outline"
                  className="border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
                  title="Generate strong random password"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 border-slate-200 text-slate-600 h-11 rounded-xl text-sm font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={formLoading}
                className="flex-[2] text-white font-semibold text-sm rounded-xl h-11 shadow-md flex items-center justify-center gap-2"
                style={{ backgroundColor: "#06B6D4" }}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    Creating...
                  </>
                ) : (
                  "Create Account & Notify Doctor"
                )}
              </Button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Doctor Modal ──────────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm";

function EditDoctorModal({ doctor, onClose, onSaved }: { doctor: Doctor; onClose: () => void; onSaved: (d: Doctor) => void }) {
  const initial = {
    fullName: doctor.fullName || doctor.name || "",
    nameWithInitials: doctor.nameWithInitials || "",
    specialization: doctor.specialization || "",
    slmcReg: doctor.slmcReg || "",
    nic: doctor.nic || "",
    phone: doctor.phone || "",
    email: doctor.email || "",
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof typeof initial) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const changed = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => form[k].trim() !== initial[k]);
  const missing = !form.fullName.trim() || !form.nameWithInitials.trim() || !form.specialization || !form.slmcReg.trim() || !form.email.trim();
  // Keep a department that isn't in the current list selectable
  const deptOptions = departments.map((d: any) => d.name);
  if (initial.specialization && !deptOptions.includes(initial.specialization)) deptOptions.unshift(initial.specialization);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changed || missing) return;
    setSaving(true);
    setError("");
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/all-doctors/${doctor._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSaved(data.doctor);
      } else {
        setError(data.msg || "Failed to update doctor");
      }
    } catch (err) {
      setError("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#06B6D4] rounded-lg shadow-[#06B6D4]/20 shadow-md">
              <Pencil className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Edit Doctor Details</h2>
              <p className="text-[11px] text-slate-500">The doctor is notified when you save.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input type="text" value={form.fullName} onChange={set("fullName")} className={inputClass} required />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name with Initials</label>
                <input type="text" value={form.nameWithInitials} onChange={set("nameWithInitials")} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SLMC Reg. Number</label>
                <input type="text" value={form.slmcReg} onChange={set("slmcReg")} className={inputClass} required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Specialization / Department</label>
              <select value={form.specialization} onChange={set("specialization")} className={inputClass} required>
                <option value="">Select Specialization...</option>
                {deptOptions.map((name: string) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">National ID (NIC)</label>
                <input type="text" value={form.nic} onChange={set("nic")} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input type="text" value={form.phone} onChange={set("phone")} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input type="email" value={form.email} onChange={set("email")} className={inputClass} required />
              {form.email.trim() !== initial.email && (
                <p className="text-[11px] text-amber-600 mt-1">The doctor will log in with this new email.</p>
              )}
            </div>

            {error && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>
            )}
          </div>

          <div className="flex gap-3 p-6 pt-4 border-t border-slate-50 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-slate-200 text-slate-600 h-11 rounded-xl text-sm font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!changed || missing || saving}
              className="flex-[2] text-white font-semibold text-sm rounded-xl h-11 shadow-md flex items-center justify-center gap-2 bg-[#06B6D4] hover:bg-[#0891B2] disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  Saving...
                </>
              ) : changed ? "Save Changes" : "No changes yet"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
