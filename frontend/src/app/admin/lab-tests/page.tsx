"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearAdminSession, getAdminToken, getAdminUser } from "@/lib/adminSession";

const emptyForm = { name: "", code: "", description: "", price: "", isActive: true };

export default function LabTestsManagement() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    "x-auth-token": getAdminToken() || "",
    "ngrok-skip-browser-warning": "true"
  });

  const fetchTests = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-tests?all=true`, { headers: authHeaders() });
      if (res.ok) setTests(await res.json());
    } catch (err) {
      console.error("Failed to fetch lab tests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getAdminUser();
    if (!user) {
      clearAdminSession();
      window.location.href = "/admin/login";
      return;
    }
    if (user.role !== "system_admin") {
      window.location.href = "/admin/dashboard";
      return;
    }
    fetchTests();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (test: any) => {
    setEditingId(test._id);
    setFormData({
      name: test.name || "",
      code: test.code || "",
      description: test.description || "",
      price: String(test.price ?? ""),
      isActive: test.isActive !== false
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || formData.price === "" || Number(formData.price) < 0) {
      alert("Test name and a valid price are required");
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `${process.env.NEXT_PUBLIC_API_URL}/lab-tests/${editingId}`
        : `${process.env.NEXT_PUBLIC_API_URL}/lab-tests`;
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: authHeaders(),
        body: JSON.stringify({ ...formData, price: Number(formData.price) })
      });
      const data = await res.json();
      if (res.ok) {
        setIsModalOpen(false);
        fetchTests();
      } else {
        alert(`Error: ${data.msg}`);
      }
    } catch (err) {
      console.error("Save lab test failed", err);
      alert("Server Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (test: any) => {
    if (!confirm(`Remove "${test.name}"? Existing lab requests keep their price.`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-tests/${test._id}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      if (res.ok) {
        setTests(prev => prev.filter(t => t._id !== test._id));
      } else {
        const data = await res.json();
        alert(`Error: ${data.msg}`);
      }
    } catch (err) {
      console.error("Delete lab test failed", err);
      alert("Server Error");
    }
  };

  const filtered = tests.filter(t => {
    const lower = search.toLowerCase();
    return t.name?.toLowerCase().includes(lower) || t.code?.toLowerCase().includes(lower);
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 md:ml-64 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Lab Tests & Prices</h1>
              <p className="text-slate-500 text-sm">Doctors and nurses pick from these tests; the price is added to the patient's bill automatically.</p>
            </div>
            <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="mr-2 h-4 w-4" /> Add Lab Test
            </Button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9 bg-white" placeholder="Search by name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
              <FlaskConical className="h-10 w-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">{tests.length === 0 ? "No lab tests yet. Add the first one." : "No lab tests match your search."}</p>
            </div>
          ) : (
            <Card className="bg-white border-slate-200 overflow-hidden">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left p-3">Test</th>
                      <th className="text-left p-3">Code</th>
                      <th className="text-right p-3">Price (LKR)</th>
                      <th className="text-left p-3">Status</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map(test => (
                      <tr key={test._id}>
                        <td className="p-3">
                          <p className="font-semibold text-slate-800">{test.name}</p>
                          {test.description && <p className="text-xs text-slate-500">{test.description}</p>}
                        </td>
                        <td className="p-3 text-slate-500">{test.code || "—"}</td>
                        <td className="p-3 text-right font-bold text-slate-800">{Number(test.price).toLocaleString()}</td>
                        <td className="p-3">
                          <Badge variant="outline" className={test.isActive !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500"}>
                            {test.isActive !== false ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(test)} aria-label="Edit">
                              <Pencil className="h-4 w-4 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(test)} aria-label="Delete">
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Lab Test" : "Add Lab Test"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Name *</label>
              <Input placeholder="e.g., Full Blood Count (FBC)" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input placeholder="e.g., FBC" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (LKR) *</label>
                <Input type="number" min="0" placeholder="e.g., 1500" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea placeholder="Optional notes, e.g. fasting required" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
              Available for new requests
            </label>
            {editingId && <p className="text-xs text-slate-500">Price changes apply to new requests only.</p>}
            <Button className="w-full bg-cyan-600 hover:bg-cyan-700" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {editingId ? "Save Changes" : "Add Test"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
