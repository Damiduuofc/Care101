"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, FileText, BarChart2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hospitalData } from '@/lib/doctor-data';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

export default function FinancePage() {
  const [selectedHospital, setSelectedHospital] = useState(hospitalData[0].name);

  const hospital = hospitalData.find(h => h.name === selectedHospital);
  const totalChanneling = hospital?.channeling.reduce((acc, curr) => acc + curr.totalIncome, 0) || 0;
  const totalSurgical = hospital?.surgical.reduce((acc, curr) => acc + curr.totalAmount, 0) || 0;
  const totalIncome = totalChanneling + totalSurgical;
  const totalPayable = totalIncome * 0.95;

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
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-3xl font-bold font-headline">Finance</h1>
            <p className="text-muted-foreground">Track your income from different hospitals.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Hospital
        </Button>
      </div>

      <Card className="bg-accent text-accent-foreground border-accent-foreground/20">
        <CardContent className="p-4">
          <p className="text-sm text-accent-foreground">
            Please note: A <strong>5% service fee</strong> will be deducted from your total income from all sources.
          </p>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Income for {selectedHospital}</CardTitle>
                </CardHeader>
                <CardContent>
                <Tabs defaultValue="channeling" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="channeling">Channeling</TabsTrigger>
                        <TabsTrigger value="surgical">Surgical</TabsTrigger>
                    </TabsList>
                    <TabsContent value="channeling" className="mt-4">
                         <div className="flex justify-end mb-4">
                            <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Add Channeling Session</Button>
                        </div>
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-center">No. of Patients</TableHead>
                            <TableHead className="text-right">Total Income (LKR)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hospital?.channeling.map(session => (
                            <TableRow key={session.id}>
                                <TableCell>{session.date}</TableCell>
                                <TableCell className="text-center">{session.patientCount}</TableCell>
                                <TableCell className="text-right">{session.totalIncome.toLocaleString()}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </TabsContent>
                    <TabsContent value="surgical" className="mt-4">
                        <div className="flex justify-end mb-4">
                            <Button variant="outline"><PlusCircle className="mr-2 h-4 w-4" /> Add Surgical Record</Button>
                        </div>
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Patient BHT</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Total Amount (LKR)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {hospital?.surgical.map(op => (
                            <TableRow key={op.id}>
                                <TableCell>{op.patientBHT}</TableCell>
                                <TableCell>{op.date}</TableCell>
                                <TableCell className="text-right">{op.totalAmount.toLocaleString()}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BarChart2 className="h-5 w-5 text-primary" />
                        Overview
                    </CardTitle>
                    <CardDescription>Summary for {selectedHospital}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Channeling</span>
                        <span className="font-semibold">{totalChanneling.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Surgical</span>
                        <span className="font-semibold">{totalSurgical.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}</span>
                    </div>
                    <hr/>
                    <div className="flex justify-between items-center">
                        <span className="font-bold">Total Gross Income</span>
                        <span className="font-bold text-lg">{totalIncome.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}</span>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-destructive">Service Fee (5%)</span>
                        <span className="text-destructive">- {(totalIncome * 0.05).toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}</span>
                    </div>
                     <hr/>
                     <div className="flex justify-between items-center">
                        <span className="font-bold text-primary">Total Payable</span>
                        <span className="font-bold text-xl text-primary">{totalPayable.toLocaleString('en-US', { style: 'currency', currency: 'LKR' })}</span>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Hospitals
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {hospitalData.map(h => (
                             <Button 
                                key={h.id} 
                                variant={selectedHospital === h.name ? "default" : "ghost"}
                                className="w-full justify-start"
                                onClick={() => setSelectedHospital(h.name)}
                              >
                                {h.name}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </motion.div>
  );
}
