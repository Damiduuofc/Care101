"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Stethoscope, CreditCard, Clock, CalendarCheck, Activity 
} from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";

export default function Dashboard() {
  const [stats, setStats] = useState<any>({
    doctors: { total: 0, pending: 0 },
    patients: { total: 0, today: 0 },
    appointments: { pending: 0 },
    revenue: 0,
    status: {
      generalWard: "Loading...",
      icuBeds: 0,
      emergency: "Loading...",
      pharmacy: "Loading..."
    }
  });
  
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("adminUser");
    if (storedUser) setUser(JSON.parse(storedUser));

    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("adminToken");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats`, {
          headers: { "x-auth-token": token || "" }
        });
        
        if (res.ok) {
          const data = await res.json();
          setStats((prev: any) => ({
            ...prev,
            ...data,
            status: data.status || prev.status
          }));
        }
      } catch (err) {
        console.error("Failed to load stats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading Dashboard...</div>;

  return (
    <div className="space-y-8">
      <Sidebar/>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">System Overview for <span className="font-semibold text-cyan-700">{user?.name}</span></p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-sm font-medium text-slate-600 capitalize">
           {user?.role?.replace('_', ' ')} Panel
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* 1. Total Doctors */}
        <StatCard 
            title="Total Doctors" 
            value={stats?.doctors?.total || 0} 
            icon={Stethoscope} 
            color="text-blue-600" 
            bgColor="bg-blue-50" 
        />

        {/* 2. Pending Appointments (Your working card) */}
        <StatCard 
            title="Pending Appointments" 
            value={stats?.appointments?.pending || 0} 
            icon={Clock} 
            color="text-orange-600" 
            bgColor="bg-orange-50" 
        />        
        
        {/* 3. ✅ FIXED: Changed from 'Pending Approvals' to 'Appointments Today' */}
        <StatCard 
            title="Appointments Today" 
            value={stats?.patients?.today || 0} 
            icon={CalendarCheck} 
            color="text-cyan-600" 
            bgColor="bg-cyan-50" 
        />
        
        {/* 4. Revenue (System Admin/Receptionist only) */}
        {['system_admin', 'receptionist'].includes(user?.role) ? (
           <StatCard 
            title="Total Revenue" 
            value={`LKR ${(stats?.revenue || 0).toLocaleString()}`} 
            icon={CreditCard} 
            color="text-emerald-600" 
            bgColor="bg-emerald-50" 
           />
        ) : (
           <StatCard 
            title="Total Patients" 
            value={stats?.patients?.total || 0} 
            icon={Activity} 
            color="text-pink-600" 
            bgColor="bg-pink-50" 
           />
        )}
      </div>

      {/* --- HOSPITAL STATUS SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cyan-600" />
                    Hospital Real-Time Status
                </CardTitle>
                <a href="/admin/status" className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-md transition-colors font-medium">
                    Edit Status
                </a>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <StatusItem label="General Ward" status={stats?.status?.generalWard || "No Data"} color="bg-green-500" />
                    <StatusItem label="ICU Beds" status={`${stats?.status?.icuBeds || 0} Beds Left`} color={(stats?.status?.icuBeds || 0) < 2 ? "bg-red-500" : "bg-orange-500"} />
                    <StatusItem label="Emergency Unit" status={stats?.status?.emergency || "Unknown"} color={stats?.status?.emergency === 'High Load' ? "bg-red-500" : "bg-blue-500"} />
                    <StatusItem label="Pharmacy" status={stats?.status?.pharmacy || "Unknown"} color="bg-green-500" />
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- SUB COMPONENTS ---

function StatCard({ title, value, icon: Icon, color, bgColor }: any) {
  return (
    <Card className="border-slate-100 shadow-sm">
      <CardContent className="p-6 flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${bgColor}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function StatusItem({ label, status, color }: any) {
    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${color} shadow-sm`}></span>
                <span className="text-sm font-semibold text-slate-600">{status}</span>
            </div>
        </div>
    )
}