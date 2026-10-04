"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, FileText, Upload, Trash2, Eye, Download, User2, Activity, Plus } from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

export default function LabAssistantDashboard() {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

  const [patientRecords, setPatientRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Requests State
  const [requests, setRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"directory" | "requests">("requests");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  // Price Setup State
  const [priceInput, setPriceInput] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);

  // Upload Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "lab_tests",
    description: "",
    fileData: "",
    fileType: ""
  });

  // Create Request Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    title: "",
    type: "lab_tests",
    description: "",
    amount: ""
  });

  const fetchPatients = async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/patients/all-patients`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
        setFilteredPatients(data);
      }
    } catch (err) {
      console.error("Failed to fetch patients", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-requests/all`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
        
        // UX Bugfix: Sync active selectedRequest with fresh database status
        setSelectedRequest((current: any) => {
          if (!current) return null;
          const updated = data.find((r: any) => r._id === current._id);
          return updated || current;
        });
      }
    } catch (err) {
      console.error("Failed to fetch requests", err);
    }
  };

  useEffect(() => {
    const user = getAdminUser();
    if (!user || user.role !== "lab_assistant") {
      clearAdminSession();
      window.location.href = "/admin/login";
      return;
    }
    fetchPatients();
    fetchRequests();
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();
    setFilteredPatients(patients.filter(p => 
      (p.fullName && p.fullName.toLowerCase().includes(lower)) || 
      (p.patientId && p.patientId.toLowerCase().includes(lower)) ||
      (p.nicNumber && p.nicNumber.toLowerCase().includes(lower))
    ));
  }, [search, patients]);

  const fetchPatientRecords = async (patientId: string) => {
    setLoadingRecords(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/medical-records/patient/${patientId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPatientRecords(data);
      }
    } catch (err) {
      console.error("Failed to fetch records", err);
    } finally {
      setLoadingRecords(false);
    }
  };

  const formatDoctorName = (name?: string, doctorIdObj?: any) => {
    if (doctorIdObj && typeof doctorIdObj === 'object') {
      const docName = doctorIdObj.name || doctorIdObj.fullName || doctorIdObj.nameWithInitials;
      if (docName) {
        return docName.startsWith("Dr.") ? docName : `Dr. ${docName}`;
      }
    }
    if (!name || name.trim() === "Doctor") {
      return "Dr. Medical Officer";
    }
    if (name.startsWith("Dr.") || name.startsWith("Nurse") || name.startsWith("Lab") || name === "Self Uploaded") {
      return name;
    }
    return `Dr. ${name}`;
  };

  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient);
    setSelectedRequest(null);
    fetchPatientRecords(patient._id);
    setFormData({
      title: "",
      type: "lab_tests",
      description: "",
      fileData: "",
      fileType: ""
    });
    setPriceInput("");
  };

  const handleRequestSelect = (req: any) => {
    const reqPatient = (typeof req.patientId === 'object' && req.patientId !== null) ? req.patientId : {};
    const patientMongoId = reqPatient._id || req.patientId;
    const directoryPatient = patients.find(p => p._id === patientMongoId);

    const resolvedPatient = {
      ...reqPatient,
      ...(directoryPatient || {}),
      patientId: directoryPatient?.patientId || reqPatient.patientId || (typeof patientMongoId === 'string' && patientMongoId.startsWith('PID-') ? patientMongoId : "N/A"),
      nicNumber: directoryPatient?.nicNumber || reqPatient.nicNumber || "",
      mobileNumber: directoryPatient?.mobileNumber || reqPatient.mobileNumber || ""
    };

    setSelectedPatient(resolvedPatient);
    setSelectedRequest(req);
    if (patientMongoId) {
      fetchPatientRecords(patientMongoId);
    }
    setFormData({
      title: req.title || "",
      type: req.type || "lab_tests",
      description: req.description || "",
      fileData: "",
      fileType: ""
    });
    setPriceInput(req.billId?.amount != null && req.billId?.amount > 0 ? req.billId.amount.toString() : "");
  };

  const handleCreateRequest = async () => {
    if (!createFormData.title || !createFormData.amount) {
      alert("Title and Price are required!");
      return;
    }
    setCreateLoading(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-requests/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId: selectedPatient?._id,
          title: createFormData.title,
          description: createFormData.description,
          type: createFormData.type,
          amount: Number(createFormData.amount),
          doctorName: "Lab Assistant"
        })
      });

      if (res.ok) {
        const newReq = await res.json();
        alert("Report request created successfully!");
        setIsCreateModalOpen(false);
        setCreateFormData({ title: "", type: "lab_tests", description: "", amount: "" });
        
        // Fetch requests and select the new one
        const fetchRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-requests/all`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "x-auth-token": token || "",
            "ngrok-skip-browser-warning": "true"
          }
        });
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          setRequests(data);
          const matched = data.find((r: any) => r._id === newReq._id);
          if (matched) {
            setSelectedRequest(matched);
            setFormData({
              title: matched.title,
              type: matched.type || "lab_tests",
              description: matched.description || "",
              fileData: "",
              fileType: ""
            });
          }
        }
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.msg}`);
      }
    } catch (err) {
      console.error("Failed to create request", err);
      alert("Failed to create report request");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert("File size exceeds 5MB. Please upload a smaller file.");
        e.target.value = "";
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

  const handleUpload = async () => {
    if (!formData.title || !formData.fileData) {
      alert("Title and File are required!");
      return;
    }

    setUploadLoading(true);
    try {
      const token = getAdminToken();
      const adminUser = getAdminUser() || {};

      let endpoint = `/medical-records/upload`;
      let payload: any = {
        ...formData,
        patientId: selectedPatient?._id,
        date: new Date().toISOString(),
        doctorName: adminUser.name || "Lab Assistant"
      };

      if (selectedRequest) {
        endpoint = `/lab-requests/upload/${selectedRequest._id}`;
        payload = {
          fileData: formData.fileData,
          fileType: formData.fileType,
          description: formData.description
        };
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert("Document uploaded successfully!");
        setIsModalOpen(false);
        setFormData({ title: "", type: "lab_tests", description: "", fileData: "", fileType: "" });
        
        if (selectedRequest) {
          fetchRequests();
          setSelectedRequest(null);
        }
        fetchPatientRecords(selectedPatient._id); // Refresh
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.msg}`);
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload document");
    } finally {
      setUploadLoading(false);
    }
  };

  const downloadRecord = async (id: string, fileName: string) => {
    try {
      const token = getAdminToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/medical-records/download/${id}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const a = document.createElement("a");
        a.href = data.fileData;
        a.download = data.fileName || fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert("Failed to download file");
      }
    } catch (err) {
      console.error("Download Error:", err);
      alert("Error downloading file");
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Upload Medical Records</h1>
              <p className="text-slate-500">Search for a patient and upload lab reports, scan results, or prescriptions.</p>
            </div>
          </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* LEFT: PATIENT SEARCH */}
          <div className="md:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                className="pl-9 bg-white" 
                placeholder="Search by Name or Patient ID..." 
                value={search || ""} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>

            <div className="flex gap-2 mb-4">
              <Button 
                variant={activeTab === "requests" ? "default" : "outline"} 
                className={`flex-1 ${activeTab === "requests" ? "bg-cyan-600 hover:bg-cyan-700" : ""}`}
                onClick={() => setActiveTab("requests")}
              >
                Requests ({requests.filter(r => r.status === 'pending').length})
              </Button>
              <Button 
                variant={activeTab === "directory" ? "default" : "outline"} 
                className={`flex-1 ${activeTab === "directory" ? "bg-cyan-600 hover:bg-cyan-700" : ""}`}
                onClick={() => setActiveTab("directory")}
              >
                Directory
              </Button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[500px] flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700 text-sm">
                {activeTab === "directory" ? "Patient Directory" : "Pending Doctor Requests"}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {activeTab === "directory" ? (
                  filteredPatients.length === 0 ? (
                    <p className="text-center text-slate-400 mt-4 text-sm">No patients found</p>
                  ) : (
                    filteredPatients.map((p) => (
                      <div 
                        key={p._id} 
                        onClick={() => handlePatientSelect(p)}
                        className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedPatient?._id === p._id && !selectedRequest ? "bg-cyan-50 border-cyan-200" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"}`}
                      >
                        <div className="font-semibold text-slate-800 text-sm flex items-center justify-between">
                          {p.fullName}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{p.patientId || "N/A"}</Badge>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  (() => {
                    const pending = requests.filter(r => r.status === 'pending');
                    const filtered = pending.filter(req => {
                      if (!search.trim()) return true;
                      const lower = search.toLowerCase();
                      const pName = req.patientId?.fullName?.toLowerCase() || "";
                      const pId = req.patientId?.patientId?.toLowerCase() || "";
                      const title = req.title?.toLowerCase() || "";
                      const doc = (req.doctorName || "").toLowerCase();
                      return pName.includes(lower) || pId.includes(lower) || title.includes(lower) || doc.includes(lower);
                    });

                    if (filtered.length === 0) {
                      return <p className="text-center text-slate-400 mt-4 text-sm">No pending requests</p>;
                    }

                    return filtered.map((req) => {
                      const patientMongoId = req.patientId?._id || req.patientId;
                      const dirPatient = patients.find(p => p._id === patientMongoId);
                      const displayPatientId = req.patientId?.patientId || dirPatient?.patientId || "";
                      const displayDoctor = formatDoctorName(req.doctorName, req.doctorId);
                      return (
                        <div 
                          key={req._id} 
                          onClick={() => handleRequestSelect(req)}
                          className={`p-3 rounded-lg cursor-pointer transition-all border ${selectedRequest?._id === req._id ? "bg-orange-50 border-orange-200" : "bg-white border-slate-100 hover:bg-slate-50"}`}
                        >
                          <div className="font-semibold text-slate-800 text-sm flex items-center justify-between">
                            <span className="truncate mr-2">{req.patientId?.fullName || "Unknown Patient"}</span>
                            {displayPatientId && (
                              <Badge variant="outline" className="text-[10px] font-mono font-normal flex-shrink-0">
                                {displayPatientId}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs font-medium text-orange-600 mt-1 truncate">
                            Req: {req.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            By: {displayDoctor}
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: PATIENT DETAILS & RECORDS */}
          <div className="md:col-span-2">
            {!selectedPatient ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-slate-200 border-dashed p-10">
                <User2 className="h-16 w-16 mb-4 text-slate-200" />
                <p>Select a patient from the directory to view or upload records.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Patient Header */}
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-6 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800">{selectedPatient.fullName}</h2>
                      <div className="flex gap-3 text-sm text-slate-500 mt-2 flex-wrap">
                        <span>Patient ID: {selectedPatient.patientId || "N/A"}</span>
                        {selectedPatient.nicNumber && (
                          <>
                            <span>•</span>
                            <span>NIC: {selectedPatient.nicNumber}</span>
                          </>
                        )}
                        <span>•</span>
                        <span>Phone: {selectedPatient.mobileNumber || "N/A"}</span>
                      </div>
                      {selectedRequest && (
                        <div className="mt-3 p-3 bg-cyan-50 border border-cyan-200 rounded-lg max-w-md space-y-2">
                          <p className="text-sm font-semibold text-cyan-800 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-cyan-600" /> Pending Request: {selectedRequest.title}
                          </p>
                          <p className="text-xs text-cyan-600">
                            Requested by: {formatDoctorName(selectedRequest.doctorName, selectedRequest.doctorId)}
                          </p>
                          {selectedRequest.description && (
                            <p className="text-xs text-cyan-700 italic">"{selectedRequest.description}"</p>
                          )}
                          
                          {/* Price & Billing Section */}
                          <div className="mt-2 pt-2 border-t border-cyan-200 space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-cyan-800">Payment Status:</span>
                              <span className={`font-bold px-2 py-0.5 rounded ${selectedRequest.billId?.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {selectedRequest.billId?.status || 'Pending'}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-cyan-800">Current Price:</span>
                              <span className="font-bold text-slate-800">
                                {selectedRequest.billId?.amount > 0 ? `LKR ${selectedRequest.billId.amount}` : 'Not Set (LKR 0)'}
                              </span>
                            </div>

                            {selectedRequest.billId?.status !== "Paid" && !(selectedRequest.billId?.amount > 0) && (
                              <div className="flex items-center gap-2 mt-2">
                                <Input 
                                  type="number" 
                                  placeholder="Enter Price (LKR)" 
                                  className="h-8 text-xs bg-white w-32"
                                  value={priceInput || ""}
                                  onChange={(e) => setPriceInput(e.target.value)}
                                />
                                <Button 
                                  size="sm" 
                                  className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700 text-white"
                                  onClick={async () => {
                                    if (!priceInput || isNaN(Number(priceInput)) || Number(priceInput) <= 0) {
                                      alert("Please enter a valid price!");
                                      return;
                                    }
                                    setPriceLoading(true);
                                    try {
                                      const token = getAdminToken();
                                      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-requests/update-price/${selectedRequest._id}`, {
                                        method: "PUT",
                                        headers: {
                                          "Content-Type": "application/json",
                                          "Authorization": `Bearer ${token}`
                                        },
                                        body: JSON.stringify({ amount: Number(priceInput) })
                                      });
                                      if (res.ok) {
                                        alert("Price updated successfully!");
                                        fetchRequests(); // Refresh requests list
                                        setSelectedRequest((prev: any) => {
                                          if (!prev) return null;
                                          return {
                                            ...prev,
                                            billId: {
                                              ...prev.billId,
                                              amount: Number(priceInput)
                                            }
                                          };
                                        });
                                      } else {
                                        const errData = await res.json();
                                        alert(`Error: ${errData.msg}`);
                                      }
                                    } catch (err) {
                                      console.error("Failed to update price", err);
                                      alert("Failed to update price");
                                    } finally {
                                      setPriceLoading(false);
                                    }
                                  }}
                                  disabled={priceLoading}
                                >
                                  {priceLoading ? "Saving..." : "Set Price"}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedRequest ? (
                      selectedRequest.billId?.status !== "Paid" ? (
                        <div className="flex flex-col items-end gap-1">
                          <Button className="bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed hover:bg-slate-200" disabled>
                            <Upload className="mr-2 h-4 w-4" /> Upload Blocked
                          </Button>
                          <span className="text-[10px] font-semibold text-red-500">
                            {selectedRequest.billId?.amount > 0 ? "⚠️ Awaiting Patient Payment" : "⚠️ Price Not Set"}
                          </span>
                        </div>
                      ) : (
                        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                          <DialogTrigger asChild>
                            <Button className="bg-cyan-600 hover:bg-cyan-700">
                              <Upload className="mr-2 h-4 w-4" /> Upload Document
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Upload Record for {selectedPatient.fullName}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Document Title</label>
                              <Input placeholder="e.g., Blood Test Results" value={formData.title || ""} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Document Type</label>
                              <Select value={formData.type} onValueChange={(val) => setFormData({...formData, type: val})} disabled={!!selectedRequest}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="lab_tests">Lab Test / Report</SelectItem>
                                  <SelectItem value="prescriptions">Prescription</SelectItem>
                                  <SelectItem value="reports">Scan Result</SelectItem>
                                  <SelectItem value="consultations">Consultation Note</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Description (Optional)</label>
                              <Textarea placeholder="Add some notes about this document..." value={formData.description || ""} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Select File</label>
                              <Input type="file" onChange={handleFileChange} />
                              <p className="text-[10px] text-slate-500">Max size 5MB (PDF or Image)</p>
                            </div>
                            
                            <Button className="w-full bg-cyan-600" onClick={handleUpload} disabled={uploadLoading}>
                              {uploadLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Document
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      )
                    ) : (
                      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-cyan-600 hover:bg-cyan-700">
                            <Plus className="mr-2 h-4 w-4" /> Add Report Request
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Report Request for {selectedPatient.fullName}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Report Name</label>
                              <Input 
                                placeholder="e.g., Blood Sugar Test" 
                                value={createFormData.title || ""} 
                                onChange={(e) => setCreateFormData({...createFormData, title: e.target.value})} 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Report Type</label>
                              <Select 
                                value={createFormData.type} 
                                onValueChange={(val) => setCreateFormData({...createFormData, type: val})}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="lab_tests">Lab Test / Report</SelectItem>
                                  <SelectItem value="prescriptions">Prescription</SelectItem>
                                  <SelectItem value="reports">Scan Result</SelectItem>
                                  <SelectItem value="consultations">Consultation Note</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Description (Optional)</label>
                              <Textarea 
                                placeholder="Add some details or instructions..." 
                                value={createFormData.description || ""} 
                                onChange={(e) => setCreateFormData({...createFormData, description: e.target.value})} 
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Set Price (LKR)</label>
                              <Input 
                                type="number" 
                                placeholder="e.g., 1500" 
                                value={createFormData.amount || ""} 
                                onChange={(e) => setCreateFormData({...createFormData, amount: e.target.value})} 
                              />
                            </div>
                            
                            <Button className="w-full bg-cyan-600" onClick={handleCreateRequest} disabled={createLoading}>
                              {createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Request
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>

                {/* Patient Records List */}
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Previous Records
                </h3>

                {loadingRecords ? (
                  <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>
                ) : patientRecords.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                    No medical records uploaded for this patient yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {patientRecords.map((rec) => (
                      <Card key={rec._id} className="bg-white hover:shadow-md transition-shadow">
                        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 capitalize">
                            {rec.type.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-slate-400">{new Date(rec.date).toLocaleDateString()}</span>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <h4 className="font-bold text-slate-800 truncate mb-1">{rec.title}</h4>
                          <p className="text-xs text-slate-500 mb-4 line-clamp-2">{rec.description || "No description provided."}</p>
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>By: {formatDoctorName(rec.doctorName)}</span>
                            <Button variant="ghost" size="sm" className="h-8 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50" onClick={() => downloadRecord(rec._id, rec.title)}>
                              <Download className="h-4 w-4 mr-1" /> View Form
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
