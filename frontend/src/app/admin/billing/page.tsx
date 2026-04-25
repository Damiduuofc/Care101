"use client";

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    FileText,
    Plus,
    Printer,
    Download,
    DollarSign,
    CheckCircle2,
    Loader2,
    Search,
    User,
    CreditCard,
    Wallet,
    Clock,
    X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import InvoiceTemplate from "@/components/admin/InvoiceTemplate";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function BillingPage() {
    const { toast } = useToast();
    const [history, setHistory] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);

    // Search State
    const [searchNic, setSearchNic] = useState("");
    const [searching, setSearching] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        type: "Appointment",
        amount: "",
        paymentMethod: "App", // "Cash" or "App"
        doctorId: "" // Added to store selected doctor for surgery
    });

    // Print State
    const [selectedBill, setSelectedBill] = useState<any>(null);
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const invoiceRef = useRef<HTMLDivElement>(null);

    const handlePrint = (bill: any) => {
        setSelectedBill(bill);
        setShowPrintDialog(true);
    };

    const triggerPrint = () => {
        const printContent = invoiceRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Invoice - ${selectedBill?._id}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            @page { margin: 0; }
                            body { margin: 1cm; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

const fetchHistoryAndDoctors = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("adminToken");
            const headers = {
                "x-auth-token": token || "",
                "ngrok-skip-browser-warning": "true"
            };

            const [historyRes, doctorsRes] = await Promise.all([
                fetch(`${API_URL}/admin/bills/all`, { headers }),
fetch(`${API_URL}/admin/doctors`, { headers })
            ]);

            if (historyRes.ok) {
                const historyData = await historyRes.json();
                setHistory(historyData);
            }
            
            if (doctorsRes.ok) {
                const doctorsData = await doctorsRes.json();
                
                // Add this log right here:
                console.log("DOCTORS API RESPONSE:", doctorsData); 
                
                // Let's make it bulletproof. 
                // If the backend sends { doctors: [...] }, extract it.
                if (Array.isArray(doctorsData)) {
                    setDoctors(doctorsData);
                } else if (doctorsData.doctors && Array.isArray(doctorsData.doctors)) {
                    setDoctors(doctorsData.doctors);
                } else if (doctorsData.data && Array.isArray(doctorsData.data)) {
                    setDoctors(doctorsData.data);
                } else {
                    console.error("Could not find the doctor array in the response!");
                    setDoctors([]);
                }
            }
        } catch (e) {
            console.error("Fetch Error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistoryAndDoctors();
    }, []);

    const handleSearchPatient = async () => {
        if (!searchNic) return;
        setSearching(true);
        setSelectedPatient(null);
        try {
            const token = localStorage.getItem("adminToken");
            const res = await fetch(`${API_URL}/admin/patients/search/nic/${searchNic}`, {
                headers: {
                    "x-auth-token": token || "",
                    "ngrok-skip-browser-warning": "true"
                }
            });
            const data = await res.json();
            if (res.ok) {
                setSelectedPatient(data);
                toast({ title: "Success", description: `Patient ${data.fullName} found.` });
            } else {
                toast({ title: "Not Found", description: data.msg || "Patient not found.", variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Error", description: "Error searching patient.", variant: "destructive" });
        } finally {
            setSearching(false);
        }
    };

    const handleCreateBill = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || !formData.amount || !formData.title) {
            toast({ title: "Missing Info", description: "Please fill all required fields", variant: "destructive" });
            return;
        }

        if (formData.type === "Surgery" && !formData.doctorId) {
            toast({ title: "Missing Info", description: "Please select a surgeon", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("adminToken");
            const headers = {
                "Content-Type": "application/json",
                "x-auth-token": token || "",
                "ngrok-skip-browser-warning": "true"
            };

            // 1. Create the Bill
            const res = await fetch(`${API_URL}/admin/bills/create`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    patientId: selectedPatient._id,
                    doctorId: formData.type === "Surgery" ? formData.doctorId : undefined,
                    title: formData.title,
                    type: formData.type,
                    amount: parseFloat(formData.amount),
                    status: formData.paymentMethod === "Cash" ? "Paid" : "Pending"
                })
            });

            const data = await res.json();
            
            if (res.ok) {
                // 2. ONLY allocate the 75% from the frontend if they paid CASH right now.
                // If it is an "App" payment, the backend must handle this when the payment completes.
if (formData.type === "Surgery" && formData.doctorId && formData.paymentMethod === "Cash") {
    const doctorShare = parseFloat(formData.amount) * 0.75;
    try {
        await fetch(`${API_URL}/admin/doctors/finance/add`, {
           // ... you can delete this whole try/catch block
        });
    } catch (financeErr) {
        // ...
    }
}

                toast({ title: "Bill Issued", description: formData.paymentMethod === "Cash" ? "Paid by cash successfully" : "Bill sent to patient app" });
                setOpen(false);
                setFormData({ title: "", type: "Appointment", amount: "", paymentMethod: "App", doctorId: "" });
                setSelectedPatient(null);
                setSearchNic("");
                setHistory([data.bill, ...history]);

                // Automatically show print dialog for the new bill
                setSelectedBill(data.bill);
                setShowPrintDialog(true);
            } else {
                toast({ title: "Failed", description: data.msg || "Failed to create bill", variant: "destructive" });
            }
        } catch (error) {
            toast({ title: "Error", description: "Server error", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 space-y-6">

                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Hospital Billing</h1>
                        <p className="text-slate-500">Search patients and issue medical bills.</p>
                    </div>

                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button className="bg-[#06b6d4] hover:bg-[#0891b2] text-white gap-2 shadow-lg shadow-cyan-500/20">
                                <Plus size={18} /> Issue New Bill
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="sm:max-w-[500px] overflow-y-auto">
                            <SheetHeader>
                                <SheetTitle className="text-[#06b6d4] flex items-center gap-2">
                                    <FileText /> Create New Medical Bill
                                </SheetTitle>
                            </SheetHeader>

                            <div className="space-y-6 py-6">
                                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Search by NIC Number..."
                                                className="pl-10 h-11"
                                                value={searchNic}
                                                onChange={(e) => setSearchNic(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
                                            />
                                        </div>
                                        <Button onClick={handleSearchPatient} disabled={searching} variant="outline" className="h-11">
                                            {searching ? <Loader2 className="animate-spin" size={16} /> : "Search"}
                                        </Button>
                                    </div>

                                    {selectedPatient && (
                                        <div className="mt-4 p-3 bg-white rounded-lg border border-cyan-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                            <div className="h-10 w-10 bg-cyan-50 rounded-full flex items-center justify-center text-cyan-600">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{selectedPatient.fullName}</p>
                                                <p className="text-xs text-slate-500 font-medium tracking-tight">NIC: {selectedPatient.nicNumber}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <form onSubmit={handleCreateBill} className="space-y-5">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="title">Bill Description</Label>
                                            <Input
                                                id="title"
                                                placeholder="e.g. Heart Surgery Fees, Lab Reports..."
                                                required
                                                className="h-11 shadow-sm"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Bill Type</Label>
                                                <Select
                                                    value={formData.type}
                                                    onValueChange={(v) => {
                                                        // Reset doctor selection if type changes from Surgery to something else
                                                        setFormData({ ...formData, type: v, doctorId: v !== "Surgery" ? "" : formData.doctorId })
                                                    }}
                                                >
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Appointment">Consultation</SelectItem>
                                                        <SelectItem value="Lab">Laboratory</SelectItem>
                                                        <SelectItem value="Surgery">Surgery</SelectItem>
                                                        <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="amount">Amount (Rs.)</Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    required
                                                    className="h-11 shadow-sm"
                                                    placeholder="2500"
                                                    value={formData.amount}
                                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                />
                                            </div>

                                            {/* Doctor Dropdown specifically for Surgery */}
                                            {formData.type === "Surgery" && (
                                                <div className="space-y-2 col-span-2 animate-in fade-in slide-in-from-top-2">
                                                    <Select
                                                        value={formData.doctorId}
                                                        onValueChange={(v) => setFormData({ ...formData, doctorId: v })}
                                                    >
                                                        <SelectTrigger className="h-11 border-[#06b6d4]">
                                                            <SelectValue placeholder="Select Doctor" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {doctors.length > 0 ? (
                                                                doctors.map(doc => (
                                                                    <SelectItem key={doc._id} value={doc._id}>
                                                                        Dr. {doc.fullName || doc.name}
                                                                    </SelectItem>
                                                                ))
                                                            ) : (
                                                                <SelectItem value="loading" disabled>No doctors found...</SelectItem>
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <Label>Payment Strategy</Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, paymentMethod: "Cash" })}
                                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${formData.paymentMethod === "Cash" ? "border-[#06b6d4] bg-cyan-50 shadow-sm" : "border-slate-100 hover:border-slate-200"}`}
                                                >
                                                    <Wallet className={formData.paymentMethod === "Cash" ? "text-[#06b6d4]" : "text-slate-400"} />
                                                    <span className={`text-xs font-bold ${formData.paymentMethod === "Cash" ? "text-[#06b6d4]" : "text-slate-500"}`}>CASH (PAID)</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, paymentMethod: "App" })}
                                                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${formData.paymentMethod === "App" ? "border-[#06b6d4] bg-cyan-50 shadow-sm" : "border-slate-100 hover:border-slate-200"}`}
                                                >
                                                    <CreditCard className={formData.paymentMethod === "App" ? "text-[#06b6d4]" : "text-slate-400"} />
                                                    <span className={`text-xs font-bold ${formData.paymentMethod === "App" ? "text-[#06b6d4]" : "text-slate-500"}`}>SEND TO APP</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <SheetFooter className="pt-4">
                                        <Button
                                            type="submit"
                                            className="w-full bg-[#06b6d4] hover:bg-[#0891b2] h-12 text-lg shadow-lg shadow-cyan-500/20"
                                            disabled={isSubmitting || !selectedPatient}
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="animate-spin mr-2" />
                                            ) : (
                                                formData.paymentMethod === "Cash" ? <CheckCircle2 className="mr-2" size={20} /> : <FileText className="mr-2" size={20} />
                                            )}
                                            {formData.paymentMethod === "Cash" ? "Confirm Cash Payment" : "Issue & Send to App"}
                                        </Button>
                                    </SheetFooter>
                                </form>
                            </div>
                        </SheetContent>
                    </Sheet>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#06b6d4]"></div>
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">Total Revenue</p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                    LKR {history.reduce((acc, curr) => {
                                        const isPaid = curr.status?.toLowerCase() === "paid" || curr.paymentStatus?.toLowerCase() === "paid";
                                        
                                        if (isPaid) {
                                            // If it's a Surgery, the hospital only keeps 25%. Otherwise, 100%.
                                            const hospitalShare = curr.type === "Surgery" ? (curr.amount * 0.25) : curr.amount;
                                            return acc + (hospitalShare || 0);
                                        }
                                        
                                        return acc;
                                    }, 0).toLocaleString()}
                                </h3>
                            </div>
                            <div className="h-10 w-10 bg-cyan-50 rounded-lg flex items-center justify-center text-[#06b6d4]">
                                <DollarSign size={20} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="border-b border-slate-100 p-4 bg-slate-50/50 flex flex-row items-center justify-between">
                        <CardTitle className="text-lg font-bold text-slate-800">Billing History</CardTitle>
                        <Button variant="ghost" className="h-8 text-xs text-[#06b6d4]" onClick={fetchHistoryAndDoctors}>
                            <Clock className="mr-2 h-3 w-3" /> Refresh history
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-20 text-center flex flex-col items-center gap-3">
                                <Loader2 className="animate-spin text-[#06b6d4]" size={32} />
                                <p className="text-sm text-slate-400 font-medium">Loading history...</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow>
                                        <TableHead className="w-[100px]">Status</TableHead>
                                        <TableHead>Patient Details</TableHead>
                                        <TableHead>Bill Title</TableHead>
                                        <TableHead>Amount</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {history.length > 0 ? history.map((inv, idx) => (
                                        <TableRow key={inv._id || idx}>
                                            <TableCell>
                                                <Badge className={inv.status === "Paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                                                    {inv.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium text-slate-900">{inv.patientId?.fullName || "Patient"}</p>
                                                <p className="text-xs text-slate-500 font-medium">{inv.patientId?.nicNumber}</p>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm font-medium text-slate-800">{inv.title}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{inv.type}</p>
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-900">Rs. {inv.amount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-[#06b6d4]"
                                                        onClick={() => handlePrint(inv)}
                                                    >
                                                        <Printer size={16} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500"><Download size={16} /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-20">
                                                <div className="flex flex-col items-center gap-3">
                                                    <CreditCard size={48} className="text-slate-200" />
                                                    <p className="text-sm text-slate-400 font-medium">No billing records found.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Print Dialog */}
                <Dialog open={showPrintDialog} onOpenChange={setShowPrintDialog}>
                    <DialogContent className="max-w-[900px] p-0 overflow-hidden bg-slate-100 border-none">
                        <div className="p-4 bg-white border-b flex justify-between items-center">
                            <DialogTitle className="font-bold text-slate-800 flex items-center gap-2">
                                <Printer size={18} className="text-[#06b6d4]" />
                                Print Preview
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Invoice print preview for medical bill.
                            </DialogDescription>
                            <div className="flex gap-2">
                                <Button onClick={triggerPrint} className="bg-[#06b6d4] hover:bg-[#0891b2] text-white gap-2">
                                    <Printer size={16} /> Print Invoice
                                </Button>
                                <Button variant="outline" onClick={() => setShowPrintDialog(false)}>
                                    <X size={16} className="mr-2" /> Close
                                </Button>
                            </div>
                        </div>
                        <div className="p-8 max-h-[80vh] overflow-y-auto">
                            <div className="bg-white shadow-2xl mx-auto">
                                <InvoiceTemplate ref={invoiceRef} bill={selectedBill} />
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
