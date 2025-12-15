"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Save, ArrowLeft, Loader2 } from "lucide-react";

export default function ManageStatus() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    generalWard: "Available",
    icuBeds: 0,
    emergencyUnit: "Normal",
    pharmacy: "Open"
  });

  // 1. Load Current Status on Page Load (Safe Version)
  useEffect(() => {
    const fetchStatus = async () => {
      const token = localStorage.getItem("adminToken");
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`, {
          headers: { "x-auth-token": token || "" }
        });
        
        // ✅ SAFETY CHECK: If server errors (404/500), stop here to prevent crash
        if (!res.ok) {
            console.error("Server Error:", res.status);
            return;
        }

        const data = await res.json();
        
        // Populate form if data exists
        if (data && data.status) {
          setFormData({
            generalWard: data.status.generalWard || "Available",
            icuBeds: data.status.icuBeds || 0,
            emergencyUnit: data.status.emergency || "Normal",
            pharmacy: data.status.pharmacy || "Open"
          });
        }
      } catch (err) {
        console.error("Error fetching status", err);
      }
    };
    fetchStatus();
  }, []);

  // 2. Handle Update (Saves to Database)
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/status`, {
        method: "PUT",
        headers: { 
            "Content-Type": "application/json",
            "x-auth-token": token || "" 
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert("✅ Hospital Status Saved to Database!");
        router.push("/admin/dashboard"); // Go back to dashboard
      } else {
        alert("Failed to update status. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Server Connection Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.back()} className="text-slate-500">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
      </Button>

      <Card className="border-slate-200 shadow-lg">
        <CardHeader className="bg-slate-50 border-b border-slate-100">
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <Activity className="h-5 w-5 text-cyan-600" />
            Manage Hospital Status
          </CardTitle>
          <p className="text-sm text-slate-500">
            Updates here are saved permanently for all staff (Admins, Nurses).
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleUpdate} className="space-y-6">
            
            {/* General Ward Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">General Ward Status</label>
              <div className="relative">
                <select 
                  className="w-full h-10 px-3 pl-3 rounded-md border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 appearance-none"
                  value={formData.generalWard}
                  onChange={(e) => setFormData({...formData, generalWard: e.target.value})}
                >
                  <option value="Available">🟢 Available</option>
                  <option value="Limited Beds">🟡 Limited Beds</option>
                  <option value="Full Capacity">🔴 Full Capacity</option>
                  <option value="Closed Maintenance">⚫ Closed / Maintenance</option>
                </select>
                <div className="absolute right-3 top-3 pointer-events-none">
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* ICU Beds Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">ICU Beds Available</label>
              <Input 
                type="number"
                value={formData.icuBeds}
                onChange={(e) => setFormData({...formData, icuBeds: Number(e.target.value)})}
                className="bg-slate-50"
              />
            </div>

            {/* Emergency Unit Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Emergency Unit Status</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm"
                value={formData.emergencyUnit}
                onChange={(e) => setFormData({...formData, emergencyUnit: e.target.value})}
              >
                <option value="Normal">🟢 Normal</option>
                <option value="Busy">🟡 Busy</option>
                <option value="High Load">🔴 High Load (Critical)</option>
              </select>
            </div>

            {/* Pharmacy Select */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Pharmacy Status</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm"
                value={formData.pharmacy}
                onChange={(e) => setFormData({...formData, pharmacy: e.target.value})}
              >
                <option value="Open">🟢 Open</option>
                <option value="Closed">🔴 Closed</option>
                <option value="On Break">🟡 On Break</option>
              </select>
            </div>

            <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Status
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}