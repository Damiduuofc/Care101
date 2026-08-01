"use client";

import { useEffect, useState, useRef } from "react";
import {
  Search, CheckCircle, Trash2, Clock, DollarSign, Calendar, AlertCircle, XCircle, Plus, X, User, Stethoscope, CreditCard, Loader2, Eye, ArrowUpDown, ArrowUp, ArrowDown, Phone
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

  const [bookingStep, setBookingStep] = useState(1);
  const [searchPhone, setSearchPhone] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [matchingPatients, setMatchingPatients] = useState<any[]>([]);
  const [isSearchingMobile, setIsSearchingMobile] = useState(false);
  const [isPatientFound, setIsPatientFound] = useState(false);

  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<"cash" | "card" | "pending">("cash");

  const [paymentAppointment, setPaymentAppointment] = useState<any>(null);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<"patient" | "date" | "doctor" | "arrived">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Details Preview Modal State
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Helper to check if a patient is a child (under 18 years old)
  const isChild = (dobString: string) => {
    if (!dobString) return false;
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age < 18;
  };

  // Auto-search patients as phone number is typed in Step 2
  useEffect(() => {
    if (searchPhone.trim().length < 4) {
      setMatchingPatients([]);
      setSelectedPatient(null);
      setShowRegistrationForm(false);
      setIsPatientFound(false);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setIsSearchingMobile(true);
      try {
        const token = getAdminToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/patients/search/mobile/${searchPhone.trim()}`, {
          headers: {
            "x-auth-token": token || "",
            "ngrok-skip-browser-warning": "true"
          }
        });
        if (res.ok) {
          const data = await res.json();
          setMatchingPatients(data);
          
          if (data.length === 1) {
            // Case 1: Existing Patient (exactly one match)
            const patient = data[0];
            let formattedDob = "";
            if (patient.dateOfBirth) {
              formattedDob = new Date(patient.dateOfBirth).toISOString().split('T')[0];
            }
            setFormData(prev => ({
              ...prev,
              patientId: patient.patientId,
              fullName: patient.fullName || "",
              phone: patient.mobileNumber || "",
              nic: patient.nicNumber || "",
              dob: formattedDob,
              email: patient.email || ""
            }));
            setSelectedPatient(patient);
            setIsPatientFound(true);
            setShowRegistrationForm(false);
          } else if (data.length > 1) {
            // Case 2: Multiple Patients
            setSelectedPatient(null);
            setIsPatientFound(false);
            setShowRegistrationForm(false);
          } else {
            // Case 3: New Patient
            setSelectedPatient(null);
            setIsPatientFound(false);
            setShowRegistrationForm(true);
            setFormData(prev => ({
              ...prev,
              patientId: "",
              fullName: "",
              phone: searchPhone.trim(),
              nic: "",
              dob: "",
              email: ""
            }));
          }
        }
      } catch (err) {
        console.error("Error auto-searching patient", err);
      } finally {
        setIsSearchingMobile(false);
      }
    }, 400); // 400ms debounce
    return () => clearTimeout(delayDebounce);
  }, [searchPhone]);

  const handleSelectPatientFromList = (patient: any) => {
    let formattedDob = "";
    if (patient.dateOfBirth) {
      formattedDob = new Date(patient.dateOfBirth).toISOString().split('T')[0];
    }
    setFormData(prev => ({
      ...prev,
      patientId: patient.patientId,
      fullName: patient.fullName || "",
      phone: patient.mobileNumber || "",
      nic: patient.nicNumber || "",
      dob: formattedDob,
      email: patient.email || ""
    }));
    setSelectedPatient(patient);
    setIsPatientFound(true);
    setShowRegistrationForm(false);
  };

  const handleChooseRegisterNewPatient = () => {
    setSelectedPatient(null);
    setIsPatientFound(false);
    setShowRegistrationForm(true);
    setFormData(prev => ({
      ...prev,
      patientId: "",
      fullName: "",
      phone: searchPhone.trim(),
      nic: "",
      dob: "",
      email: ""
    }));
  };

  // Form State
  const [formData, setFormData] = useState({
    // Patient Details
    patientId: "", fullName: "", nic: "", dob: "", phone: "", email: "",
    // Appointment Details
    department: "", doctorId: "", doctorName: "", date: "", visitType: "Consultation", reason: "", paymentStatus: "paid"
  });

  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const doctorSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (doctorSearchRef.current && !doctorSearchRef.current.contains(event.target as Node)) {
        setIsDoctorDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectDoctor = (doc: any) => {
    setFormData(prev => ({
      ...prev,
      doctorId: doc._id,
      doctorName: doc.name,
      department: doc.specialization || "General Practitioner",
      date: ""
    }));
    setDoctorSearchQuery(doc.name);
    setIsDoctorDropdownOpen(false);
  };

  const filteredDoctors = doctors.filter(doc => {
    const query = doctorSearchQuery.toLowerCase();
    const nameMatch = doc.name?.toLowerCase().includes(query) || doc.fullName?.toLowerCase().includes(query);
    const specMatch = doc.specialization?.toLowerCase().includes(query);
    if (formData.department) {
      return nameMatch && doc.specialization === formData.department;
    }
    return nameMatch || specMatch;
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
    setBookingStep(1);
    setSearchPhone("");
    setSelectedPatient(null);
    setShowRegistrationForm(false);
    setIsPatientFound(false);
    setBookingPaymentMethod("cash");
    setDoctorSearchQuery("");
    setIsDoctorDropdownOpen(false);
    setFormData({
      patientId: "", fullName: "", nic: "", dob: "", phone: "", email: "",
      department: "", doctorId: "", doctorName: "", date: "", visitType: "Consultation", reason: "", paymentStatus: "paid"
    });
    setIsBookingModalOpen(true);
  };

  // Submit New Walk-in Appointment
  const handleBookAppointment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.doctorId) {
      alert("Please select a doctor first.");
      return;
    }
    if (!formData.date) {
      alert("Please select an appointment date.");
      return;
    }
    if (showRegistrationForm && (!formData.fullName || !formData.phone)) {
      alert("Please complete the required patient registration details.");
      return;
    }
    if (!showRegistrationForm && !selectedPatient) {
      alert("Please search and select a patient first.");
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
            fullName: showRegistrationForm ? formData.fullName : (selectedPatient.fullName || ""),
            nic: showRegistrationForm ? formData.nic : (selectedPatient.nicNumber || ""),
            dob: showRegistrationForm ? formData.dob : (selectedPatient.dateOfBirth || ""),
            phone: showRegistrationForm ? formData.phone : (selectedPatient.mobileNumber || ""),
            email: showRegistrationForm ? formData.email : (selectedPatient.email || ""),
            patientId: showRegistrationForm ? "" : selectedPatient.patientId
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
        setDoctorSearchQuery("");
        setBookingStep(1);
        setSearchPhone("");
        setSelectedPatient(null);
        setShowRegistrationForm(false);
        setIsPatientFound(false);
        if (bookingPaymentMethod === "card") {
          setPaymentAppointment(newAppt);
          setIsStripeModalOpen(true);
        } else {
          alert("Appointment booked successfully!");
        }
      } else {
        const contentType = res.headers.get("content-type");
        let errorMessage = `Server Error: ${res.status}`;
        
        if (contentType && contentType.includes("application/json")) {
            const errData = await res.json();
            errorMessage = errData.msg || errData.message || errorMessage;
        } else {
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

  // Helper to format clean, elegant Patient IDs
  const getDisplayPatientId = (patientOrAppt: any) => {
    if (!patientOrAppt) return "N/A";
    const patientObj = patientOrAppt.patientId && typeof patientOrAppt.patientId === "object"
      ? patientOrAppt.patientId
      : patientOrAppt;

    if (patientObj.patientId && typeof patientObj.patientId === "string") {
      return patientObj.patientId;
    }
    if (typeof patientOrAppt.patientId === "string" && patientOrAppt.patientId.startsWith("SHP")) {
      return patientOrAppt.patientId;
    }
    const rawId = patientObj._id || (typeof patientOrAppt.patientId === "string" ? patientOrAppt.patientId : null);
    if (rawId && rawId.length > 8) {
      return `PID-${rawId.substring(rawId.length - 6).toUpperCase()}`;
    }
    return rawId || "N/A";
  };

  // 2. Handle Status Update
  const updateStatus = async (id: string, field: string, value: any) => {
    if (field === "status" && String(value).toLowerCase() === "confirmed") {
      const targetAppt = appointments.find(a => a._id === id);
      if (targetAppt && targetAppt.paymentStatus?.toLowerCase() !== "paid") {
        alert("Cannot confirm appointment until payment is completed (PAID). Please collect payment first ($).");
        return;
      }
    }

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

  const handleSort = (field: "patient" | "date" | "doctor" | "arrived") => {
    if (sortField === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "date" ? "desc" : "asc");
    }
  };

  const renderSortIcon = (field: "patient" | "date" | "doctor" | "arrived") => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-cyan-600 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-cyan-600 font-bold" />
    );
  };

  const filteredAppointments = appointments
    .filter((appt) => {
      const query = searchTerm.toLowerCase();
      const patientName = appt.patientId?.fullName?.toLowerCase() || "";
      const patientId = appt.patientId?.patientId?.toLowerCase() || appt.patientId?._id?.toLowerCase() || "";
      const doctorName = appt.doctorName?.toLowerCase() || "";
      return patientName.includes(query) || patientId.includes(query) || doctorName.includes(query);
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "patient") {
        const nameA = (a.patientId?.fullName || "").toLowerCase();
        const nameB = (b.patientId?.fullName || "").toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === "doctor") {
        const docA = (a.doctorName || "").toLowerCase();
        const docB = (b.doctorName || "").toLowerCase();
        comparison = docA.localeCompare(docB);
      } else if (sortField === "arrived") {
        const arrA = a.arrived ? 1 : 0;
        const arrB = b.arrived ? 1 : 0;
        comparison = arrA - arrB;
      } else {
        // Default / Date & Creation sort (latest booking on top when desc)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) {
          comparison = dateA - dateB;
        } else {
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = createdA - createdB;
        }
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

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
                      <th 
                        className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors"
                        onClick={() => handleSort("patient")}
                      >
                        Patient {renderSortIcon("patient")}
                      </th>
                      <th 
                        className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors"
                        onClick={() => handleSort("date")}
                      >
                        Date {renderSortIcon("date")}
                      </th>
                      <th 
                        className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors"
                        onClick={() => handleSort("doctor")}
                      >
                        Doctor {renderSortIcon("doctor")}
                      </th>
                      <th className="p-4 font-semibold">Payment</th>
                      <th 
                        className="p-4 font-semibold cursor-pointer select-none group hover:text-slate-900 transition-colors"
                        onClick={() => handleSort("arrived")}
                      >
                        Arrival {renderSortIcon("arrived")}
                      </th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400">No appointments found.</td></tr>
                    ) : (
                      filteredAppointments.map((appt) => (
                        <tr key={appt._id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">

                          {/* Patient Column (Name & ID) */}
                          <td className="p-4 align-top">
                            <div className="font-semibold text-slate-900">{appt.patientId?.fullName || "Walk-in Patient"}</div>
                            <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                              <span className="inline-flex items-center gap-1 bg-cyan-50/90 text-cyan-800 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-cyan-200/60 font-mono shadow-2xs">
                                <span className="text-cyan-500 font-bold">#</span>{getDisplayPatientId(appt)}
                              </span>
                            </div>
                          </td>

                          {/* Date Column (Date & Time) */}
                          <td className="p-4 align-top text-sm text-slate-600">
                            <div className="font-medium text-slate-800">{new Date(appt.date).toLocaleDateString()}</div>
                            <div className="text-xs text-slate-400">{new Date(appt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </td>

                          {/* Doctor Column (Name & Department) */}
                          <td className="p-4 align-top">
                            <div className="font-semibold text-slate-800">{appt.doctorName || "Unknown"}</div>
                            <span className="text-[10px] bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-full font-medium inline-block mt-0.5">{appt.department || "N/A"}</span>
                          </td>

                          {/* Payment Column */}
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

                          {/* Arrival Column */}
                          <td className="p-4 align-top">
                            <button
                              onClick={async () => {
                                const newArrived = !appt.arrived;
                                await updateStatus(appt._id, 'arrived', newArrived);
                              }}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 transition-all ${
                                appt.arrived
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <CheckCircle className={`w-3.5 h-3.5 ${appt.arrived ? 'text-emerald-500' : 'text-slate-400'}`} />
                              {appt.arrived ? "Arrived" : "Mark Arrived"}
                            </button>
                          </td>

                          {/* Actions Column ($ , Eye , Delete) */}
                          <td className="p-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Collect / Update Payment Action ($) */}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className={`h-8 w-8 transition-colors ${
                                  appt.paymentStatus?.toLowerCase() === 'paid' 
                                    ? 'text-slate-300 hover:text-slate-400 hover:bg-slate-100' 
                                    : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                                }`}
                                onClick={() => {
                                  if (appt.paymentStatus?.toLowerCase() !== 'paid') {
                                    setPaymentAppointment(appt);
                                    setIsPaymentMethodModalOpen(true);
                                  } else {
                                    alert("This appointment is already marked as paid.");
                                  }
                                }}
                                title={appt.paymentStatus?.toLowerCase() === 'paid' ? "Already Paid" : "Collect Payment ($)"}
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>

                              {/* Eye Action - Details Preview Card */}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700"
                                onClick={() => {
                                  setSelectedAppointment(appt);
                                  setIsDetailsModalOpen(true);
                                }}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>

                              {/* Delete Action */}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
              
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#06B6D4]" />
                  New Walk-in / Phone Booking
                </h2>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsBookingModalOpen(false)}>
                  <X className="w-5 h-5 text-slate-500" />
                </Button>
              </div>

              {/* Progress Indicator */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                {[
                  { step: 1, label: "Appointment Details" },
                  { step: 2, label: "Patient Lookup" },
                  { step: 3, label: "Confirm Booking" },
                ].map((item, idx) => (
                  <div key={item.step} className="flex items-center flex-1 last:flex-initial">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm transition-all duration-200 ${
                        bookingStep === item.step
                          ? 'bg-cyan-500 text-white ring-4 ring-cyan-100'
                          : bookingStep > item.step
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                      }`}>
                        {bookingStep > item.step ? "✓" : item.step}
                      </div>
                      <span className={`text-xs md:text-sm font-semibold transition-all duration-200 ${
                        bookingStep === item.step ? 'text-slate-800 font-bold' : 'text-slate-400'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div className={`h-0.5 flex-1 mx-4 transition-all duration-200 ${
                        bookingStep > item.step ? 'bg-emerald-500' : 'bg-slate-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <form id="booking-form" onSubmit={handleBookAppointment} className="space-y-6">
                  
                  {/* STEP 1: APPOINTMENT DETAILS */}
                  {bookingStep === 1 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Department *</label>
                          <select required className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                            value={formData.department}
                            onChange={e => {
                              setFormData({...formData, department: e.target.value, doctorId: "", doctorName: "", date: ""});
                              setDoctorSearchQuery("");
                            }}
                          >
                            <option value="">Select Department...</option>
                            {departments.map((dept: any) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1 relative" ref={doctorSearchRef}>
                          <label className="text-sm font-semibold text-slate-700">Doctor *</label>
                          <div className="relative">
                            <Input
                              type="text"
                              placeholder="Type to search doctor..."
                              value={doctorSearchQuery}
                              onChange={e => {
                                setDoctorSearchQuery(e.target.value);
                                setIsDoctorDropdownOpen(true);
                                if (e.target.value !== formData.doctorName) {
                                  setFormData(prev => ({ ...prev, doctorId: "", doctorName: "", date: "" }));
                                }
                              }}
                              onFocus={() => setIsDoctorDropdownOpen(true)}
                              className="bg-white border-slate-200 pr-8"
                            />
                            {formData.doctorId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData(prev => ({ ...prev, doctorId: "", doctorName: "", date: "" }));
                                  setDoctorSearchQuery("");
                                }}
                                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          {isDoctorDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {filteredDoctors.length === 0 ? (
                                <div className="p-3 text-sm text-slate-400 text-center">No doctors found</div>
                              ) : (
                                filteredDoctors.map(doc => (
                                  <div
                                    key={doc._id}
                                    onClick={() => handleSelectDoctor(doc)}
                                    className="p-3 text-sm cursor-pointer hover:bg-cyan-50 hover:text-cyan-900 transition-colors border-b border-slate-100 last:border-0"
                                  >
                                    <div className="font-semibold text-slate-800">{doc.name}</div>
                                    <div className="text-xs text-slate-500">{doc.specialization || "General Practitioner"}</div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700 block">Available Date & Time Slots *</label>
                        {formData.doctorId ? (
                          schedules.length === 0 ? (
                            <div className="p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                              No approved schedules available for this doctor
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                              {schedules.map((sch: any) => {
                                const isSelected = formData.date === sch.date;
                                const schDate = new Date(sch.date);
                                const schTime = new Date(sch.startTime);
                                return (
                                  <div
                                    key={sch._id}
                                    onClick={() => setFormData({...formData, date: sch.date})}
                                    className={`p-3 border rounded-xl cursor-pointer transition-all flex flex-col ${
                                      isSelected
                                        ? 'border-cyan-500 bg-cyan-50/50 text-cyan-950 shadow-xs'
                                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="font-semibold text-xs sm:text-sm text-slate-800">
                                      {schDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3 text-cyan-600" />
                                      {schTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ) : (
                          <div className="p-4 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                            Select a department and doctor to see available times.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Visit Type</label>
                        <div className="flex gap-2">
                          {["Consultation", "Follow-up", "Emergency"].map(type => {
                            const isSelected = formData.visitType === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                onClick={() => setFormData({ ...formData, visitType: type })}
                                className={`flex-1 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg border transition-all ${
                                  isSelected
                                    ? 'bg-cyan-500 text-white border-cyan-600 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {type}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* STEP 2: PATIENT LOOKUP */}
                  {bookingStep === 2 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Enter Patient's Phone Number *</label>
                        <div className="relative">
                          <Phone className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                          <Input
                            type="text"
                            placeholder="e.g. 0771234567"
                            value={searchPhone}
                            onChange={(e) => setSearchPhone(e.target.value)}
                            className="pl-11 pr-10 py-6 text-base md:text-lg rounded-xl bg-white border-slate-200 focus-visible:ring-cyan-500"
                          />
                          {searchPhone && (
                            <button
                              type="button"
                              onClick={() => setSearchPhone("")}
                              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">Typing a phone number will search the patient registry automatically.</p>
                      </div>

                      {isSearchingMobile && (
                        <div className="py-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                          <Loader2 className="animate-spin h-5 w-5 text-cyan-500" /> Searching registry...
                        </div>
                      )}

                      {/* Case 1: Existing Patient (Single Match) */}
                      {!isSearchingMobile && selectedPatient && !showRegistrationForm && (
                        <div className="p-5 border border-emerald-100 rounded-2xl bg-emerald-50/20 space-y-4 shadow-sm animate-in fade-in duration-200">
                          <div className="flex items-center justify-between border-b border-emerald-100/50 pb-3">
                            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                              <CheckCircle className="w-5 h-5 text-emerald-500" /> Existing Patient
                            </div>
                            <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200/60 shadow-2xs">
                              Patient ID: {selectedPatient.patientId || "N/A"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-xs text-slate-400 block font-medium">Full Name</span>
                              <span className="font-semibold text-slate-800">{selectedPatient.fullName}</span>
                            </div>
                            <div>
                              <span className="text-xs text-slate-400 block font-medium">Phone Number</span>
                              <span className="font-semibold text-slate-800">{selectedPatient.mobileNumber}</span>
                            </div>
                            {selectedPatient.nicNumber && !selectedPatient.nicNumber.startsWith("WALKIN-NIC-") && (
                              <div>
                                <span className="text-xs text-slate-400 block font-medium">NIC Number</span>
                                <span className="font-medium text-slate-700">{selectedPatient.nicNumber}</span>
                              </div>
                            )}
                            {selectedPatient.dateOfBirth && new Date(selectedPatient.dateOfBirth).getTime() !== new Date("1970-01-01").getTime() && (
                              <div>
                                <span className="text-xs text-slate-400 block font-medium">Date of Birth</span>
                                <span className="font-medium text-slate-700">
                                  {new Date(selectedPatient.dateOfBirth).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                  {isChild(selectedPatient.dateOfBirth) && (
                                    <span className="ml-2 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-semibold">Child</span>
                                  )}
                                </span>
                              </div>
                            )}
                            {selectedPatient.email && !selectedPatient.email.startsWith("walkin-") && (
                              <div className="col-span-1 sm:col-span-2">
                                <span className="text-xs text-slate-400 block font-medium">Email Address</span>
                                <span className="font-medium text-slate-700">{selectedPatient.email}</span>
                              </div>
                            )}
                          </div>
                          
                          {matchingPatients.length > 1 && (
                            <div className="flex justify-end pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedPatient(null);
                                  setIsPatientFound(false);
                                }}
                                className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 h-8"
                              >
                                Select Another Family Member
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Case 2: Multiple Patients Selection */}
                      {!isSearchingMobile && searchPhone.trim().length >= 4 && matchingPatients.length > 1 && !selectedPatient && !showRegistrationForm && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Choose Patient
                            </h4>
                            <span className="text-xs text-slate-400 font-medium">Family members found with this number</span>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {matchingPatients.map((patient) => {
                              const patientDob = patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "";
                              const childTag = patient.dateOfBirth && isChild(patient.dateOfBirth);
                              return (
                                <div
                                  key={patient._id}
                                  onClick={() => handleSelectPatientFromList(patient)}
                                  className="p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-cyan-50/50 hover:border-cyan-200 cursor-pointer transition-all flex items-center justify-between group"
                                >
                                  <div>
                                    <div className="font-semibold text-sm text-slate-800 group-hover:text-cyan-700 transition-colors flex items-center gap-2">
                                      {patient.fullName}
                                      {childTag && (
                                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-full font-semibold">Child</span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500 flex gap-3 mt-1 items-center font-medium">
                                      <span className="font-mono bg-cyan-50 text-cyan-800 px-1.5 py-0.5 rounded text-[10px] border border-cyan-100">
                                        ID: {patient.patientId || "N/A"}
                                      </span>
                                      {patientDob && new Date(patient.dateOfBirth).getTime() !== new Date("1970-01-01").getTime() && (
                                        <span>DOB: {patientDob}</span>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    type="button"
                                    className="text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 font-semibold"
                                  >
                                    Select
                                  </Button>
                                </div>
                              );
                            })}
                            <div
                              onClick={handleChooseRegisterNewPatient}
                              className="p-3 border border-dashed border-cyan-200 rounded-xl bg-cyan-50/10 hover:bg-cyan-50/30 cursor-pointer transition-all flex items-center justify-between group text-cyan-700 font-semibold"
                            >
                              <div className="flex items-center gap-2 text-sm">
                                <Plus className="w-4 h-4 text-cyan-500" /> Register New Patient
                              </div>
                              <span className="text-xs text-cyan-500 font-medium">Create profile</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Case 3: Registration Form */}
                      {!isSearchingMobile && searchPhone.trim().length >= 4 && showRegistrationForm && (
                        <div className="p-5 border border-cyan-100 rounded-2xl bg-cyan-50/10 space-y-4 animate-in fade-in duration-200">
                          <div className="flex justify-between items-center border-b border-cyan-100 pb-3">
                            <h4 className="text-sm font-bold text-cyan-800 flex items-center gap-1.5">
                              <User className="w-4 h-4 text-cyan-500" /> New Patient Registration
                            </h4>
                            {matchingPatients.length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowRegistrationForm(false);
                                  setSelectedPatient(null);
                                  setIsPatientFound(false);
                                }}
                                className="text-slate-500 hover:text-slate-700 h-8"
                              >
                                Back to matching list
                              </Button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600">Full Name *</label>
                              <Input
                                required
                                placeholder="Damidu Abeysinghe"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                className="bg-white border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600">Phone Number *</label>
                              <Input
                                required
                                placeholder="07XXXXXXXX"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="bg-slate-50 border-slate-200 cursor-not-allowed font-medium text-slate-700"
                                readOnly
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600">Date of Birth</label>
                              <Input
                                type="date"
                                value={formData.dob}
                                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                                className="bg-white border-slate-200"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-slate-600">NIC Number (Optional)</label>
                              <Input
                                placeholder="e.g. 2004XXXXXX"
                                value={formData.nic}
                                onChange={(e) => setFormData({ ...formData, nic: e.target.value })}
                                className="bg-white border-slate-200"
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs font-semibold text-slate-600">Email Address (Optional)</label>
                              <Input
                                type="email"
                                placeholder="email@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="bg-white border-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {searchPhone.trim().length < 4 && (
                        <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
                          <Search className="w-6 h-6 text-slate-300" />
                          <span>Enter patient's phone number to search or register.</span>
                        </div>
                      )}

                    </div>
                  )}

                  {/* STEP 3: REASON & PAYMENT & CONFIRMATION */}
                  {bookingStep === 3 && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-slate-700">Reason for Visit</label>
                        <Input
                          placeholder="E.g., Fever, Regular checkup"
                          value={formData.reason}
                          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                          className="bg-white border-slate-200 text-sm py-5"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700 block">Payment Status (Counter Collection) *</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Cash Option */}
                          <div
                            onClick={() => {
                              setBookingPaymentMethod("cash");
                              setFormData({ ...formData, paymentStatus: "paid" });
                            }}
                            className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                              bookingPaymentMethod === "cash"
                                ? 'border-emerald-500 bg-emerald-50/20 text-emerald-950 shadow-xs'
                                : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <DollarSign className={`w-6 h-6 ${bookingPaymentMethod === "cash" ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <div>
                              <span className="font-semibold text-xs sm:text-sm block">Cash</span>
                              <span className="text-[10px] text-slate-500">Collected at counter</span>
                            </div>
                          </div>

                          {/* Card Option */}
                          <div
                            onClick={() => {
                              setBookingPaymentMethod("card");
                              setFormData({ ...formData, paymentStatus: "pending" }); // Card processed after submit
                            }}
                            className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                              bookingPaymentMethod === "card"
                                ? 'border-cyan-500 bg-cyan-50/20 text-cyan-955 shadow-xs'
                                : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <CreditCard className={`w-6 h-6 ${bookingPaymentMethod === "card" ? 'text-cyan-600' : 'text-slate-400'}`} />
                            <div>
                              <span className="font-semibold text-xs sm:text-sm block">Card</span>
                              <span className="text-[10px] text-slate-500">Pay via Stripe now</span>
                            </div>
                          </div>

                          {/* Pending Option */}
                          <div
                            onClick={() => {
                              setBookingPaymentMethod("pending");
                              setFormData({ ...formData, paymentStatus: "pending" });
                            }}
                            className={`p-4 border rounded-xl cursor-pointer transition-all flex flex-col items-center text-center gap-2 ${
                              bookingPaymentMethod === "pending"
                                ? 'border-amber-500 bg-amber-50/20 text-amber-955 shadow-xs'
                                : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            <Clock className={`w-6 h-6 ${bookingPaymentMethod === "pending" ? 'text-amber-600' : 'text-slate-400'}`} />
                            <div>
                              <span className="font-semibold text-xs sm:text-sm block">Pending</span>
                              <span className="text-[10px] text-slate-500">Pay later</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Box */}
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 text-xs md:text-sm animate-in fade-in duration-300">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Booking Summary</h4>
                        <div className="grid grid-cols-2 gap-4 text-slate-600">
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Department</span>
                            <span className="font-semibold text-slate-800">{formData.department}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Doctor</span>
                            <span className="font-semibold text-slate-800">{formData.doctorName}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Date & Time</span>
                            <span className="font-semibold text-slate-800">
                              {formData.date ? new Date(formData.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : ""}
                              {formData.date ? ` at ${new Date(formData.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ""}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] font-bold uppercase">Visit Type</span>
                            <span className="font-semibold text-slate-800">{formData.visitType}</span>
                          </div>
                          <div className="col-span-2 border-t border-slate-200/60 pt-3 flex justify-between items-center text-sm">
                            <div>
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Patient</span>
                              <span className="font-semibold text-slate-800">
                                {showRegistrationForm ? formData.fullName : (selectedPatient?.fullName || "Not Selected")}
                              </span>
                              <span className="text-slate-400 block text-[10px] font-medium mt-0.5 font-mono">
                                Phone: {showRegistrationForm ? formData.phone : (selectedPatient?.mobileNumber || "N/A")}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase">Consultation Fee</span>
                              <span className="font-black text-[#06b6d4] text-base md:text-lg">LKR 3,500</span>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}

                </form>
              </div>

              {/* FOOTER ACTIONS */}
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  {bookingStep > 1 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setBookingStep(prev => prev - 1)}
                    >
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" type="button" onClick={() => setIsBookingModalOpen(false)}>
                    Cancel
                  </Button>
                  
                  {bookingStep < 3 ? (
                    <Button 
                      type="button"
                      disabled={
                        bookingStep === 1 
                          ? (!formData.department || !formData.doctorId || !formData.date)
                          : (!selectedPatient && !(showRegistrationForm && formData.fullName && formData.phone))
                      }
                      onClick={() => setBookingStep(prev => prev + 1)}
                      style={{ backgroundColor: "#06B6D4", color: "#fff" }}
                      className="hover:opacity-90 disabled:opacity-50"
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button 
                      type="button" 
                      onClick={() => handleBookAppointment()}
                      disabled={isSubmitting} 
                      style={{ backgroundColor: "#06B6D4", color: "#fff" }}
                      className="hover:opacity-90 disabled:opacity-50"
                    >
                      {isSubmitting ? "Booking..." : "Confirm Booking"}
                    </Button>
                  )}
                </div>
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


        {/* EYE DETAILS MODAL DIALOG */}
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="sm:max-w-[500px] rounded-3xl p-6 bg-white border border-slate-100 shadow-2xl">
            <DialogTitle className="text-xl font-bold text-slate-900">
              Appointment Details
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Queue number, patient information, and arrival status.
            </DialogDescription>

            {selectedAppointment && (
              <div className="space-y-5 mt-4">
                {/* QUEUE & ARRIVAL STATUS BANNER */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Queue Number</span>
                    <span className="text-3xl font-black text-slate-800">
                      #{selectedAppointment.queueNumber || 0}
                    </span>
                  </div>

                  <div>
                    <button
                      onClick={async () => {
                        const newArrived = !selectedAppointment.arrived;
                        await updateStatus(selectedAppointment._id, 'arrived', newArrived);
                        setSelectedAppointment((prev: any) => (prev ? { ...prev, arrived: newArrived } : null));
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all shadow-sm flex items-center gap-2 ${
                        selectedAppointment.arrived
                          ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle className={`w-4 h-4 ${selectedAppointment.arrived ? 'text-white' : 'text-slate-400'}`} />
                      {selectedAppointment.arrived ? "Arrived" : "Mark Arrived"}
                    </button>
                  </div>
                </div>

                {/* PATIENT DETAILS CARD */}
                <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#06b6d4]" /> Patient Details
                    </span>
                    <span className="text-xs font-mono font-bold bg-cyan-50 text-cyan-800 px-2 py-0.5 rounded border border-cyan-200/60 flex items-center gap-1">
                      <span className="text-cyan-500 font-bold">#</span>{getDisplayPatientId(selectedAppointment)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Full Name</span>
                      <span className="font-semibold text-slate-800">{selectedAppointment.patientId?.fullName || selectedAppointment.patientName || "Unknown"}</span>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Phone Number</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-cyan-600" />
                        {selectedAppointment.patientId?.mobileNumber || selectedAppointment.patientId?.phone || selectedAppointment.phone || "N/A"}
                      </span>
                    </div>

                    {selectedAppointment.patientId?.nicNumber && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">NIC Number</span>
                        <span className="font-medium text-slate-700">{selectedAppointment.patientId.nicNumber}</span>
                      </div>
                    )}

                    {selectedAppointment.patientId?.dateOfBirth && (
                      <div>
                        <span className="text-xs text-slate-400 block font-medium">Date of Birth</span>
                        <span className="font-medium text-slate-700">
                          {new Date(selectedAppointment.patientId.dateOfBirth).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {selectedAppointment.patientId?.email && (
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400 block font-medium">Email Address</span>
                        <span className="font-medium text-slate-700">{selectedAppointment.patientId.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* APPOINTMENT SPECIFICS */}
                <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-[#06b6d4]" /> Doctor & Consultation
                    </span>
                    <span className="text-[11px] font-semibold bg-cyan-100/60 text-cyan-800 px-2 py-0.5 rounded-full">
                      {selectedAppointment.department || "General"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Doctor Name</span>
                      <span className="font-semibold text-slate-800">{selectedAppointment.doctorName || "N/A"}</span>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Visit Type</span>
                      <span className="font-medium text-slate-700">{selectedAppointment.visitType || "Consultation"}</span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-xs text-slate-400 block font-medium">Date & Time</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(selectedAppointment.date).toLocaleDateString()} at {new Date(selectedAppointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {selectedAppointment.reason && (
                      <div className="col-span-2">
                        <span className="text-xs text-slate-400 block font-medium">Reason for Visit</span>
                        <span className="font-medium text-slate-700 italic">"{selectedAppointment.reason}"</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsDetailsModalOpen(false)} className="rounded-xl px-5">
                    Close
                  </Button>
                </div>
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