"use client";

import { useEffect, useState } from "react";
import {
  Search, CheckCircle, Trash2, Clock, DollarSign, Calendar, AlertCircle, XCircle, Plus, X, User, Stethoscope, CreditCard, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/admin/Sidebar";
import { getAdminToken } from "@/lib/adminSession";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");


export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
const [generatedPatientId, setGeneratedPatientId] = useState("Loading...");
  // Booking Modal States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isRegistered, setIsRegistered] = useState(false);
  const [isPatientFound, setIsPatientFound] = useState(false);
  const [isSearchingPatient, setIsSearchingPatient] = useState(false);

  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<"cash" | "card" | "pending">("cash");

  const [paymentAppointment, setPaymentAppointment] = useState<any>(null);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);

  const handleSearchPatient = async () => {
    if (!formData.patientId) {
      alert("Please enter a Patient ID first.");
      return;
    }
    setIsSearchingPatient(true);
    setIsPatientFound(false);
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/patients/search/patientid/${formData.patientId.toUpperCase()}`, {
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });
      const data = await res.json();
      if (res.ok) {
        let formattedDob = "";
        if (data.dateOfBirth) {
          formattedDob = new Date(data.dateOfBirth).toISOString().split('T')[0];
        }
        setFormData(prev => ({
          ...prev,
          patientId: data.patientId,
          fullName: data.fullName || "",
          phone: data.mobileNumber || "",
          nic: data.nicNumber || "",
          dob: formattedDob,
          email: data.email || ""
        }));
        setIsPatientFound(true);
        alert(`Patient ${data.fullName} found.`);
      } else {
        alert(data.msg || "Patient not found.");
      }
    } catch (err) {
      console.error(err);
      alert("Error searching patient.");
    } finally {
      setIsSearchingPatient(false);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    // Patient Details
    patientId: "", fullName: "", nic: "", dob: "", phone: "", email: "",
    // Appointment Details
    department: "", doctorId: "", doctorName: "", date: "", visitType: "Consultation", reason: "", paymentStatus: "paid"
  });
const fetchNextPatientId = async () => {
  try {
    const token = getAdminToken();

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/next-patient-id`,
      {
        headers: {
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true",
        },
      }
    );

    if (res.ok) {
      const data = await res.json();

      setGeneratedPatientId(data.patientId);

      setFormData(prev => ({
        ...prev,
        patientId: data.patientId,
      }));
    } else {
      setGeneratedPatientId("SHP001");
    }
  } catch (err) {
    console.error(err);
    setGeneratedPatientId("SHP001");
  }
};


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
    fetchNextPatientId();
    setIsRegistered(false);
    setIsPatientFound(false);
    setBookingPaymentMethod("cash");
    setIsBookingModalOpen(true);
  };

// Submit New Walk-in Appointment
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistered && !isPatientFound) {
      alert("Please search and verify the registered Patient ID before booking.");
      return;
    }
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
            patientId: isRegistered ? formData.patientId : generatedPatientId
          },
          appointmentDetails: {
            doctorId: formData.doctorId,
            doctorName: formData.doctorName,
            department: formData.department,
            date: formData.date,
            visitType: formData.visitType,
            reason: formData.reason,
            paymentStatus: bookingPaymentMethod === "cash" ? "paid" : "pending",
            amount: 3500 // Base (1500) + Doctor (2000)
          }
        }),
      });

      if (res.ok) {
        const newAppt = await res.json();
        setIsBookingModalOpen(false);
        fetchAppointments(); // Refresh list
        setFormData({
          patientId: "", fullName: "", nic: "", dob: "", phone: "", email: "",
          department: "", doctorId: "", doctorName: "", date: "", visitType: "Consultation", reason: "", paymentStatus: "paid"
        });
        setIsRegistered(false);
        setIsPatientFound(false);
        if (bookingPaymentMethod === "card") {
          setPaymentAppointment(newAppt);
          setIsStripeModalOpen(true);
        } else {
          alert("Appointment booked successfully!");
        }
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
                                  onClick={() => {
                                    setPaymentAppointment(appt);
                                    setIsPaymentMethodModalOpen(true);
                                  }}
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
                      <div className="flex items-center gap-2 mb-2 col-span-1 md:col-span-2">
                        <input
                          type="checkbox"
                          id="isRegisteredPatient"
                          checked={isRegistered}
                          onChange={e => {
                            const checked = e.target.checked;
                            setIsRegistered(checked);
                            if (!checked) {
                              setFormData(prev => ({
                                ...prev,
                                patientId: generatedPatientId,
                                fullName: "",
                                phone: "",
                                nic: "",
                                dob: "",
                                email: ""
                              }));
                              setIsPatientFound(false);
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                patientId: "",
                                fullName: "",
                                phone: "",
                                nic: "",
                                dob: "",
                                email: ""
                              }));
                              setIsPatientFound(false);
                            }
                          }}
                          className="w-4 h-4 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500"
                        />
                        <label htmlFor="isRegisteredPatient" className="text-sm font-semibold text-slate-700 cursor-pointer">
                          Registered Patient?
                        </label>
                      </div>

                      <div className="space-y-1 col-span-1 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Patient ID</label>
                        <div className="flex gap-2">
                          <Input
                            value={isRegistered ? formData.patientId : generatedPatientId}
                            readOnly={!isRegistered}
                            onChange={e => {
                              setFormData({ ...formData, patientId: e.target.value });
                              setIsPatientFound(false);
                            }}
                            placeholder="e.g. SHP001"
                            className={!isRegistered ? "bg-slate-100 text-slate-600 font-semibold cursor-not-allowed" : ""}
                          />
                          {isRegistered && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleSearchPatient}
                              disabled={isSearchingPatient}
                              className="h-10 border-cyan-200 text-[#06b6d4] hover:bg-cyan-50"
                            >
                              {isSearchingPatient ? "Searching..." : "Search"}
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Full Name *</label>
                        <Input required placeholder="Damidu Abeysinghye" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Phone Number *</label>
                        <Input required placeholder="07XXXXXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">NIC Number (optional)</label>
                        <Input  placeholder="National ID" value={formData.nic} onChange={e => setFormData({...formData, nic: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">Date of Birth (optional)</label>
                        <Input type="date" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                      </div>
                      <div className="space-y-1">
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
                          value={bookingPaymentMethod}
                          onChange={e => {
                            const val = e.target.value as "cash" | "card" | "pending";
                            setBookingPaymentMethod(val);
                            setFormData({
                              ...formData,
                              paymentStatus: val === "cash" ? "paid" : "pending"
                            });
                          }}
                        >
                          <option value="cash">Paid (Cash collected at counter)</option>
                          <option value="card">Paid (Card payment via Stripe)</option>
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

        {/* PAYMENT METHOD SELECTION DIALOG */}
        <Dialog open={isPaymentMethodModalOpen} onOpenChange={setIsPaymentMethodModalOpen}>
          <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 bg-white border border-slate-100 shadow-2xl">
            <DialogTitle className="text-xl font-bold text-slate-900">Select Payment Method</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Choose how the patient wants to pay.
            </DialogDescription>
            {paymentAppointment && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Appointment Info</p>
                  <p className="text-base font-bold text-slate-800">Consultation - {paymentAppointment.doctorName}</p>
                  <p className="text-sm text-slate-600">Patient: <span className="font-semibold">{paymentAppointment.patientId?.fullName || "Walk-in Patient"}</span></p>
                  <p className="text-lg font-black text-[#06b6d4] mt-2">LKR {(paymentAppointment.amount || 3500).toLocaleString()}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsPaymentMethodModalOpen(false);
                      await updateStatus(paymentAppointment._id, 'paymentStatus', 'paid');
                      setPaymentAppointment(null);
                    }}
                    className="p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all border-slate-100 hover:border-cyan-200 hover:bg-slate-50"
                  >
                    <DollarSign className="text-emerald-500 w-8 h-8" />
                    <span className="text-xs font-bold text-slate-700">CASH</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPaymentMethodModalOpen(false);
                      setIsStripeModalOpen(true);
                    }}
                    className="p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all border-slate-100 hover:border-cyan-200 hover:bg-slate-50"
                  >
                    <CreditCard className="text-cyan-500 w-8 h-8" />
                    <span className="text-xs font-bold text-slate-700">CARD</span>
                  </button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* STRIPE CARD PAYMENT DIALOG */}
        <Dialog open={isStripeModalOpen} onOpenChange={(open) => { if (!open) { setIsStripeModalOpen(false); setPaymentAppointment(null); } }}>
          <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 bg-white border border-slate-100 shadow-2xl">
            <DialogTitle className="text-xl font-bold text-slate-900">Card Payment Confirmation</DialogTitle>
            <DialogDescription className="text-sm text-slate-500 mt-1">
              Charge patient's card at counter via Stripe.
            </DialogDescription>
            {paymentAppointment && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bill Details</p>
                  <p className="text-base font-bold text-slate-800">Consultation - {paymentAppointment.doctorName}</p>
                  <p className="text-sm text-slate-600">Patient: <span className="font-semibold">{paymentAppointment.patientId?.fullName || "Walk-in Patient"}</span></p>
                  <p className="text-lg font-black text-[#06b6d4] mt-2">LKR {(paymentAppointment.amount || 3500).toLocaleString()}</p>
                </div>
                
                <Elements stripe={stripePromise}>
                  <StripeCardForm 
                    amount={paymentAppointment.amount || 3500} 
                    appointmentId={paymentAppointment._id}
                    onSuccess={() => {
                      setIsStripeModalOpen(false);
                      setPaymentAppointment(null);
                      fetchAppointments();
                    }}
                    onCancel={() => {
                      setIsStripeModalOpen(false);
                      setPaymentAppointment(null);
                    }}
                  />
                </Elements>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}

interface StripeCardFormProps {
  amount: number;
  appointmentId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function StripeCardForm({ amount, appointmentId, onSuccess, onCancel }: StripeCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const adminToken = getAdminToken();
      const intentRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/create-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": adminToken || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ amount: amount * 100 })
      });

      const intentData = await intentRes.json();
      if (!intentRes.ok) {
        throw new Error(intentData.msg || "Failed to initiate payment");
      }

      const clientSecret = intentData.clientSecret;

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Card input not found");
      }

      const paymentResult = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement
        }
      });

      if (paymentResult.error) {
        throw new Error(paymentResult.error.message || "Payment failed");
      }

      if (paymentResult.paymentIntent?.status === "succeeded") {
        const payRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/appointments/${appointmentId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": adminToken || "",
            "ngrok-skip-browser-warning": "true"
          },
          body: JSON.stringify({ paymentStatus: "paid" })
        });

        const payData = await payRes.json();
        if (!payRes.ok) {
          throw new Error(payData.msg || "Payment recorded but failed to update appointment record.");
        }

        alert("Payment Successful!");
        onSuccess();
      }
    } catch (err: any) {
      console.error("Card Payment Error:", err);
      setError(err.message || "An error occurred during payment");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#0f172a",
                "::placeholder": {
                  color: "#94a3b8",
                },
              },
            },
          }}
        />
      </div>
      {error && <div className="text-xs font-semibold text-rose-500 bg-rose-50 p-3 rounded-lg border border-rose-100">{error}</div>}
      <div className="flex gap-3 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing} className="rounded-xl h-11 px-6">Cancel</Button>
        <Button type="submit" disabled={!stripe || processing} className="bg-[#06b6d4] hover:bg-[#0891b2] rounded-xl h-11 px-6 shadow-md shadow-cyan-500/10 text-white">
          {processing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
          Confirm Rs. {amount.toLocaleString()}
        </Button>
      </div>
    </form>
  );
}
