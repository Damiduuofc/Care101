"use client";

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { User, Mail, Phone, LogOut, Edit, Shield, QrCode, Loader2, Camera, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/patient`;

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Loading States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Password State
  const [passwords, setPasswords] = useState({ current: "", new: "" });
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    nicNumber: "",
    mobileNumber: "",
    dateOfBirth: "",
    gender: "",
    emergencyContact: "",
    medicalConditions: "",
    allergies: "",
    insuranceProvider: "",
    policyNumber: "",
    profileImage: "" // Stores the Base64 image string
  });

  // 1. Fetch Data
  useEffect(() => {
    const fetchProfile = async () => {
      const token = sessionStorage.getItem("token");
      if (!token) { router.push("/login"); return; }

      try {
        const res = await fetch(`${API_URL}/profile`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch");
        
        const data = await res.json();
        setFormData(prev => ({ ...prev, ...data }));
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  // 2. Handle Text Input Changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  // 3. Handle Image Upload (Convert to Base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // 4. Save Profile Data (Info + Image)
  const handleSave = async () => {
    setSaving(true);
    const token = sessionStorage.getItem("token");
    
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert("Profile updated successfully!");
        // Update session storage so header updates immediately
        const user = JSON.parse(sessionStorage.getItem("user") || "{}");
        user.name = formData.fullName;
        user.profileImage = formData.profileImage;
        sessionStorage.setItem("user", JSON.stringify(user));
        window.location.reload(); // Reload to refresh header
      } else {
        alert("Failed to update profile.");
      }
    } catch (error) {
      console.error(error);
      alert("Error connecting to server.");
    } finally {
      setSaving(false);
    }
  };

  // 5. Change Password Logic
  const handleChangePassword = async () => {
    const token = sessionStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/change-password`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword: passwords.current,
                newPassword: passwords.new
            })
        });
        
        const data = await res.json();
        if(res.ok) {
            alert("Password Changed Successfully");
            setPasswordOpen(false);
            setPasswords({ current: "", new: "" });
        } else {
            alert(data.msg || "Failed to change password");
        }
    } catch (error) {
        alert("Server Error");
    }
  };

  // 6. Delete Account Logic
  const handleDeleteAccount = async () => {
    if(!confirm("Are you sure? This action cannot be undone.")) return;

    const token = sessionStorage.getItem("token");
    try {
        const res = await fetch(`${API_URL}/delete-account`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if(res.ok) {
            sessionStorage.clear();
            router.push("/");
        } else {
            alert("Failed to delete account");
        }
    } catch (error) {
        alert("Server error");
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <motion.div 
        className="space-y-8 max-w-4xl mx-auto p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
    >
      <div>
        <h1 className="text-3xl font-bold font-headline">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal details.</p>
      </div>

      {/* PROFILE HEADER CARD */}
      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-6">
          
          {/* IMAGE UPLOAD SECTION */}
          <div className="relative h-32 w-32 rounded-full border-4 border-slate-100 shadow-md bg-slate-200 flex items-center justify-center overflow-hidden group">
            {formData.profileImage ? (
              <Image
                src={formData.profileImage}
                alt="Profile"
                fill
                className="object-cover"
              />
            ) : (
              <User className="h-16 w-16 text-slate-400" />
            )}
            
            {/* Hidden Input */}
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*"
            />
            
            {/* Edit Button */}
            <Button 
                size="icon" 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-cyan-600 hover:bg-cyan-700 z-10"
            >
                <Camera className="h-4 w-4"/>
            </Button>
          </div>

          <div className="text-center md:text-left space-y-1">
            <CardTitle className="text-2xl">{formData.fullName}</CardTitle>
            <CardDescription>NIC: {formData.nicNumber}</CardDescription>
            <div className='flex items-center gap-2 justify-center md:justify-start text-sm text-muted-foreground'>
                <Mail className="h-4 w-4"/> {formData.email}
            </div>
            <div className='flex items-center gap-2 justify-center md:justify-start text-sm text-muted-foreground'>
                <Phone className="h-4 w-4"/> {formData.mobileNumber || "No Phone Added"}
            </div>
          </div>
           <Button variant="outline" className="md:ml-auto border-cyan-200 text-cyan-700" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Photo"}
          </Button>
        </CardHeader>
      </Card>

        {/* PERSONAL INFO */}
        <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Full Name</Label>
                        <Input id="fullName" value={formData.fullName} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <Label>Mobile Number</Label>
                        <Input id="mobileNumber" value={formData.mobileNumber} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <Label>Date of Birth</Label>
                        <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <Label>Gender</Label>
                        <Input id="gender" value={formData.gender} onChange={handleChange} />
                    </div>
                </div>
                 <div className="flex justify-end mt-6">
                    <Button onClick={handleSave} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </CardContent>
        </Card>

      {/* ACCOUNT SETTINGS */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><Shield className="mr-2 h-5 w-5 text-cyan-600"/> Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* CHANGE PASSWORD DIALOG */}
                <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">Change Password</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                            <DialogDescription>Enter your current password and a new one.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Current Password</Label>
                                <Input type="password" value={passwords.current} onChange={(e) => setPasswords({...passwords, current: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label>New Password</Label>
                                <Input type="password" value={passwords.new} onChange={(e) => setPasswords({...passwords, new: e.target.value})} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleChangePassword}>Update Password</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Button variant="outline" disabled>Change Email (Contact Support)</Button>
             </div>
             
             <Separator className="my-8" />

             <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <Button variant="destructive" onClick={() => { sessionStorage.clear(); router.push("/"); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
                
                <Button variant="destructive" className="bg-red-900 hover:bg-red-950" onClick={handleDeleteAccount}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                </Button>
             </div>
          </CardContent>
      </Card>
    </motion.div>
  );
}