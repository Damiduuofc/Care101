
"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Stethoscope, Beaker, Upload, Download, FilePlus } from 'lucide-react';
import { medicalRecords } from '@/lib/patient-data';
import { motion } from 'framer-motion';

export default function MedicalRecordsPage() {
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
                    <h1 className="text-3xl font-bold font-headline">Medical Records</h1>
                    <p className="text-muted-foreground">Your comprehensive health history.</p>
                </div>
                <Button>
                    <Upload className="mr-2 h-4 w-4" /> Upload Document
                </Button>
            </div>

            <Tabs defaultValue="consultations" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="consultations"><Stethoscope className="mr-2" />Consultations</TabsTrigger>
                    <TabsTrigger value="prescriptions"><FileText className="mr-2" />Prescriptions</TabsTrigger>
                    <TabsTrigger value="lab_tests"><Beaker className="mr-2" />Lab Tests</TabsTrigger>
                    <TabsTrigger value="reports"><FilePlus className="mr-2" />Other Reports</TabsTrigger>
                </TabsList>
                <TabsContent value="consultations">
                    <RecordList records={medicalRecords.consultations} type="Consultation" />
                </TabsContent>
                <TabsContent value="prescriptions">
                    <RecordList records={medicalRecords.prescriptions} type="Prescription" />
                </TabsContent>
                 <TabsContent value="lab_tests">
                    <RecordList records={medicalRecords.labTests} type="Lab Test" />
                </TabsContent>
                 <TabsContent value="reports">
                    <RecordList records={medicalRecords.otherReports} type="Report" />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}

function RecordList({ records, type }: { records: any[], type: string }) {
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: i * 0.1,
            },
        }),
    };

    return (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {records.length > 0 ? (
                records.map((record, i) => (
                    <motion.div
                        key={record.id}
                        custom={i}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">{record.title || `${type} Record`}</CardTitle>
                                <CardDescription>Date: {record.date}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm"><strong>Doctor:</strong> {record.doctor}</p>
                                {record.diagnosis && <p className="text-sm mt-2"><strong>Diagnosis:</strong> {record.diagnosis}</p>}
                                {record.prescriptions && <p className="text-sm mt-2"><strong>Medication:</strong> {record.prescriptions}</p>}
                                <div className="mt-4 flex gap-2">
                                    <Button variant="outline" size="sm">
                                        <Download className="mr-2 h-4 w-4" /> View/Download
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))
            ) : (
                <p className="text-center text-muted-foreground py-8 col-span-full">No {type.toLowerCase()} records found.</p>
            )}
        </div>
    );
}
