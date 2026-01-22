"use client";

import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { departments } from "@/lib/data"; // Imports from step 1
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, CheckCircle2, User, Calendar, Phone, Heart, Brain, Baby, Bone, Eye, 
  Stethoscope, Loader2, Syringe, Pill, Smile, Users, Microscope, Scissors, 
  Activity, ArrowLeft, Apple
} from "lucide-react";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// --- Configuration ---
const BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "";
const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/doctors/public`;

type DepartmentPageProps = {
  params: Promise<{ slug: string }>;
};

// --- 1. Visual Assets Helper (Updated to cover all 19 departments) ---
const getDeptAssets = (slug: string) => {
  const s = slug.toLowerCase();
  
  if (s.includes("pediatrics")) return { icon: Baby, color: "text-pink-600", bg: "bg-pink-50", img: "/images/dept-pediatrics.jpg" };
  if (s.includes("surgery") && !s.includes("plastic")) return { icon: Scissors, color: "text-emerald-600", bg: "bg-emerald-50", img: "/images/dept-surgery.jpg" };
  if (s.includes("plastic")) return { icon: Scissors, color: "text-rose-500", bg: "bg-rose-50", img: "/images/dept-plastic.jpg" };
  if (s.includes("dental") || s.includes("omf")) return { icon: Smile, color: "text-cyan-600", bg: "bg-cyan-50", img: "/images/dept-dental.jpg" };
  if (s.includes("obgyn")) return { icon: Users, color: "text-rose-600", bg: "bg-rose-50", img: "/images/dept-obgyn.jpg" };
  if (s.includes("oncology")) return { icon: Microscope, color: "text-amber-600", bg: "bg-amber-50", img: "/images/dept-oncology.jpg" };
  if (s.includes("neuro")) return { icon: Brain, color: "text-purple-600", bg: "bg-purple-50", img: "/images/dept-neurology.jpg" };
  if (s.includes("orthopedics")) return { icon: Bone, color: "text-slate-600", bg: "bg-slate-100", img: "/images/dept-orthopedics.jpg" };
  if (s.includes("cardiology")) return { icon: Heart, color: "text-red-600", bg: "bg-red-50", img: "/images/dept-cardiology.jpg" };
  if (s.includes("ophthalmology") || s.includes("eye")) return { icon: Eye, color: "text-blue-600", bg: "bg-blue-50", img: "/images/dept-eye.jpg" };
  if (s.includes("ent")) return { icon: Activity, color: "text-teal-600", bg: "bg-teal-50", img: "/images/dept-ent.jpg" };
  if (s.includes("mental") || s.includes("psych")) return { icon: Brain, color: "text-teal-600", bg: "bg-teal-50", img: "/images/dept-psych.jpg" };
  if (s.includes("diagnostics") || s.includes("radiology")) return { icon: Syringe, color: "text-orange-600", bg: "bg-orange-50", img: "/images/dept-lab.jpg" };
  if (s.includes("nutrition")) return { icon: Apple, color: "text-green-600", bg: "bg-green-50", img: "/images/dept-nutrition.jpg" };
  if (s.includes("dermatology")) return { icon: User, color: "text-pink-500", bg: "bg-pink-50", img: "/images/dept-derma.jpg" };
  if (s.includes("endo") || s.includes("diabetes")) return { icon: Activity, color: "text-indigo-500", bg: "bg-indigo-50", img: "/images/dept-endo.jpg" };
  if (s.includes("gastro")) return { icon: Pill, color: "text-yellow-600", bg: "bg-yellow-50", img: "/images/dept-gastro.jpg" };
  if (s.includes("urology")) return { icon: Activity, color: "text-blue-500", bg: "bg-blue-50", img: "/images/dept-urology.jpg" };
  
  // Default / Internal Medicine
  return { icon: Stethoscope, color: "text-indigo-600", bg: "bg-indigo-50", img: "/images/dept-internal.jpg" };
};

// --- 2. Smart Keyword Matcher ---
const getMatchingKeywords = (slug: string, deptName: string) => {
  const base = [deptName.toLowerCase(), slug.replace("-", " ")];
  const s = slug.toLowerCase();

  switch (s) {
    case "pediatrics": return [...base, "paediatric", "pediatric", "neonate", "baby", "child"];
    case "surgery": return [...base, "surgeon", "transplant", "vascular", "hepatopancreaticobiliary", "general surgery"];
    case "plastic-surgery": return [...base, "plastic", "reconstructive", "cosmetic", "burn"];
    case "dental": return [...base, "dentist", "dental", "orthodont", "prosthodont", "omf", "maxillofacial", "restorative"];
    case "obgyn": return [...base, "vog", "obstetric", "gynaeco", "maternity", "women"];
    case "oncology": return [...base, "onco", "cancer", "tumor", "hemato"];
    case "neurology": return [...base, "neuro", "brain", "spine"];
    case "orthopedics": return [...base, "ortho", "bone", "rheuma", "sports", "rehabilitation"];
    case "cardiology": return [...base, "cardio", "heart", "chest", "thoracic"];
    case "general-medicine": return [...base, "physician", "general medicine", "elderly", "community", "critical care", "emergency", "internal medicine"];
    case "dermatology": return [...base, "derma", "skin", "venereolog", "std", "sexual health"];
    case "endocrinology": return [...base, "endo", "diabetes", "hormone", "thyroid"];
    case "gastroenterology": return [...base, "gastro", "hepato", "liver", "digestive", "endoscopy"];
    case "urology": return [...base, "urolog", "nephro", "kidney", "renal"];
    case "ent": return [...base, "ent", "ear", "nose", "throat", "head & neck"];
    case "ophthalmology": return [...base, "eye", "vision", "ophthalm"];
    case "mental-health": return [...base, "psych", "counsel"];
    case "diagnostics": return [...base, "radio", "microbio", "haemato", "lab"];
    case "nutrition": return [...base, "nutrition", "diet"];
    default: return base;
  }
};

export default function DepartmentPage({ params }: DepartmentPageProps) {
  const { slug } = use(params);
  const department = departments.find((dept) => dept.slug === slug);
  
  if (!department) notFound();

  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch(API_URL, {
          headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
          cache: 'no-store'
        });
        
        if (res.ok) {
          const allDoctors = await res.json();
          const searchTerms = getMatchingKeywords(department.slug, department.name);
          const relevantDoctors = allDoctors.filter((doc: any) => {
            const spec = doc.specialization?.toLowerCase() || "";
            return searchTerms.some((term) => spec.includes(term));
          });
          setDoctors(relevantDoctors);
        }
      } catch (error) {
        console.error("Failed to load doctors", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [department]);

  const getProfileImage = (path: string) => {
    if (!path) return null;
    if (path.startsWith("data:") || path.startsWith("http")) return path;
    return `${BASE_URL}/uploads/${path}`;
  };

  const assets = getDeptAssets(department.slug);
  const Icon = assets.icon;
  const sectionVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      <Header />
      <div className="relative h-[45vh] min-h-[400px] w-full overflow-hidden bg-slate-900">
        <motion.div initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2 }} className="absolute inset-0">
          <div className={`absolute inset-0 ${assets.bg} opacity-20`} />
          <Image src={assets.img} alt={department.name} fill className="object-cover opacity-50" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-slate-900/80" />
        </motion.div>
        <div className="relative container h-full px-6 flex flex-col justify-center max-w-6xl mx-auto pt-16">
          <Link href="/departments" className="absolute top-8 text-white/80 hover:text-white flex items-center gap-2 text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Departments
          </Link>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
            <Badge className={`${assets.bg} ${assets.color} border-0 px-4 py-1.5 text-sm font-bold uppercase tracking-wider`}>Center of Excellence</Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg leading-tight">{department.name}</h1>
            <p className="text-xl md:text-2xl text-slate-200 font-light max-w-2xl leading-relaxed">{department.description}</p>
          </motion.div>
        </div>
      </div>

      <main className="container px-6 mx-auto max-w-6xl -mt-20 relative z-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                <div className={`p-3 rounded-xl ${assets.bg} ${assets.color} shadow-sm`}><Icon className="w-8 h-8" /></div>
                <h2 className="text-2xl font-bold text-slate-900">Department Overview</h2>
              </div>
              <p className="text-slate-600 leading-8 text-lg">Our {department.name} department provides world-class care using the latest medical technologies. {department.description} We are dedicated to patient safety and clinical excellence.</p>
            </motion.div>

            <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><span className={`w-1.5 h-8 rounded-full ${assets.color.replace("text-", "bg-")}`}></span>Treatments & Services</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {department.services.map((service, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all">
                    <CheckCircle2 className={`w-5 h-5 mt-1 ${assets.color} shrink-0`} /><span className="font-medium text-slate-700">{service}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="pt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><span className={`w-1.5 h-8 rounded-full ${assets.color.replace("text-", "bg-")}`}></span>Meet Our Specialists</h3>
                <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{loading ? "..." : `${doctors.length} Specialist${doctors.length !== 1 ? 's' : ''}`}</span>
              </div>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-100"><Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" /><p className="text-slate-400">Loading specialists...</p></div>
              ) : doctors.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {doctors.map((doc) => {
                    const img = getProfileImage(doc.profileImage);
                    return (
                      <Link href={`/patient/appointments?preSelectedDocId=${doc._id}`} key={doc._id}>
                        <Card className="hover:shadow-xl transition-all duration-300 border-slate-100 cursor-pointer h-full group bg-white overflow-hidden rounded-2xl">
                          <CardContent className="p-6 flex items-center gap-4">
                            <div className="relative h-20 w-20 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner shrink-0 bg-slate-100">{img ? <img src={img} alt={doc.name} className="h-full w-full object-cover" /> : <User className="h-full w-full p-4 text-slate-300" />}</div>
                            <div className="min-w-0"><p className="font-bold text-lg text-slate-900 group-hover:text-cyan-600 transition-colors truncate">{doc.name}</p><p className={`text-sm ${assets.color} font-bold mb-1 truncate`}>{doc.specialization}</p><p className="text-xs text-slate-400 line-clamp-1">{doc.qualifications || "Consultant Specialist"}</p></div>
                          </CardContent>
                          <div className={`h-1 w-full ${assets.bg} group-hover:bg-cyan-500 transition-colors`} />
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 px-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200"><div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><User className="w-8 h-8 text-slate-300" /></div><h4 className="text-slate-900 font-semibold mb-2">No Specialists Found</h4><p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">We couldn't find any doctors listed under {department.name}.</p><Link href="/contact"><Button variant="outline">Contact Hospital</Button></Link></div>
              )}
            </motion.div>
          </div>

          <aside className="lg:col-span-1 space-y-6">
            <div className="sticky top-24 space-y-6">
              <Card className="border-t-4 border-cyan-500 shadow-lg bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4"><CardTitle className="flex items-center gap-2 text-lg text-slate-800"><Clock className="w-5 h-5 text-cyan-600"/> Operating Hours</CardTitle></CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-4"><div className="w-2 h-2 rounded-full bg-green-500 mt-2 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" /><div><p className="font-bold text-slate-800">Open Today</p><p className="text-sm text-slate-500">24 Hours (Emergency)</p><p className="text-sm text-slate-500 mt-1">OPD: 07:00 AM - 09:00 PM</p></div></div>
                  <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">* Specialist availability varies by appointment.</div>
                </CardContent>
              </Card>
              <Card className="shadow-lg bg-white rounded-2xl overflow-hidden border-slate-100">
                <CardContent className="p-6 space-y-6">
                  <div><h3 className="font-bold text-slate-900 text-lg mb-1">Book an Appointment</h3><p className="text-slate-500 text-sm">Schedule a consultation with our experts.</p></div>
                  <div className="space-y-3">
                    <Link href="/patient/appointments" className="block"><Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white h-12 shadow-lg hover:shadow-cyan-500/20 font-bold transition-all"><Calendar className="mr-2 h-4 w-4" /> Book Now</Button></Link>
                    <Link href="/contact" className="block"><Button variant="outline" className="w-full h-12 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"><Phone className="mr-2 h-4 w-4" /> Contact Help Desk</Button></Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}