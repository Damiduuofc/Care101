"use client";

import { useEffect, useState, useRef, Suspense } from 'react'; 
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, CreditCard, Loader2, CheckCircle, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API_URL = "http://localhost:5000/api/billing";

// --- 1. PDF GENERATOR ---
const generateInvoice = (paidBills: any[]) => {
    const doc = new jsPDF();

    // Branding
    doc.setFontSize(22);
    doc.setTextColor(0, 150, 136); // Cyan
    doc.text("Care 101 Health Center", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("123 Wellness Drive, Colombo 07", 14, 26);
    doc.text("Tel: +94 11 234 5678 | Email: billing@care101.lk", 14, 31);
    doc.setLineWidth(0.5);
    doc.setDrawColor(200);
    doc.line(14, 35, 196, 35);

    // Invoice Info
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("PAYMENT RECEIPT", 14, 45);
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 52);
    doc.text(`Receipt ID: #${Math.floor(Math.random() * 1000000)}`, 14, 57);

    // Table
    const tableRows = paidBills.map(bill => [
        new Date(bill.date).toLocaleDateString(),
        bill.title,
        bill.type,
        `LKR ${bill.amount.toLocaleString()}.00`
    ]);

    autoTable(doc, {
        startY: 65,
        head: [['Date', 'Service / Item', 'Type', 'Amount']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 150, 136] },
        styles: { fontSize: 10 },
    });

    // Total
    const totalAmount = paidBills.reduce((sum, b) => sum + b.amount, 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Paid: LKR ${totalAmount.toLocaleString()}.00`, 140, finalY);

    doc.save("Care101_Invoice.pdf");
};

// --- 2. MAIN CONTENT ---
function BillingContent() {
    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    
    // Safety Lock to prevent double-processing crash
    const processedRef = useRef(false);
    
    const searchParams = useSearchParams();
    const router = useRouter();

    const fetchBills = async () => {
        const token = sessionStorage.getItem("token");
        if (!token) { router.replace('/login'); return; }

        try {
            const res = await fetch(API_URL, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                sessionStorage.clear();
                router.replace('/login');
                return;
            }
            if (res.ok) setBills(await res.json());
        } catch (error) {
            console.error("Error fetching bills");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBills(); }, []);

    // HANDLE SUCCESS REDIRECT FROM STRIPE
    useEffect(() => {
        const success = searchParams.get('success');
        const idsString = searchParams.get('billIds');

        if (success === 'true' && idsString && !processedRef.current) {
            processedRef.current = true; // Lock
            const billIds = idsString.split(',');

            const completePayment = async () => {
                const token = sessionStorage.getItem("token");
                try {
                    // 1. Mark Paid in Backend
                    await fetch(`${API_URL}/mark-paid`, {
                        method: "PUT",
                        headers: { 
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}` 
                        },
                        body: JSON.stringify({ billIds })
                    });

                    // 2. Refresh Data & Clean URL
                    alert("Payment Successful! Generating Invoice...");
                    
                    // Fetch fresh data to generate PDF
                    const res = await fetch(API_URL, { headers: { "Authorization": `Bearer ${token}` } });
                    const allBills = await res.json();
                    
                    // Filter the items we just paid
                    const paidItems = allBills.filter((b: any) => billIds.includes(b._id));
                    
                    if (paidItems.length > 0) {
                        generateInvoice(paidItems);
                    }
                    
                    setBills(allBills); // Update UI
                    router.replace('/patient/billing'); // Clean URL

                } catch (error) {
                    console.error("Payment update failed", error);
                }
            };
            completePayment();
        }
    }, [searchParams, router]);

    // HANDLE PAYMENT TRIGGER
    const handlePay = async (billIds: string[]) => {
        setProcessing(true);
        const token = sessionStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/create-checkout-session`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}` 
                },
                body: JSON.stringify({ billIds })
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch (error) {
            alert("Server Error");
            setProcessing(false);
        }
    };

    const pendingBills = bills.filter(b => b.status === 'Pending');
    const completedBills = bills.filter(b => b.status === 'Paid');
    const totalDue = pendingBills.reduce((sum, item) => sum + item.amount, 0);
    const totalPaid = completedBills.reduce((sum, item) => sum + item.amount, 0);

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-cyan-600" /></div>;

    return (
        <motion.div className="space-y-8 max-w-7xl mx-auto p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div>
                <h1 className="text-3xl font-bold font-headline text-slate-900">Billing & Payments</h1>
                <p className="text-slate-500">Manage your medical bills.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-red-100 bg-red-50/30">
                    <CardHeader><CardTitle className="text-red-700">Total Due</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold text-red-600">LKR {totalDue.toLocaleString()}.00</p></CardContent>
                </Card>
                <Card className="border-green-100 bg-green-50/30">
                    <CardHeader><CardTitle className="text-green-700">Total Paid</CardTitle></CardHeader>
                    <CardContent><p className="text-3xl font-bold text-green-600">LKR {totalPaid.toLocaleString()}.00</p></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Insurance</CardTitle></CardHeader>
                    <CardContent><p className="text-xl font-semibold">Active</p><p className="text-sm text-slate-500">FairHealth Plus</p></CardContent>
                </Card>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
                    <TabsList className="grid w-full sm:w-[400px] grid-cols-2 bg-slate-100">
                        <TabsTrigger value="pending">Pending ({pendingBills.length})</TabsTrigger>
                        <TabsTrigger value="completed">History</TabsTrigger>
                    </TabsList>

                    {/* PAY ALL BUTTON */}
                    {pendingBills.length > 0 && (
                        <Button 
                            className="bg-slate-900 hover:bg-slate-800 shadow-md w-full sm:w-auto"
                            onClick={() => handlePay(pendingBills.map(b => b._id))}
                            disabled={processing}
                        >
                            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CreditCard className="mr-2 h-4 w-4"/>}
                            Pay All (LKR {totalDue.toLocaleString()})
                        </Button>
                    )}
                </div>
                
                <TabsContent value="pending">
                    <PaymentList items={pendingBills} isPending onPay={(id) => handlePay([id])} processing={processing} />
                </TabsContent>
                <TabsContent value="completed">
                    <PaymentList items={completedBills} />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}

// --- 3. LIST COMPONENT ---
function PaymentList({ 
    items, 
    isPending = false, 
    onPay, 
    processing = false 
}: { 
    items: any[], 
    isPending?: boolean, 
    onPay?: (id: string) => void, 
    processing?: boolean 
}) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 mt-4">
                <CheckCircle className="h-10 w-10 mb-2 opacity-20" />
                <p>{isPending ? "No pending bills." : "No payment history."}</p>
            </div>
        );
    }
    return (
        <div className="space-y-4">
            {items.map((item: any) => (
                <Card key={item._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                       <div className='flex-grow'>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${item.type === 'Appointment' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>{item.type}</span>
                                <span className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
                            </div>
                            <p className="font-bold text-lg text-slate-900">{item.title}</p>
                            <p className="text-sm text-slate-500">Invoice #{item._id.slice(-6).toUpperCase()}</p>
                       </div>
                       <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                            <p className={`text-xl font-bold ${isPending ? 'text-red-600' : 'text-slate-900'}`}>LKR {item.amount.toLocaleString()}.00</p>
                            
                            {isPending && onPay && (
                                <Button 
                                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800" 
                                    onClick={() => onPay(item._id)} 
                                    disabled={processing}
                                >
                                    {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CreditCard className="mr-2 h-4 w-4"/>} 
                                    Pay Now
                                </Button>
                            )}
                            
                            {!isPending && (
                                <Button 
                                    variant="outline" 
                                    className="w-full sm:w-auto border-slate-200 text-slate-700" 
                                    onClick={() => generateInvoice([item])}
                                >
                                    <FileText className="mr-2 h-4 w-4"/> Invoice PDF
                                </Button>
                            )}
                       </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// --- 4. EXPORT ---
export default function BillingPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Billing...</div>}>
            <BillingContent />
        </Suspense>
    );
}