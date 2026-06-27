"use client";

import { useEffect, useState } from "react";
import {
 Eye, EyeOff, UserPlus, Trash2, Mail, Lock, Building, Briefcase, Loader2, Key, Copy, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/admin/Sidebar";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Reset Password State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
const [showPassword, setShowPassword] = useState(false);
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "nurse", // Default
    department: ""
  });

  // 1. Fetch Staff List
  const fetchStaff = async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/staff`, {
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true" 
        }
      });

      if (!res.ok) return;
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;

      const data = await res.json();
      setStaffList(data);
    } catch (err) {
      console.error("Failed to fetch staff", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const parsed = getAdminUser();
    if (parsed) {
      if (parsed.role !== "system_admin") {
        if (parsed.role === "receptionist") {
          window.location.href = "/admin/receptionist-dashboard";
        } else {
          window.location.href = "/admin/dashboard";
        }
        return;
      }
    } else {
      clearAdminSession();
      window.location.href = "/admin/login";
      return;
    }
    fetchStaff();
  }, []);

  // 2. Add New Staff
  const handleAddStaff = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.department) {
      alert("Please fill in all fields");
      return;
    }

    setSubmitLoading(true);
    const token = getAdminToken();

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-staff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true" 
        },
        body: JSON.stringify(formData)
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        alert("Server Error: Invalid response format");
        return;
      }

      const data = await res.json();

      if (res.ok) {
        alert("Staff Member Created Successfully!");
        setIsModalOpen(false);
        setFormData({ name: "", email: "", password: "", role: "nurse", department: "" });
        fetchStaff();
      } else {
        alert(`Error: ${data.msg}`);
      }
    } catch (error) {
      console.error("Add staff error:", error);
      alert("Server Error");
    } finally {
      setSubmitLoading(false);
    }
  };

  // 3. Remove Staff
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member? Access will be revoked immediately.")) return;

    const token = getAdminToken();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/staff/${id}`, {
        method: "DELETE",
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });

      if (res.ok) {
        setStaffList(staffList.filter(s => s._id !== id)); 
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          alert(data.msg);
        } else {
          alert("Failed to delete staff member");
        }
      }
    } catch (err) {
      console.error("Delete failed", err);
      alert("Server Error");
    }
  };

// 4. Handle Password Reset Generation
  const handleResetPassword = async () => {
    if (!selectedStaff) return;
    setResetLoading(true);
    
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/staff/${selectedStaff._id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });

      // Safely check if the response is JSON before parsing
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (res.ok) {
          setTempPassword(data.tempPassword);
        } else {
          alert(`Error: ${data.msg}`);
        }
      } else {
        alert(`Server Error: ${res.status}. Endpoint might be missing.`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to reset password. Check your browser console.");
    } finally {
      setResetLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeResetModal = () => {
    setIsResetModalOpen(false);
    setSelectedStaff(null);
    setTempPassword(null);
    setCopied(false);
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header & Add Button */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Staff Management</h1>
              <p className="text-slate-500">Create accounts for Nurses and Receptionists.</p>
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  <UserPlus className="mr-2 h-4 w-4" /> Add New Staff
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Staff Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* ... (Existing Add Staff Form remains untouched) ... */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <Input placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nurse">Nurse</SelectItem>
                          <SelectItem value="receptionist">Receptionist</SelectItem>
                          <SelectItem value="lab_assistant">Lab Assistant</SelectItem>
                          <SelectItem value="system_admin">System Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Department</label>
                      <Input placeholder="e.g. ICU, Front Desk" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Address (Login ID)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input className="pl-9" placeholder="staff@hospital.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                  </div>
<div className="space-y-2">
  <label className="text-sm font-medium">Password</label>
  <div className="relative">
    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
    <input
      type={showPassword ? "text" : "password"}
      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-9 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
      placeholder="••••••••"
      value={formData.password}
      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
      required
    />
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="absolute right-3 top-2.5 text-slate-400 hover:text-cyan-600 transition-colors"
    >
      {showPassword ? (
        <EyeOff className="h-4 w-4" />
      ) : (
        <Eye className="h-4 w-4" />
      )}
    </button>
  </div>
</div>
                  <Button className="w-full bg-cyan-600" onClick={handleAddStaff} disabled={submitLoading}>
                    {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Staff List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffList.map((staff) => (
              <Card key={staff._id} className="hover:shadow-md transition-shadow border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <Badge className={`uppercase ${staff.role === 'system_admin' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' :
                    staff.role === 'nurse' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                      'bg-blue-100 text-blue-700 hover:bg-blue-100'
                    }`}>
                    {staff.role.replace('_', ' ')}
                  </Badge>
                  
                  <div className="flex gap-1">
                    {/* Reset Password Button */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50" 
                      title="Reset Password"
                      onClick={() => {
                        setSelectedStaff(staff);
                        setIsResetModalOpen(true);
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    
                    {/* Delete Button */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(staff._id)} title="Remove Staff">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg">
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{staff.name}</h3>
                      <p className="text-xs text-slate-500">{staff.email}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-slate-400" />
                      <span>{staff.department || "General"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      <span className="capitalize">{staff.role.replace('_', ' ')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

        </div>
      </main>

      {/* RESET PASSWORD MODAL */}
      <Dialog open={isResetModalOpen} onOpenChange={(open) => !open && closeResetModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password for {selectedStaff?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {!tempPassword ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  This will generate a secure, temporary password. The staff member will be required to change this password on their next login.
                </p>
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={handleResetPassword} disabled={resetLoading}>
                  {resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                  Generate Temporary Password
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-sm mb-4">
                  Password has been reset successfully! Provide this temporary password to the staff member.
                </div>
                
                <div className="flex items-center justify-between bg-slate-100 p-4 rounded-lg border border-slate-200">
                  <span className="font-mono text-lg font-bold tracking-wider text-slate-800">{tempPassword}</span>
                  <Button variant="ghost" size="icon" onClick={copyToClipboard} className="text-slate-500 hover:text-slate-900">
                    {copied ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                  </Button>
                </div>

                <Button className="w-full" variant="outline" onClick={closeResetModal}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
