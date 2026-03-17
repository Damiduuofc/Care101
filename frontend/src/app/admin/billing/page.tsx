"use client";

import React, { useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    FileText, 
    Plus, 
    Printer, 
    Download, 
    DollarSign,
    CheckCircle2,
    Loader2
} from "lucide-react";

// Demo Data
const INITIAL_BILLING = [
    { id: "INV-001", patient: "Nimna Rathnayake", doctor: "Dr. Lasantha Perera", date: "2026-03-17", amount: 3500.00, status: "Paid" },
    { id: "INV-002", patient: "Kamal Gunawardena", doctor: "Dr. Sarah Jayawardena", date: "2026-03-17", amount: 4200.00, status: "Pending" },
];

export default function BillingPage() {
    const [invoices, setInvoices] = useState(INITIAL_BILLING);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [open, setOpen] = useState(false);
    const [formData, setFormData] = useState({ patient: "", doctor: "", amount: "" });

    const handleCreateInvoice = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.patient || !formData.amount) return;
        
        setIsSubmitting(true);

        setTimeout(() => {
            const newInv = {
                id: `INV-00${invoices.length + 1}`,
                patient: formData.patient,
                doctor: formData.doctor || "General Medical",
                date: new Date().toISOString().split('T')[0],
                amount: parseFloat(formData.amount),
                status: "Pending"
            };
            setInvoices([newInv, ...invoices]);
            setIsSubmitting(false);
            setOpen(false);
            setFormData({ patient: "", doctor: "", amount: "" });
        }, 800);
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-64 space-y-6">
                
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Billing & Invoices</h1>
                        <p className="text-slate-500">Manage patient payments and generate receipts.</p>
                    </div>

                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger asChild>
                            <Button className="bg-[#06b6d4] hover:bg-[#0891b2] text-white gap-2 shadow-lg shadow-cyan-500/20">
                                <Plus size={18} /> New Invoice
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="sm:max-w-[450px]">
                            <SheetHeader>
                                <SheetTitle className="text-[#06b6d4] flex items-center gap-2">
                                    <FileText /> Create New Invoice
                                </SheetTitle>
                            </SheetHeader>
                            <form onSubmit={handleCreateInvoice} className="space-y-6 py-8">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="patient">Patient Name</Label>
                                        <Input 
                                            id="patient" 
                                            required 
                                            value={formData.patient}
                                            onChange={(e) => setFormData({...formData, patient: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="doctor">Type</Label>
                                        <Input 
                                            id="doctor" 
                                            value={formData.doctor}
                                            onChange={(e) => setFormData({...formData, doctor: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="amount">Amount (Rs.)</Label>
                                        <Input 
                                            id="amount" 
                                            type="number" 
                                            required 
                                            value={formData.amount}
                                            onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <SheetFooter>
                                    <Button type="submit" className="w-full bg-[#06b6d4] hover:bg-[#0891b2]" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={18} />}
                                        Generate Invoice
                                    </Button>
                                </SheetFooter>
                            </form>
                        </SheetContent>
                    </Sheet>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#06b6d4]"></div>
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-slate-500 uppercase">Revenue</p>
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">
                                    Rs. {invoices.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                                </h3>
                            </div>
                            <div className="h-10 w-10 bg-cyan-50 rounded-lg flex items-center justify-center text-[#06b6d4]">
                                <DollarSign size={20} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-slate-200 shadow-sm bg-white">
                    <CardHeader className="border-b border-slate-100 p-4">
                        <CardTitle className="text-lg font-bold text-slate-800">History</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead>Invoice ID</TableHead>
                                    <TableHead>Patient</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((inv) => (
                                    <TableRow key={inv.id}>
                                        <TableCell className="font-medium">{inv.id}</TableCell>
                                        <TableCell>{inv.patient}</TableCell>
                                        <TableCell className="font-bold">Rs. {inv.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge className={inv.status === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                                                {inv.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#06b6d4]"><Printer size={16} /></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#06b6d4]"><Download size={16} /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}