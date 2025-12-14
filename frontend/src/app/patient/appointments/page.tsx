"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Stethoscope, PlusCircle, CalendarDays, Loader2, XCircle, Receipt, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// ❌ REMOVED DEMO DATA IMPORT: import { departments } from '@/lib/data'; 
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL}`;

// --- 1. MAIN CONTENT COMPONENT ---
function AppointmentsContent() {
    const router = useRouter();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [doctorsList, setDoctorsList] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch Real Data from API
    useEffect(() => {
        const fetchData = async () => {
            const token = sessionStorage.getItem("token");
            if (!token) { router.push("/login"); return; }

            try {
                // 1. Get My Appointments
                const appRes = await fetch(`${API_URL}/appointments/my-appointments`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                
                // 2. Get All Doctors (to populate booking form)
                const docRes = await fetch(`${API_URL}/doctors/list`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (appRes.ok && docRes.ok) {
                    setAppointments(await appRes.json());
                    setDoctorsList(await docRes.json());
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [refreshTrigger, router]);

    // Handle Cancel (Real API Call)
    const handleCancel = async (id: string) => {
        if (!confirm("Are you sure you want to cancel this appointment?")) return;
        const token = sessionStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/appointments/cancel/${id}`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                alert("Appointment Cancelled.");
                setRefreshTrigger(prev => prev + 1); // Refresh list
            } else {
                alert("Failed to cancel.");
            }
        } catch (error) {
            alert("Server Error");
        }
    };

    const sectionVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-cyan-600" /></div>;

    return (
        <motion.div className="space-y-8 max-w-7xl mx-auto p-6" initial="hidden" animate="visible" variants={sectionVariants}>
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline text-slate-900">Appointments</h1>
                    <p className="text-slate-500">Manage your bookings. Status is updated by reception.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Tabs defaultValue="upcoming" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-xl">
                            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                            <TabsTrigger value="completed">History</TabsTrigger>
                            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="upcoming">
                            <AppointmentList appointments={appointments} filterStatus={['Pending', 'Confirmed']} onCancel={handleCancel} />
                        </TabsContent>
                        <TabsContent value="completed">
                            <AppointmentList appointments={appointments} filterStatus={['Completed']} />
                        </TabsContent>
                        <TabsContent value="cancelled">
                            <AppointmentList appointments={appointments} filterStatus={['Cancelled']} />
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="space-y-6">
                    {/* Pass real doctors list to form */}
                    <BookingForm doctors={doctorsList} onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
                </div>
            </div>
        </motion.div>
    );
}

// --- 2. LIST COMPONENT ---
function AppointmentList({ appointments, filterStatus, onCancel }: { appointments: any[], filterStatus: string[], onCancel?: (id: string) => void }) {
    
    // Case-Insensitive Filter
    const filtered = appointments.filter(app => 
        filterStatus.some(status => status.toLowerCase() === app.status.toLowerCase())
    );
    
    const getStatusStyle = (status: string) => {
        const normalized = status.toLowerCase();
        if (normalized === 'pending') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        if (normalized === 'confirmed') return 'bg-green-100 text-green-700 border-green-200';
        if (normalized === 'cancelled') return 'bg-red-100 text-red-700 border-red-200';
        if (normalized === 'completed') return 'bg-slate-100 text-slate-700 border-slate-200';
        return 'bg-gray-100 text-gray-700'; 
    };

    if (filtered.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-4">
                <CalendarDays className="h-10 w-10 mb-2 opacity-50" />
                <p>No appointments found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 mt-4">
            {filtered.map(app => (
                <Card key={app._id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                    <CardContent className="p-5 flex flex-col sm:flex-row gap-4">
                        <div className="hidden sm:flex flex-col items-center justify-center bg-cyan-50 text-cyan-700 rounded-lg w-20 h-full min-h-[5rem] border border-cyan-100 flex-shrink-0">
                            <span className="text-xs font-bold uppercase">{new Date(app.date).toLocaleString('default', { month: 'short' })}</span>
                            <span className="text-2xl font-bold">{new Date(app.date).getDate()}</span>
                        </div>
                        <div className="flex-grow space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-lg text-slate-900">{app.doctorName}</h3>
                                <Badge className={cn("border px-2.5 py-0.5 capitalize", getStatusStyle(app.status))}>
                                    {app.status}
                                </Badge>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    <Stethoscope className="h-4 w-4 text-cyan-600" />
                                    <span>{app.department}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-cyan-600" />
                                    <span>{new Date(app.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                                <div className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                                    <Coins className="h-4 w-4 text-yellow-600" />
                                    <span>LKR {app.amount ? app.amount.toLocaleString() : "0"}.00</span>
                                </div>

                                {onCancel && (['pending', 'confirmed'].includes(app.status.toLowerCase())) && (
                                    <Button variant="ghost" size="sm" onClick={() => onCancel(app._id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto h-8 px-3">
                                        <XCircle className="h-4 w-4 mr-1.5" /> Cancel
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// --- 3. BOOKING FORM (DYNAMIC REAL DATA) ---
function BookingForm({ onSuccess, doctors }: { onSuccess: () => void, doctors: any[] }) {
    const [date, setDate] = useState<Date>();
    const searchParams = useSearchParams();
    const preSelectedDocId = searchParams.get('preSelectedDocId');

    const [formData, setFormData] = useState({
        department: "",
        doctorName: "",
        doctorId: "",
        visitType: "Channeling",
        reason: ""
    });
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // ✅ EXTRACT UNIQUE DEPARTMENTS FROM REAL DOCTORS LIST
    const availableDepartments = Array.from(
        new Set(doctors.map(doc => doc.specialization || doc.department))
    ).filter(Boolean).sort();

    useEffect(() => {
        if (preSelectedDocId && doctors.length > 0) {
            const doc = doctors.find(d => d._id === preSelectedDocId);
            if (doc) {
                setFormData(prev => ({
                    ...prev,
                    department: doc.specialization,
                    doctorId: doc._id,
                    doctorName: doc.name
                }));
            }
        }
    }, [preSelectedDocId, doctors]);

    const DOCTOR_FEE = 2000;
    const HOSPITAL_FEE = 1870;
    const TOTAL_FEE = DOCTOR_FEE + HOSPITAL_FEE;

    // Filter doctors based on selected department
    const filteredDoctors = formData.department 
        ? doctors.filter(doc => doc.specialization === formData.department)
        : doctors;

    const handleInitialSubmit = () => {
        if(!date || !formData.department || !formData.doctorName || !formData.doctorId) {
            alert("Please select a Department, Doctor, and Date.");
            return;
        }
        setSummaryOpen(true);
    };

    const handleFinalBooking = async () => {
        setSubmitting(true);
        const token = sessionStorage.getItem("token");

        try {
            const res = await fetch(`${API_URL}/appointments/book`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    doctorId: formData.doctorId, 
                    doctorName: formData.doctorName,
                    department: formData.department,
                    visitType: formData.visitType,
                    reason: formData.reason,
                    date: date?.toISOString(),
                    amount: TOTAL_FEE
                })
            });

            if (res.ok) {
                alert("Booking Confirmed!");
                onSuccess();
                setFormData({ department: "", doctorName: "", doctorId: "", visitType: "Channeling", reason: "" });
                setDate(undefined);
                setSummaryOpen(false);
            } else {
                alert("Failed to book appointment.");
            }
        } catch (error) {
            alert("Server Error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Card className="border-cyan-100 shadow-md sticky top-24">
                <CardHeader className="bg-cyan-50/50 pb-4 border-b border-cyan-100">
                    <CardTitle className="flex items-center gap-2 text-cyan-800">
                        <PlusCircle className="h-5 w-5"/> Book Appointment
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    
                    {/* Dynamic Department Select */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Department</label>
                        <Select value={formData.department} onValueChange={(val) => setFormData(prev => ({ ...prev, department: val, doctorName: "", doctorId: "" }))}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Select department" /></SelectTrigger>
                            <SelectContent>
                                {availableDepartments.length > 0 ? (
                                    availableDepartments.map((dept: any) => (
                                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                    ))
                                ) : (
                                    <div className="p-2 text-sm text-slate-500 text-center">No departments available</div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Doctor</label>
                        <Select value={formData.doctorId} onValueChange={(val) => {
                                const selectedDoc = doctors.find(d => d._id === val);
                                if (selectedDoc) setFormData(prev => ({ ...prev, doctorId: val, doctorName: selectedDoc.name }));
                            }}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Select doctor">{formData.doctorName || "Select doctor"}</SelectValue></SelectTrigger>
                            <SelectContent>
                               {filteredDoctors.length > 0 ? (
                                   filteredDoctors.map(doc => <SelectItem key={doc._id} value={doc._id}>{doc.name}</SelectItem>)
                               ) : <div className="p-2 text-sm text-slate-500 text-center">No doctors found</div>}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Visit Type</label>
                        <Select defaultValue="Channeling" onValueChange={(val) => setFormData({...formData, visitType: val})}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Select type" /></SelectTrigger>
                            <SelectContent><SelectItem value="Channeling">Channeling</SelectItem><SelectItem value="Surgery">Surgery Consultation</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Preferred Date</label>
                         <Popover>
                          <PopoverTrigger asChild>
                              <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal bg-white", !date && "text-muted-foreground")}>
                                <CalendarDays className="mr-2 h-4 w-4" />{date ? format(date, "PPP") : <span>Pick a date</span>}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus disabled={(date) => date < new Date()} /></PopoverContent>
                        </Popover>
                    </div>
                     <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Reason</label>
                        <Textarea placeholder="Briefly describe symptoms..." className="bg-white resize-none" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value})}/>
                     </div>

                    <Button className="w-full bg-cyan-600 hover:bg-cyan-700 mt-2" onClick={handleInitialSubmit}>
                        Review & Book
                    </Button>
                </CardContent>
            </Card>

            <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-800">
                            <Receipt className="h-5 w-5 text-cyan-600"/> Booking Summary
                        </DialogTitle>
                        <DialogDescription>
                            Review the details and total cost before confirming.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg space-y-3 border border-slate-100">
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Doctor Fee</span>
                                <span>LKR {DOCTOR_FEE.toLocaleString()}.00</span>
                            </div>
                            <div className="flex justify-between text-sm text-slate-600">
                                <span>Hospital Charges</span>
                                <span>LKR {HOSPITAL_FEE.toLocaleString()}.00</span>
                            </div>
                            <div className="h-px bg-slate-200 my-2"></div>
                            <div className="flex justify-between font-bold text-lg text-slate-900">
                                <span>Total Payable</span>
                                <span>LKR {TOTAL_FEE.toLocaleString()}.00</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 text-center">
                            Payment will be collected at the reception counter.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSummaryOpen(false)}>Cancel</Button>
                        <Button onClick={handleFinalBooking} disabled={submitting} className="bg-cyan-600 hover:bg-cyan-700">
                            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Confirm Booking
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

// --- 4. EXPORT WITH SUSPENSE ---
export default function AppointmentsPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Appointments...</div>}>
            <AppointmentsContent />
        </Suspense>
    );
}