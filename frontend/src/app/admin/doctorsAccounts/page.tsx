"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  Mail,
  IdCard,
  Phone,
  User,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Stethoscope,
  PlusCircle
} from "lucide-react";
import { departments } from "@/lib/data";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

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
  createdAt: string;
  isApproved: boolean;
}

export default function DoctorsAccountsPage() {
  const router = useRouter();

  // Form states
  const [fullName, setFullName] = useState("");
  const [nameWithInitials, setNameWithInitials] = useState("");
  const [slmcRegistrationNumber, setSlmcRegistrationNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [nicNumber, setNicNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

  // UI/UX States
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = getAdminUser();
    if (!storedUser || storedUser.role !== "system_admin") {
      clearAdminSession();
      router.push("/admin/dashboard");
      return;
    }
    fetchDoctors();
    generateTempPassword();
  }, [router]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

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

    // Shuffle password chars
    generated = generated.split("").sort(() => 0.5 - Math.random()).join("");
    setPassword(generated);
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
      console.error("Fetch doctors error:", err);
    } finally {
      setListLoading(false);
    }
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
        showToast("Doctor account created successfully. Welcome email sent!", "success");
        // Clear fields except password (which we re-generate)
        setFullName("");
        setNameWithInitials("");
        setSlmcRegistrationNumber("");
        setSpecialization("");
        setNicNumber("");
        setEmail("");
        setPhoneNumber("");
        generateTempPassword();
        fetchDoctors();
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

  const handleStatusChange = async (doctorId: string, approve: boolean) => {
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
        showToast(approve ? "Doctor Approved" : "Access Revoked", "success");
        setDoctors((prev) =>
          prev.map((d) => (d._id === doctorId ? { ...d, isApproved: approve } : d))
        );
      } else {
        showToast(data.msg || "Failed to update status", "error");
      }
    } catch (err) {
      showToast("Connection error", "error");
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredDoctors = doctors.filter((d) => {
    const searchStr = searchTerm.toLowerCase();
    const dispName = (d.fullName || d.name || "").toLowerCase();
    return (
      dispName.includes(searchStr) ||
      d.email.toLowerCase().includes(searchStr) ||
      (d.slmcReg || "").toLowerCase().includes(searchStr) ||
      (d.specialization || "").toLowerCase().includes(searchStr)
    );
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <main className="md:ml-64 p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
        
        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold bg-white ${
              toast.type === "success" ? "border-emerald-100 text-emerald-800" : "border-red-100 text-red-800"
            }`}>
              {toast.type === "success" ? (
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 shrink-0" />
              )}
              {toast.msg}
            </div>
          </div>
        )}

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-[#06B6D4]" />
            Doctor Account Provisioning
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Create new practitioner profiles, set credentials, and instantly dispatch a welcome email.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Creation Form */}
          <div className="lg:col-span-7">
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-[#06B6D4]" />
                  Create Doctor Account
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs">
                  New accounts are pre-approved. Logins are available immediately on the Care101 mobile app.
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* Row 1: Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Dr. Johnathan Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 2: Name with Initials & SLMC Number */}
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

                  {/* Row 3: Specialization Dropdown */}
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
                      {departments.map((dept) => (
                        <option key={dept.slug} value={dept.name}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Row 4: NIC & Phone Number */}
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

                  {/* Row 5: Email */}
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

                  {/* Row 6: Temporary Password with Generator */}
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

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={formLoading}
                    className="w-full text-white mt-4 font-semibold text-sm rounded-xl py-2.5 shadow-md flex items-center justify-center gap-2"
                    style={{ backgroundColor: "#06B6D4" }}
                  >
                    {formLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        Creating Account & Sending Mail...
                      </>
                    ) : (
                      "Create Account & Notify Doctor"
                    )}
                  </Button>

                </form>
              </CardContent>
            </Card>
          </div>

          {/* List Section */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search registered doctors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#06B6D4]/10 focus:border-[#06B6D4] transition-all shadow-sm"
              />
            </div>

            {/* Doctors list container */}
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white flex-1 overflow-hidden flex flex-col min-h-[450px]">
              <div className="border-b border-slate-100 bg-slate-50/50 p-4 shrink-0">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Registered Doctors ({filteredDoctors.length})
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[600px] p-4 divide-y divide-slate-100">
                {listLoading ? (
                  <div className="h-full flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-[#06B6D4]" />
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 text-sm">
                    No doctors found.
                  </div>
                ) : (
                  filteredDoctors.map((doc) => (
                    <div key={doc._id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3 justify-between">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200/50 text-slate-500 font-bold text-sm">
                          {doc.fullName ? doc.fullName.charAt(0) : doc.name ? doc.name.charAt(0) : "D"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {doc.fullName || doc.name}
                          </p>
                          <p className="text-[10px] text-[#06B6D4] font-bold uppercase tracking-wider truncate">
                            {doc.specialization}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            <span className="truncate">{doc.email}</span>
                            <span>•</span>
                            <span>SLMC: {doc.slmcReg || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons or status indicator */}
                      <div className="shrink-0 flex flex-col items-end gap-1.5 ml-2">
                        {doc.isApproved ? (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 gap-1">
                              <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                              Approved
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatusChange(doc._id, false)}
                              disabled={actionLoading === doc._id}
                              className="text-[10px] h-6 px-2 border-slate-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100 rounded-lg font-bold"
                            >
                              {actionLoading === doc._id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Revoke Access"
                              )}
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-100 gap-1">
                              <span className="h-1 w-1 rounded-full bg-amber-500"></span>
                              Pending
                            </span>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleStatusChange(doc._id, true)}
                                disabled={actionLoading === doc._id}
                                style={{ backgroundColor: "#06B6D4" }}
                                className="text-[10px] h-6 px-2.5 hover:bg-[#0891B2] text-white rounded-lg font-bold shadow-sm"
                              >
                                {actionLoading === doc._id ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-white" />
                                ) : (
                                  "Approve"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(doc._id, false)}
                                disabled={actionLoading === doc._id}
                                className="text-[10px] h-6 px-2 border-slate-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100 rounded-lg font-bold"
                              >
                                Reject
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

          </div>

        </div>

      </main>
    </div>
  );
}