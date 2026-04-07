"use client";

import { useEffect, useState } from "react";
import {
  Search, CheckCircle, Trash2, Clock, DollarSign, Calendar, AlertCircle, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/admin/Sidebar";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // 1. Fetch Appointments
  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments`, {
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });

      if (!res.ok) {
        console.error(`Server Error: ${res.status}`);
        return;
      }

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return;
      }

      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error("Failed to fetch appointments", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  // 2. Handle Status Update
  const updateStatus = async (id: string, field: string, value: string) => {
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (res.ok) {
        fetchAppointments();
      } else {
        const err = await res.json();
        alert(`Error: ${err.msg}`);
      }
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  // 3. Handle Delete
  const deleteAppointment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      const token = localStorage.getItem("adminToken");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments/${id}`, {
        method: "DELETE",
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });
      setAppointments(appointments.filter(a => a._id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const filteredAppointments = appointments.filter((appt) =>
    appt.patientId?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    appt.doctorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500 ml-64">Loading...</div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar remains fixed/absolute */}
      <Sidebar />

      {/* Main Content Area 
          ml-64 matches the standard width of a Sidebar (w-64)
      */}
      <main className="flex-1 md:ml-64 min-w-0 transition-all duration-300">
        <div className="p-6 lg:p-8 space-y-6">
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Appointments</h1>
              <p className="text-slate-500">Manage bookings & payments for Care101.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search..."
                className="pl-10 bg-white border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-4">
              <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Bookings ({filteredAppointments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-600 text-sm bg-slate-50/50">
                      <th className="p-4 font-semibold">Patient</th>
                      <th className="p-4 font-semibold">Doctor</th>
                      <th className="p-4 font-semibold">Date</th>
                      <th className="p-4 font-semibold">Queue No.</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">Payment</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-slate-400">No appointments found.</td></tr>
                    ) : (
                      filteredAppointments.map((appt) => (
                        <tr key={appt._id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">

                          <td className="p-4 align-top">
                            <div className="font-medium text-slate-900">{appt.patientId?.fullName || "Unknown"}</div>
                            <div className="text-xs text-slate-500">{appt.patientId?.phone}</div>
                          </td>

                          <td className="p-4 align-top">
                            <div className="font-medium text-slate-800">{appt.doctorName || "Unknown"}</div>
                            <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full">{appt.department || "N/A"}</span>
                          </td>

                          <td className="p-4 align-top text-sm text-slate-600">
                            <div>{new Date(appt.date).toLocaleDateString()}</div>
                            <div className="text-xs text-slate-400">{new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>

                          <td className="p-4 align-top">
                            <span className="font-bold text-lg text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
                              #{appt.queueNumber || 0}
                            </span>
                          </td>

                          <td className="p-4 align-top">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              appt.status.toLowerCase() === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' :
                              appt.status.toLowerCase() === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                              appt.status.toLowerCase() === 'completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}>
                              {appt.status}
                            </span>
                          </td>

                          <td className="p-4 align-top">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border flex items-center w-fit gap-1 ${
                              appt.paymentStatus?.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              {appt.paymentStatus?.toLowerCase() === 'paid' ? (
                                <><CheckCircle className="h-3 w-3" /> PAID</>
                              ) : (
                                "PENDING"
                              )}
                            </span>
                          </td>

                          <td className="p-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1">
                              {appt.status.toLowerCase() !== 'confirmed' && appt.status.toLowerCase() !== 'cancelled' && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-100"
                                  onClick={() => updateStatus(appt._id, 'status', 'confirmed')}
                                  title="Confirm"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}

                              {appt.paymentStatus?.toLowerCase() !== 'paid' && appt.status.toLowerCase() !== 'cancelled' && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:bg-emerald-100"
                                  onClick={() => updateStatus(appt._id, 'paymentStatus', 'paid')}
                                  title="Mark Paid"
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                              )}

                              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                onClick={() => deleteAppointment(appt._id)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}