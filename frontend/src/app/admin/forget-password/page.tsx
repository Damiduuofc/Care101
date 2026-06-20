"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import Sidebar from "@/components/admin/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminToken } from "@/lib/adminSession";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // 1. Basic Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const token = getAdminToken();
      // NOTE: Make sure to create this endpoint in your backend!
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token || "",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (res.ok) {
          setSuccess(true);
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } else {
          setError(data.msg || "Failed to change password.");
        }
      } else {
        setError(`Server Error: ${res.status}. Endpoint might be missing.`);
      }
    } catch (err) {
      console.error(err);
      setError("A network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      
      <main className="flex-1 md:ml-64 p-4 lg:p-8 flex items-center justify-center">
        <Card className="w-full max-w-md border-slate-200 shadow-sm">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto bg-cyan-50 w-12 h-12 rounded-full flex items-center justify-center mb-2">
              <ShieldCheck className="h-6 w-6 text-cyan-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">Change Password</CardTitle>
            <CardDescription className="text-slate-500">
              Update your account password to stay secure.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {success ? (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm text-center border border-emerald-200">
                <p className="font-bold mb-1">Success!</p>
                <p>Your password has been updated securely.</p>
                <Button 
                  className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setSuccess(false)}
                >
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 border border-red-200">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-9"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-9"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="pl-9"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}