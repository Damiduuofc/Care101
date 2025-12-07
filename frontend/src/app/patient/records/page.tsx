"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { FileText, Stethoscope, Beaker, Upload, Download, FilePlus, Loader2, Trash2 } from 'lucide-react'; // Added Trash2
import { motion } from 'framer-motion';

const API_URL = "http://localhost:5000/api/medical-records";

export default function MedicalRecordsPage() {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Fetch Records
    useEffect(() => {
        const fetchRecords = async () => {
            const token = sessionStorage.getItem("token");
            if (!token) return;

            try {
                const res = await fetch(`${API_URL}/my-records`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    setRecords(await res.json());
                }
            } catch (error) {
                console.error("Failed to fetch records");
            } finally {
                setLoading(false);
            }
        };
        fetchRecords();
    }, [refreshTrigger]);

    // ✅ DELETE FUNCTION
    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this document? This cannot be undone.")) return;

        const token = sessionStorage.getItem("token");
        try {
            const res = await fetch(`${API_URL}/delete/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                alert("File Deleted.");
                setRefreshTrigger(prev => prev + 1); // Refresh list
            } else {
                alert("Failed to delete.");
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
        <motion.div
            className="space-y-8 max-w-7xl mx-auto p-6"
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline text-slate-900">Medical Records</h1>
                    <p className="text-slate-500">Your comprehensive health history.</p>
                </div>
                
                {/* UPLOAD BUTTON */}
                <UploadDialog onSuccess={() => setRefreshTrigger(prev => prev + 1)} />
            </div>

            <Tabs defaultValue="consultations" className="w-full">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="consultations"><Stethoscope className="mr-2 h-4 w-4" />Consultations</TabsTrigger>
                    <TabsTrigger value="prescriptions"><FileText className="mr-2 h-4 w-4" />Prescriptions</TabsTrigger>
                    <TabsTrigger value="lab_tests"><Beaker className="mr-2 h-4 w-4" />Lab Tests</TabsTrigger>
                    <TabsTrigger value="reports"><FilePlus className="mr-2 h-4 w-4" />Other Reports</TabsTrigger>
                </TabsList>
                
                <TabsContent value="consultations">
                    <RecordList records={records} type="consultations" onDelete={handleDelete} />
                </TabsContent>
                <TabsContent value="prescriptions">
                    <RecordList records={records} type="prescriptions" onDelete={handleDelete} />
                </TabsContent>
                 <TabsContent value="lab_tests">
                    <RecordList records={records} type="lab_tests" onDelete={handleDelete} />
                </TabsContent>
                 <TabsContent value="reports">
                    <RecordList records={records} type="reports" onDelete={handleDelete} />
                </TabsContent>
            </Tabs>
        </motion.div>
    );
}

// --- SUB-COMPONENT: RECORD LIST (Updated with Delete) ---
function RecordList({ records, type, onDelete }: { records: any[], type: string, onDelete: (id: string) => void }) {
    const filtered = records.filter(r => r.type === type);
    const [downloading, setDownloading] = useState<string | null>(null);

    const handleDownload = async (id: string) => {
        setDownloading(id);
        const token = sessionStorage.getItem("token");
        
        try {
            const res = await fetch(`${API_URL}/download/${id}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (res.ok && data.fileData) {
                const win = window.open();
                if(win) {
                    win.document.write(
                        `<iframe src="${data.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
                    );
                } else {
                    alert("Pop-up blocked.");
                }
            } else {
                alert("File not found.");
            }
        } catch (error) {
            alert("Download Failed");
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.length > 0 ? (
                filtered.map((record) => (
                    <motion.div
                        key={record._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <Card className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg font-bold text-slate-800">{record.title}</CardTitle>
                                        <CardDescription className="text-sm mt-1">
                                            {new Date(record.date).toLocaleDateString()}
                                        </CardDescription>
                                    </div>
                                    <div className="bg-cyan-50 text-cyan-700 text-xs px-2 py-1 rounded font-medium">
                                        {record.doctorName}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {record.description && <p className="text-sm text-slate-600 mb-2">{record.description}</p>}
                                
                                <div className="mt-4 flex gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="flex-grow border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                        onClick={() => handleDownload(record._id)}
                                        disabled={downloading === record._id}
                                    >
                                        {downloading === record._id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />} 
                                        View
                                    </Button>

                                    {/* DELETE BUTTON */}
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => onDelete(record._id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))
            ) : (
                <div className="col-span-full text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    No records found in this category.
                </div>
            )}
        </div>
    );
}

// --- SUB-COMPONENT: UPLOAD DIALOG (Same as before) ---
function UploadDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        type: "consultations",
        doctorName: "",
        date: "",
        description: "",
        fileData: "",
        fileType: ""
    });

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert("File is too large (Max 5MB recommended)");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ 
                    ...prev, 
                    fileData: reader.result as string,
                    fileType: file.type
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.date || !formData.fileData) {
            alert("Please fill all required fields and upload a file.");
            return;
        }

        setLoading(true);
        const token = sessionStorage.getItem("token");

        try {
            const res = await fetch(`${API_URL}/upload`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                alert("Document Uploaded!");
                setOpen(false);
                onSuccess();
                setFormData({ title: "", type: "consultations", doctorName: "", date: "", description: "", fileData: "", fileType: "" });
            } else {
                alert("Failed to upload.");
            }
        } catch (error) {
            alert("Server Error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                    <Upload className="mr-2 h-4 w-4" /> Upload Document
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Upload Medical Record</DialogTitle>
                    <DialogDescription>Add a prescription, lab report, or consultation note.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Record Type</Label>
                            <Select onValueChange={(val) => setFormData({...formData, type: val})} defaultValue="consultations">
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="consultations">Consultation</SelectItem>
                                    <SelectItem value="prescriptions">Prescription</SelectItem>
                                    <SelectItem value="lab_tests">Lab Test</SelectItem>
                                    <SelectItem value="reports">Other Report</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" onChange={(e) => setFormData({...formData, date: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Title / Name</Label>
                        <Input placeholder="e.g. Blood Test Result" onChange={(e) => setFormData({...formData, title: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Doctor Name (Optional)</Label>
                        <Input placeholder="e.g. Dr. Smith" onChange={(e) => setFormData({...formData, doctorName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Description / Notes</Label>
                        <Input placeholder="Any extra details..." onChange={(e) => setFormData({...formData, description: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <Label>Attachment (PDF or Image)</Label>
                        <Input type="file" accept="application/pdf, image/*" onChange={handleFile} />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700 w-full">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                        {loading ? "Uploading..." : "Save Record"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}