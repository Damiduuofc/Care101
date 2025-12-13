"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Login failed");

      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("adminUser", JSON.stringify(data.admin));

      router.push("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Access denied.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">

      {/* Subtle Ambient Glow */}
      <div className="absolute -top-32 left-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
      <div className="absolute -bottom-32 right-1/3 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />

      {/* Back Button */}
      <div className="absolute top-8 left-8 z-10">
        <button
          onClick={() => router.push("/")}
          className="text-slate-500 hover:text-cyan-400 text-sm flex items-center gap-2 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Hospital Home
        </button>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[400px] relative z-10">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl">

          {/* Accent Line */}
          <div className="h-[2px] w-full bg-cyan-500/40" />

          {/* Header */}
          <div className="text-center pt-10 pb-6 px-8">
            <div className="mx-auto w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center mb-5 border border-slate-800">
              <img
                src="/logo.png"
                alt="Care101"
                className="h-12 w-12 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement
                    ?.querySelector(".fallback-icon")
                    ?.classList.remove("hidden");
                }}
              />
              <ShieldCheck className="fallback-icon h-9 w-9 text-cyan-500 hidden" />
            </div>

            <h1 className="text-2xl font-bold text-white">
              Care101 <span className="text-cyan-500">Admin</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Secure Staff Access Portal
            </p>
          </div>

          {/* Form */}
          <div className="px-8 pb-10">
            <form onSubmit={handleLogin} className="space-y-5">

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center animate-shake">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Email
                </label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    className="w-full h-11 pl-10 pr-4 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-cyan-500/40 outline-none"
                    placeholder="admin@care101.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">
                  Password
                </label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="password"
                    className="w-full h-11 pl-10 pr-4 bg-slate-950 border border-slate-800 text-white rounded-xl focus:ring-2 focus:ring-cyan-500/40 outline-none"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    Verifying...
                  </>
                ) : (
                  "Access Dashboard"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-slate-600 uppercase tracking-widest flex items-center justify-center gap-2">
          <ShieldCheck className="h-3 w-3" />
          Secure Admin Access
        </p>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.35s ease-in-out;
        }
      `}</style>
    </div>
  );
}
