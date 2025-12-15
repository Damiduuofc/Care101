"use client";

import { useEffect, useState } from "react";
import { 
  Users, UserPlus, Trash2, Mail, Lock, Building, Briefcase, ShieldAlert, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/admin/Sidebar";

export default function StaffManagement() {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

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
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/staff`, {
        headers: { "x-auth-token": token || "" }
      });
      if (res.ok) {
        setStaffList(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // 2. Add New Staff
  const handleAddStaff = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.department) {
      alert("Please fill in all fields");
      return;
    }

    setSubmitLoading(true);
    const token = localStorage.getItem("adminToken");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/create-staff`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "x-auth-token": token || ""
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        alert("Staff Member Created Successfully!");
        setIsModalOpen(false);
        setFormData({ name: "", email: "", password: "", role: "nurse", department: "" }); // Reset
        fetchStaff(); // Refresh list
      } else {
        alert(`Error: ${data.msg}`);
      }
    } catch (error) {
      alert("Server Error");
    } finally {
      setSubmitLoading(false);
    }
  };

  // 3. Remove Staff
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this staff member? Access will be revoked immediately.")) return;

    const token = localStorage.getItem("adminToken");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/staff/${id}`, {
        method: "DELETE",
        headers: { "x-auth-token": token || "" }
      });

      if (res.ok) {
        setStaffList(staffList.filter(s => s._id !== id)); // Remove from UI
      } else {
        const data = await res.json();
        alert(data.msg);
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-600" /></div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Sidebar/>
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
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Full Name</label>
                        <Input placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role</label>
                            <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="nurse">Nurse</SelectItem>
                                    <SelectItem value="receptionist">Receptionist</SelectItem>
                                    <SelectItem value="system_admin">System Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Department</label>
                            <Input placeholder="e.g. ICU, Front Desk" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email Address (Login ID)</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input className="pl-9" placeholder="staff@hospital.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input className="pl-9" type="password" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
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
                    <Badge className={`uppercase ${
                        staff.role === 'system_admin' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' :
                        staff.role === 'nurse' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                        'bg-blue-100 text-blue-700 hover:bg-blue-100'
                    }`}>
                        {staff.role.replace('_', ' ')}
                    </Badge>
                    {/* Delete Button (Only if not System Admin or different user) */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(staff._id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
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
  );
}