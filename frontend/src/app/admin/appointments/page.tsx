"use client";

import { useEffect, useState } from "react";
import {
  Search, CheckCircle, Trash2, Clock, DollarSign, Calendar, AlertCircle, XCircle, Plus, X, User, Stethoscope
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/admin/Sidebar";
import { getAdminToken } from "@/lib/adminSession";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Booking Modal States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Patient Details
    patientId: "", fullName: "", nic: "", dob: "", phone: "", email: "",
    // Appointment Details
    department: "", doctorId: "", doctorName: "", date: "", visitType: "Consultation", reason: "", paymentStatus: "paid"
  });

  // 1. Fetch Appointments
  const fetchAppointments = async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments`, {
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });

      if (!res.ok) return;

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return;

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

  // Fetch Doctors for the Booking Form
  const fetchDoctors = async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/doctors/list`, {
        headers: {
          "Authorization": `Bearer ${token}`, // Used standard bearer based on your RN code
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (err) {
      console.error("Failed to fetch doctors", err);
    }
  };

  // Fetch Schedules when a Doctor is selected
  useEffect(() => {
    if (!formData.doctorId) {
      setSchedules([]);
      return;
    }
    const fetchSchedules = async () => {
      try {
        const token = getAdminToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/schedule-requests/doctor/${formData.doctorId}/approved`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-auth-token": token || "",
            "ngrok-skip-browser-warning": "true"
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSchedules(data);
        }
      } catch (err) {
        console.error("Failed to fetch schedules", err);
      }
    };
    fetchSchedules();
  }, [formData.doctorId]);

  // Open Modal Logic
  const handleOpenBookingModal = () => {
    fetchDoctors();
    setIsBookingModalOpen(true);
  };

// Submit New Walk-in Appointment
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments/walkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
        },
        body: JSON.stringify({
          patientDetails: {
            fullName: formData.fullName,
            nic: formData.nic,
            dob: formData.dob,
            phone: formData.phone,
            email: formData.email,
            patientId: formData.patientId
          },
          appointmentDetails: {
            doctorId: formData.doctorId,
            doctorName: formData.doctorName,
            department: formData.department,
            date: formData.date,
            visitType: formData.visitType,
            reason: formData.reason,
            paymentStatus: formData.paymentStatus,
            amount: 3500 // Base (1500) + Doctor (2000)
          }
        }),
      });

      if (res.ok) {
        setIsBookingModalOpen(false);
        fetchAppointments(); // Refresh list
        setFormData({
          patientId: "", fullName: "", nic: "", dob: "", phone: "", email: "",
          department: "", doctorId: "", doctorName: "", date: "", visitType: "Consultation", reason: "", paymentStatus: "paid"
        });
        alert("Appointment booked successfully!");
      } else {
        // --- FIX IS HERE ---
        // Safely check if the error is JSON before parsing
        const contentType = res.headers.get("content-type");
        let errorMessage = `Server Error: ${res.status}`;
        
        if (contentType && contentType.includes("application/json")) {
            const errData = await res.json();
            errorMessage = errData.msg || errData.message || errorMessage;
        } else {
            // Fallback for HTML/Text errors
            const errText = await res.text();
            console.error("Non-JSON Error Response:", errText);
        }
        
        alert(`Booking failed: ${errorMessage}`);
      }
    } catch (err) {
      console.error("Booking error", err);
      alert("An error occurred while booking. Check your console and network tab.");
    } finally {
      setIsSubmitting(false);
    }
  };

// 2. Handle Status Update
  const updateStatus = async (id: string, field: string, value: string) => {
    try {
      const token = getAdminToken();
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
        // Safely parse the error here too
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const err = await res.json();
            alert(`Error: ${err.msg}`);
        } else {
            alert(`Error: ${res.status} ${res.statusText}`);
        }
      }
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  // 3. Handle Delete
  const deleteAppointment = async (id: string) => {
    if (!confirm("Are you sure you want to delete this appointment?")) return;
    try {
      const token = getAdminToken();
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

  // Derive unique departments from fetched doctors
  const departments = Array.from(new Set(doctors.map(d => d.specialization || "General")));

  if (loading) return <div className="p-8 text-center text-slate-500 ml-64">Loading...</div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 md:ml-64 min-w-0 transition-all duration-300 relative">
        <div className="p-6 lg:p-8 space-y-6">
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Appointments</h1>
              <p className="text-slate-500">Manage bookings & payments for Care101.</p>
            </div>
            <div className="flex w-full md:w-auto items-center gap-3">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search bookings..."
                  className="pl-10 bg-white border-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleOpenBookingModal}
                style={{ backgroundColor: "#06B6D4", color: "#fff" }} 
                className="hover:opacity-90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Book Walk-in
              </Button>
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

        {/* BOOKING MODAL OVERLAY */}
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#06B6D4]" />
                  New Walk-in / Phone Booking
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsBookingModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-500" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <form id="booking-form" onSubmit={handleBookAppointment} className="space-y-8">
                  
                  {/* PATIENT DETAILS */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <User className="w-4 h-4" /> Patient Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Full Name *</label>
                        <Input required placeholder="John Doe" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Phone Number *</label>
                        <Input required placeholder="07XXXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Patient ID (optional)</label>
                        <Input placeholder="e.g. SHP001" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">NIC Number (optional)</label>
                        <Input  placeholder="National ID" value={formData.nic} onChange={e => setFormData({...formData, nic: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Date of Birth (optional)</label>
                        <Input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Email Address (optional)</label>
                        <Input type="email" placeholder="john@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                      </div>
                    </div>
                  </section>

                  {/* APPOINTMENT DETAILS */}
                  <section>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" /> Appointment Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Department *</label>
                        <select required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          value={formData.department}
                          onChange={e => {
                            setFormData({...formData, department: e.target.value, doctorId: "", doctorName: "", date: ""});
                          }}
                        >
                          <option value="">Select Department...</option>
                          {departments.map((dept: any) => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Doctor *</label>
                        <select required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                          disabled={!formData.department}
                          value={formData.doctorId}
                          onChange={e => {
                            const doc = doctors.find(d => d._id === e.target.value);
                            setFormData({...formData, doctorId: doc?._id || "", doctorName: doc?.name || "", date: ""});
                          }}
                        >
                          <option value="">Select Specialist...</option>
                          {doctors.filter(d => d.specialization === formData.department).map(doc => (
                            <option key={doc._id} value={doc._id}>{doc.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Available Date *</label>
                        <select required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                          disabled={!formData.doctorId || schedules.length === 0}
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                        >
                          <option value="">{schedules.length === 0 ? "No schedules available" : "Select Date..."}</option>
                          {schedules.map((sch: any) => (
                            <option key={sch._id} value={sch.date}>
                              {new Date(sch.date).toLocaleDateString()} ({new Date(sch.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Visit Type</label>
                        <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          value={formData.visitType}
                          onChange={e => setFormData({...formData, visitType: e.target.value})}
                        >
                          <option value="Consultation">Consultation</option>
                          <option value="Follow-up">Follow-up</option>
                          <option value="Emergency">Emergency</option>
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Reason for visit</label>
                        <Input placeholder="E.g., Fever, Regular checkup" value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Payment Status (Counter Collection)</label>
                        <select className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                          value={formData.paymentStatus}
                          onChange={e => setFormData({...formData, paymentStatus: e.target.value})}
                        >
                          <option value="paid">Paid (Cash collected at counter)</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>

                    </div>
                  </section>
                </form>
              </div>

              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => setIsBookingModalOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  form="booking-form"
                  disabled={isSubmitting} 
                  style={{ backgroundColor: "#06B6D4", color: "#fff" }}
                  className="hover:opacity-90"
                >
                  {isSubmitting ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
