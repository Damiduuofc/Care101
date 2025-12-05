
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, CreditCard, CheckCircle } from 'lucide-react';
import { pendingPayments, completedPayments } from '@/lib/patient-data';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export default function BillingPage() {
    const totalDue = pendingPayments.reduce((sum, item) => sum + item.amount, 0);
    const totalPaid = completedPayments.reduce((sum, item) => sum + item.amount, 0);
    
    const sectionVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };
    
    return (
        <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
        >
            <div>
                <h1 className="text-3xl font-bold font-headline">Billing & Payments</h1>
                <p className="text-muted-foreground">View and manage your medical bills.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Total Due</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-destructive">
                            {totalDue.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Total Paid</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold text-green-600">
                             {totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Insurance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xl font-semibold">Active</p>
                        <p className="text-sm text-muted-foreground">FairHealth Plus</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="pending">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="pending">Pending Payments</TabsTrigger>
                    <TabsTrigger value="completed">Payment History</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                    <PaymentList items={pendingPayments} isPending />
                </TabsContent>
                <TabsContent value="completed">
                    <PaymentList items={completedPayments} />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}

function PaymentList({ items, isPending = false }: { items: any[], isPending?: boolean }) {
    return (
        <div className="space-y-4 mt-4">
            {items.length > 0 ? (
                items.map(item => (
                    <Card key={item.id}>
                        <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                           <div className='flex-grow'>
                                <p className="font-bold">Invoice #{item.invoiceNumber}</p>
                                <p className="text-sm text-muted-foreground">{item.service}</p>
                                <p className="text-sm text-muted-foreground">Due: {item.dueDate}</p>
                           </div>
                           <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                                <p className={`text-lg font-bold ${isPending ? 'text-destructive' : 'text-foreground'}`}>
                                    {item.amount.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}
                                </p>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    {isPending && <Button className="w-full sm:w-auto"><CreditCard/> Pay Now</Button>}
                                    <Button variant="outline" className="w-full sm:w-auto"><Download/> Invoice</Button>
                                </div>
                           </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <p className="text-center text-muted-foreground py-8">
                    {isPending ? "No pending payments." : "No payment history."}
                </p>
            )}
        </div>
    );
}
