"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, CreditCard } from "lucide-react";

export default function DashboardHome() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("adminUser");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500">Welcome back, {user.name}</p>
        </div>
        <span className="bg-cyan-100 text-cyan-800 px-4 py-1 rounded-full text-sm font-bold uppercase">
            {user.role?.replace('_', ' ')}
        </span>
      </div>

      {/* QUICK STATS (Mock Data for now) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Doctors" value="12" icon={UserCheck} color="text-green-600" />
        <StatCard title="Patients Today" value="48" icon={Users} color="text-blue-600" />
        <StatCard title="Pending Queue" value="15" icon={Clock} color="text-orange-600" />
        <StatCard title="Revenue (Today)" value="LKR 125k" icon={CreditCard} color="text-purple-600" />
      </div>
      
      {/* Placeholder for Role-Specific Content */}
      <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400">
         Select an option from the sidebar to begin work.
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900">{value}</div>
            </CardContent>
        </Card>
    )
}