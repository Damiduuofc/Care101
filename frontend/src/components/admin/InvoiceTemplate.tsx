import React from "react";
import { Badge } from "@/components/ui/badge";

interface InvoiceProps {
    bill: {
        _id: string;
        title: string;
        type: string;
        amount: number;
        status: string;
        date: string;
        patientId: {
            fullName: string;
            nicNumber: string;
        };
    };
}

const InvoiceTemplate = React.forwardRef<HTMLDivElement, InvoiceProps>(({ bill }, ref) => {
    if (!bill) return null;

    const formattedDate = new Date(bill.date).toLocaleDateString("en-US", {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div ref={ref} className="p-10 bg-white text-slate-900 font-sans max-w-[800px] mx-auto border border-slate-200 shadow-sm print:shadow-none print:border-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-blue-600 tracking-tighter mb-1">Suwasevana Hospital</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Medical Center & Hospital</p>
                    <div className="mt-4 text-sm text-slate-500">
                        <p>532 Peradeniya Rd, Kandy 20000</p>
                        <p>Email: contactus@suwasevana.lk</p>
                        <p>Phone: 0812 223 223</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-2xl font-bold uppercase tracking-tight text-slate-800">Invoice / Receipt</h2>
                    <p className="text-slate-500 text-sm mt-1">ID: {bill._id.slice(-8).toUpperCase()}</p>
                    <p className="text-slate-500 text-sm">Date: {formattedDate}</p>
                    <div className="mt-4">
                        <Badge className={`${bill.status === "Paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"} px-3 py-1 text-xs font-bold uppercase`}>
                            {bill.status}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-12 mb-10">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Patient Information</h3>
                    <p className="text-lg font-bold text-slate-900">{bill.patientId?.fullName}</p>
                    <p className="text-sm text-slate-600 mt-1">NIC: {bill.patientId?.nicNumber}</p>
                </div>
                <div className="p-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Payment Details</h3>
                    <p className="text-sm text-slate-600">Method: {bill.status === "Paid" ? "Cash / App" : "Pending App Payment"}</p>
                    <p className="text-sm text-slate-600 mt-1">Category: {bill.type}</p>
                </div>
            </div>

            {/* Bill Table */}
            <div className="mb-10">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                            <th className="py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-50">
                            <td className="py-6">
                                <p className="font-bold text-slate-800">{bill.title}</p>
                                <p className="text-xs text-slate-500 mt-1 uppercase font-medium">{bill.type}</p>
                            </td>
                            <td className="py-6 text-right font-bold text-slate-900">
                                Rs. {bill.amount.toLocaleString()}.00
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-64 space-y-3">
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span>Rs. {bill.amount.toLocaleString()}.00</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Tax (0%)</span>
                        <span>Rs. 0.00</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                        <span className="text-lg font-black text-slate-900">Total</span>
                        <span className="text-2xl font-black text-[#06b6d4]">Rs. {bill.amount.toLocaleString()}.00</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="pt-10 border-t border-slate-100 text-center">
                <p className="text-sm font-bold text-slate-800">Thank you for choosing Suwasevana Hospital</p>
            </div>
        </div>
    );
});

InvoiceTemplate.displayName = "InvoiceTemplate";

export default InvoiceTemplate;
