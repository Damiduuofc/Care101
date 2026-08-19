"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  FileText, 
  Video as VideoIcon, 
  Mic, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  Calendar
} from "lucide-react";

interface MediaFiles {
  video: string | null;
  audio: string | null;
  document: string | null;
}

interface DoctorInfo {
  name: string;
  slmcReg?: string;
  specialization?: string;
}

interface InstructionData {
  _id: string;
  surgeryName: string;
  description: string;
  doctor?: DoctorInfo;
  preOp: MediaFiles;
  postOp: MediaFiles;
  createdAt: string;
}

export default function PatientInstructionPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<InstructionData | null>(null);
  const [shareSection, setShareSection] = useState<"preOp" | "postOp" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedApiBase, setResolvedApiBase] = useState<string>("");

  const getAbsoluteMediaUrl = (url: string | null) => {
    if (!url) return "";
    if (!resolvedApiBase) return url;
    
    try {
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return url;
      }
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const apiRoot = resolvedApiBase.replace(/\/api\/?$/, '');
      return `${apiRoot}${pathname}`;
    } catch (e) {
      return url;
    }
  };

  useEffect(() => {
    if (!token) return;

    const fetchSharedInstruction = async () => {
      try {
        let apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5002/api";
        
        // Only replace localhost with the page's hostname if it is a local network IP
        if (typeof window !== "undefined") {
          const hostname = window.location.hostname;
          const isLocalIP = 
            hostname.startsWith("192.168.") ||
            hostname.startsWith("10.") ||
            hostname.startsWith("172.") ||
            hostname === "localhost" ||
            hostname === "127.0.0.1";

          if (isLocalIP && (apiBase.includes("localhost") || apiBase.includes("127.0.0.1"))) {
            apiBase = apiBase.replace("localhost", hostname).replace("127.0.0.1", hostname);
          }
        }

        const res = await fetch(`${apiBase}/instructions/share/${token}`);
        if (!res.ok) {
          if (res.status === 410 || res.status === 404) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.msg || "This link is expired or invalid.");
          }
          throw new Error("Failed to load instructions. Please try again later.");
        }
        const responseData = await res.json();
        setData(responseData.instruction);
        setShareSection(responseData.section);
        setResolvedApiBase(apiBase);
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchSharedInstruction();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 p-6">
        <div className="w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-medium animate-pulse">Loading care instructions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 p-6 text-center">
        <div className="bg-red-50 p-4 rounded-full text-red-500 mb-4 shadow-sm border border-red-100">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Access Expired or Invalid</h1>
        <p className="text-slate-600 max-w-md mb-6 text-sm leading-relaxed">
          {error}
        </p>
        <div className="text-xs text-slate-400 max-w-xs">
          Please contact your medical care provider or doctor to request a new QR access code.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-slate-50 p-6 text-center">
        <div className="bg-amber-50 p-4 rounded-full text-amber-500 mb-4 shadow-sm border border-amber-100">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Instructions Not Found</h1>
        <p className="text-slate-600 max-w-md text-sm leading-relaxed">
          The requested care instructions could not be found. Please check the link or contact your provider.
        </p>
      </div>
    );
  }

  const renderSection = (title: string, colorClass: string, bgClass: string, files: MediaFiles) => {
    const hasVideo = !!files.video;
    const hasAudio = !!files.audio;
    const hasDocument = !!files.document;
    const hasFiles = hasVideo || hasAudio || hasDocument;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className={`px-5 py-4 ${bgClass} border-b border-slate-100 flex items-center gap-3`}>
          <div className={`w-2.5 h-6 rounded-full ${colorClass}`}></div>
          <h2 className="text-lg font-bold text-slate-900">{title} Instructions</h2>
        </div>
        
        <div className="p-5 space-y-6">
          {!hasFiles ? (
            <p className="text-slate-400 text-sm italic py-2">No audio, video, or documents uploaded for this section.</p>
          ) : (
            <>
              {/* Video Player */}
              {hasVideo && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                    <VideoIcon className="w-4 h-4 text-blue-500" />
                    <span>Video Instruction</span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-inner">
                    <video 
                      src={getAbsoluteMediaUrl(files.video)} 
                      controls 
                      className="w-full h-full object-contain"
                      playsInline
                    />
                  </div>
                </div>
              )}

              {/* Audio Player */}
              {hasAudio && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                    <Mic className="w-4 h-4 text-purple-500" />
                    <span>Audio Instruction</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <audio 
                      src={getAbsoluteMediaUrl(files.audio)} 
                      controls 
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Document Link */}
              {hasDocument && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                    <FileText className="w-4 h-4 text-slate-500" />
                    <span>Reference Document</span>
                  </div>
                  <a 
                    href={getAbsoluteMediaUrl(files.document)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 rounded-xl group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-200 p-2.5 rounded-lg text-slate-600">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">View PDF Instruction</p>
                        <p className="text-xs text-slate-500">Click to open or download</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-12 font-sans">
      {/* Brand Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
<img src="/logo.png" alt="CareLink Logo" className="w-8 h-8" />
          <span className="font-extrabold text-xl tracking-tight text-slate-900">CareLink</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-full border border-cyan-100">
          <Clock className="w-3.5 h-3.5" />
          <span>Patient Portal</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-md mx-auto px-4 pt-6 space-y-6">
        {/* Intro Surgery Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <span className="text-xs font-bold text-cyan-600 uppercase tracking-wider bg-cyan-50 px-2.5 py-1 rounded-md">Surgery Care Plan</span>
          <h1 className="text-2xl font-black text-slate-900 mt-3 mb-2 leading-tight">
            {data.surgeryName}
          </h1>
          
          {data.doctor && (
            <div className="mt-2 text-slate-600 text-sm">
              <p className="font-semibold text-slate-800">{data.doctor.name}</p>
              {data.doctor.specialization && (
                <p className="text-xs text-slate-400">{data.doctor.specialization}</p>
              )}
              {data.doctor.slmcReg && (
                <p className="text-xs text-cyan-700 font-bold mt-1 bg-cyan-50/50 inline-block px-2 py-0.5 rounded border border-cyan-100/50">
                  SLMC No: {data.doctor.slmcReg}
                </p>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-2 text-slate-400 text-xs mt-4 pt-4 border-t border-slate-50">
            <Calendar className="w-4 h-4" />
            <span>Updated: {new Date(data.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>

        {/* Description Section */}
        {data.description && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Overview / Notes</h3>
            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {data.description}
            </p>
          </div>
        )}

        {/* PRE-OP */}
        {(shareSection === null || shareSection === "preOp") && 
          renderSection("Pre-Operative", "bg-blue-500", "bg-blue-50/50", data.preOp)
        }

        {/* POST-OP */}
        {(shareSection === null || shareSection === "postOp") && 
          renderSection("Post-Operative", "bg-emerald-500", "bg-emerald-50/50", data.postOp)
        }

        {/* Footer Support info */}
        <div className="text-center space-y-1 py-4 text-xs text-slate-400">
          <p className="font-semibold text-slate-500">CareLink Health Systems</p>
          <p>Please consult your surgeon directly if you have clinical questions.</p>
        </div>
      </main>
    </div>
  );
}
