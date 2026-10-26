"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { getAdminToken } from "@/lib/adminSession";

// Lets staff pick lab tests from the admin-configured catalog; prices come from the catalog
export default function LabTestPicker({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) {
    const [tests, setTests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/lab-tests`, {
                    headers: { "x-auth-token": getAdminToken() || "", "ngrok-skip-browser-warning": "true" }
                });
                if (res.ok) setTests(await res.json());
            } catch (err) {
                console.error("Failed to fetch lab tests", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const toggle = (id: string) => {
        onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    };

    const filtered = tests.filter(t => t.name?.toLowerCase().includes(search.toLowerCase()) || t.code?.toLowerCase().includes(search.toLowerCase()));
    const total = tests.filter(t => selectedIds.includes(t._id)).reduce((sum, t) => sum + Number(t.price || 0), 0);

    if (loading) {
        return <div className="flex justify-center py-6"><Loader2 className="animate-spin h-5 w-5 text-cyan-600" /></div>;
    }

    if (tests.length === 0) {
        return <p className="text-xs text-amber-600 font-semibold py-3">No lab tests are configured yet. Ask the system administrator to add lab tests and prices.</p>;
    }

    return (
        <div className="space-y-2">
            <input
                type="text"
                placeholder="Search tests..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {filtered.map(test => {
                    const checked = selectedIds.includes(test._id);
                    return (
                        <button
                            type="button"
                            key={test._id}
                            onClick={() => toggle(test._id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm ${checked ? "bg-cyan-50" : "hover:bg-slate-50"}`}
                        >
                            <span className="flex items-center gap-2 min-w-0">
                                <span className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${checked ? "bg-cyan-600 border-cyan-600" : "border-slate-300"}`}>
                                    {checked && <Check className="h-3 w-3 text-white" />}
                                </span>
                                <span className="truncate font-medium text-slate-700">{test.name}</span>
                            </span>
                            <span className="text-xs font-bold text-slate-600 shrink-0">LKR {Number(test.price).toLocaleString()}</span>
                        </button>
                    );
                })}
                {filtered.length === 0 && <p className="text-xs text-slate-400 text-center py-3">No tests match your search.</p>}
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-slate-800 px-1">
                <span>{selectedIds.length} test{selectedIds.length === 1 ? "" : "s"} selected</span>
                <span>Total: LKR {total.toLocaleString()}</span>
            </div>
        </div>
    );
}
