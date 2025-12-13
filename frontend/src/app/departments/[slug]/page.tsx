"use client";

import { use, useEffect, useState } from 'react'; 
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { departments } from '@/lib/data'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  CheckCircle2, 
  User, 
  Calendar, 
  Phone, 
  Heart,
  Brain,
  Baby,
  Bone,
  Eye,
  Stethoscope,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import  Header  from "@/components/layout/Header";
import  Footer  from "@/components/layout/Footer";
// API to get real doctors
const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/doctors/public`;

type DepartmentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const getDeptAssets = (slug: string) => {
  switch (slug.toLowerCase()) {
    case 'cardiology': return { icon: Heart, color: 'text-red-600', bg: 'bg-red-50', img: '/images/dept-cardiology.jpg' };
    case 'neurology': return { icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50', img: '/images/dept-neurology.jpg' };
    case 'pediatrics': return { icon: Baby, color: 'text-yellow-600', bg: 'bg-yellow-50', img: '/images/dept-pediatrics.jpg' };
    case 'orthopedics': return { icon: Bone, color: 'text-slate-600', bg: 'bg-slate-100', img: '/images/dept-orthopedics.jpg' };
    case 'ophthalmology': return { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50', img: '/images/dept-general.jpg' };
    default: return { icon: Stethoscope, color: 'text-cyan-600', bg: 'bg-cyan-50', img: '/images/dept-general.jpg' };
  }
};

export default function DepartmentPage({ params }: DepartmentPageProps) {
  // ✅ Unwrap the params Promise using React.use()
  const { slug } = use(params);

  const department = departments.find((dept) => dept.slug === slug);
  
  // State for real doctors
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  if (!department) {
    notFound();
  }

  // Fetch Real Doctors matching this Department
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch(API_URL);
        if (res.ok) {
          const allDoctors = await res.json();
          const relevantDoctors = allDoctors.filter((doc: any) => 
            doc.specialization?.toLowerCase().includes(department.name.toLowerCase()) || 
            department.name.toLowerCase().includes(doc.specialization?.toLowerCase())
          );
          setDoctors(relevantDoctors);
        }
      } catch (error) {
        console.error("Failed to load doctors");
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, [department.name]);

  const assets = getDeptAssets(department.slug || department.name);
  const Icon = assets.icon;

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      <Header />
      {/* ================= HERO ================= */}
      <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden bg-slate-900">
        <motion.div initial={{ scale: 1.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0">
          <Image src={assets.img} alt={department.name} fill className="object-cover opacity-60" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-slate-900/80" />
        </motion.div>

        <div className="relative container h-full px-6 flex flex-col justify-center max-w-6xl mx-auto pt-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
            <Badge className={`${assets.bg} ${assets.color} border-0 px-4 py-1.5 text-sm font-bold uppercase`}>
              Specialized Care
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">{department.name}</h1>
            <p className="text-xl md:text-2xl text-slate-200 font-light">{department.description}</p>
          </motion.div>
        </div>
      </div>

      <main className="container px-6 mx-auto max-w-6xl -mt-20 relative z-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ================= LEFT CONTENT ================= */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Overview */}
            <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="bg-white rounded-3xl p-8 shadow-xl">
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                <div className={`p-3 rounded-xl ${assets.bg} ${assets.color}`}><Icon className="w-8 h-8" /></div>
                <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
              </div>
              <p className="text-slate-600 leading-8 text-lg">{department.longDescription}</p>
            </motion.div>

            {/* Services */}
            <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className={`w-2 h-8 rounded-full ${assets.bg.replace('bg-', 'bg-')}-500`}></span>
                Treatments & Services
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {department.services.map((service, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:shadow-lg transition-all">
                    <CheckCircle2 className={`w-5 h-5 mt-1 ${assets.color} shrink-0`} />
                    <span className="font-medium text-slate-700">{service}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* REAL DOCTORS SECTION */}
            <motion.div variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="pt-8">
               <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className={`w-2 h-8 rounded-full ${assets.bg.replace('bg-', 'bg-')}-500`}></span>
                Meet Our Specialists
              </h3>
              
              {loading ? (
                 <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
              ) : doctors.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {doctors.map((doctor) => (
                    <Link href={`/patient/appointments?preSelectedDocId=${doctor._id}`} key={doctor._id}>
                        <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 cursor-pointer h-full group">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="relative h-20 w-20 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner shrink-0 bg-slate-100">
                                {doctor.profileImage ? (
                                    <img src={doctor.profileImage} alt={doctor.name} className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-full w-full p-4 text-slate-300" />
                                )}
                            </div>
                            <div>
                            <p className="font-bold text-lg text-slate-900 group-hover:text-cyan-600 transition-colors">
                                {doctor.name}
                            </p>
                            <p className={`text-sm ${assets.color} font-medium mb-1`}>
                                {doctor.specialization}
                            </p>
                            <p className="text-xs text-slate-400 line-clamp-1">{doctor.qualifications}</p>
                            </div>
                        </CardContent>
                        </Card>
                    </Link>
                    ))}
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500">
                    No doctors currently listed for {department.name}.
                </div>
              )}
            </motion.div>
          </div>

          {/* ================= RIGHT SIDEBAR ================= */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="sticky top-24 space-y-6">
              
              {/* Hours */}
              <Card className="border-t-4 border-cyan-500 shadow-lg">
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg"><Clock className="w-5 h-5 text-cyan-600"/> Operating Hours</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 animate-pulse" />
                     <div>
                       <p className="font-semibold text-slate-800">Open Today</p>
                       <p className="text-sm text-slate-500">{department.operatingHours}</p>
                     </div>
                  </div>
                </CardContent>
              </Card>

              {/* Book Button */}
              <Card className="shadow-lg">
                <CardContent className="p-6 space-y-6">
                  <h3 className="font-bold text-slate-900 text-lg">Need to visit?</h3>
                  <div className="space-y-4">
                    <Link href="/patient/appointments" className="block">
                      <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white h-12 shadow-md font-bold">
                        <Calendar className="mr-2 h-4 w-4" /> Book Appointment
                      </Button>
                    </Link>
                    <Link href="/contact" className="block">
                      <Button variant="outline" className="w-full h-12 border-slate-200 text-slate-600">
                        <Phone className="mr-2 h-4 w-4" /> Contact Clinic
                      </Button>
                    </Link>
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