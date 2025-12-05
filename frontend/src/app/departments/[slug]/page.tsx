"use client";

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
  ArrowRight,
  Heart,
  Brain,
  Baby,
  Bone,
  Eye,
  Stethoscope
} from 'lucide-react';
import { motion } from 'framer-motion';

type DepartmentPageProps = {
  params: {
    slug: string;
  };
};

// Reuse the asset helper for consistency
const getDeptAssets = (slug: string) => {
  switch (slug.toLowerCase()) {
    case 'cardiology':
      return { icon: Heart, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', img: '/images/dept-cardiology.jpg' };
    case 'neurology':
      return { icon: Brain, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', img: '/images/dept-neurology.jpg' };
    case 'pediatrics':
      return { icon: Baby, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', img: '/images/dept-pediatrics.jpg' };
    case 'orthopedics':
      return { icon: Bone, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', img: '/images/dept-orthopedics.jpg' };
    case 'ophthalmology':
      return { icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', img: '/images/dept-general.jpg' };
    default:
      return { icon: Stethoscope, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', img: '/images/dept-general.jpg' };
  }
};

export default function DepartmentPage({ params }: DepartmentPageProps) {
  const department = departments.find((dept) => dept.slug === params.slug);

  if (!department) {
    notFound();
  }

  const assets = getDeptAssets(department.slug || department.name);
  const Icon = assets.icon;

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      
      {/* ================= HERO SECTION ================= */}
      <div className="relative h-[50vh] min-h-[400px] w-full overflow-hidden bg-slate-900">
        <motion.div 
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          {/* Main Department Image */}
          <Image
            src={assets.img}
            alt={department.name}
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-slate-900/40 to-slate-900/80" />
        </motion.div>

        <div className="relative container h-full px-6 flex flex-col justify-center max-w-6xl mx-auto pt-20">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6 max-w-3xl"
          >
            <Badge className={`${assets.bg} ${assets.color} hover:${assets.bg} border-0 px-4 py-1.5 text-sm font-bold uppercase tracking-wide`}>
              Specialized Care
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white shadow-black/10 drop-shadow-lg">
              {department.name}
            </h1>
            <p className="text-xl md:text-2xl text-slate-200 font-light leading-relaxed max-w-2xl">
              {department.description}
            </p>
          </motion.div>
        </div>
      </div>

      <main className="container px-6 mx-auto max-w-6xl -mt-20 relative z-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* ================= LEFT CONTENT (2/3) ================= */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* About Section */}
            <motion.div 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true }}
              variants={sectionVariants}
              className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50"
            >
              <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                <div className={`p-3 rounded-xl ${assets.bg} ${assets.color}`}>
                  <Icon className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
              </div>
              <p className="text-slate-600 leading-8 text-lg">
                {department.longDescription || "We provide comprehensive diagnosis, treatment, and management of conditions related to this field. Our team of experts uses the latest technology to ensure the best possible outcomes for our patients."}
              </p>
            </motion.div>

            {/* Services Grid */}
            <motion.div 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true }}
              variants={sectionVariants}
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className={`w-2 h-8 rounded-full ${assets.bg.replace('bg-', 'bg-')}-500`}></span>
                Treatments & Services
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {department.services.map((service, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-cyan-100 hover:shadow-lg transition-all duration-300 group"
                  >
                    <CheckCircle2 className={`w-5 h-5 mt-1 ${assets.color} shrink-0`} />
                    <span className="font-medium text-slate-700 group-hover:text-slate-900">{service}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Meet the Team */}
            <motion.div 
              initial="hidden" 
              whileInView="visible" 
              viewport={{ once: true }}
              variants={sectionVariants}
              className="pt-8"
            >
               <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className={`w-2 h-8 rounded-full ${assets.bg.replace('bg-', 'bg-')}-500`}></span>
                Meet Our Specialists
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {department.doctors.map((doctor, i) => (
                  <Link href={`/doctors`} key={doctor.id}>
                    <Card className="hover:shadow-lg transition-all duration-300 border-slate-100 cursor-pointer group h-full">
                      <CardContent className="p-6 flex items-center gap-4">
                        <div className="relative h-20 w-20 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner shrink-0">
                          {/* Local Doctor Image */}
                          <Image 
                            src={`/images/doctor-${(i % 4) + 1}.jpg`} 
                            alt={doctor.name} 
                            fill 
                            className="object-cover transition-transform group-hover:scale-110" 
                          />
                        </div>
                        <div>
                          <p className="font-bold text-lg text-slate-900 group-hover:text-cyan-600 transition-colors">
                            {doctor.name}
                          </p>
                          <p className={`text-sm ${assets.color} font-medium mb-1`}>
                            {department.name} Specialist
                          </p>
                          <p className="text-xs text-slate-400">{doctor.qualifications}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </motion.div>
          </div>

          {/* ================= RIGHT SIDEBAR (Sticky) ================= */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="sticky top-24 space-y-6">
              
              {/* Operating Hours Card */}
              <Card className="border-t-4 border-cyan-500 shadow-xl shadow-slate-200/50 overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-cyan-600"/>
                    Operating Hours
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 mb-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 animate-pulse" />
                     <div>
                       <p className="font-semibold text-slate-800">Open Today</p>
                       <p className="text-sm text-slate-500">{department.operatingHours}</p>
                     </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 bg-slate-100 p-3 rounded-lg">
                    * Emergency services for this department are available 24/7.
                  </p>
                </CardContent>
              </Card>

              {/* Quick Contact Card */}
              <Card className="shadow-lg">
                <CardContent className="p-6 space-y-6">
                  <h3 className="font-bold text-slate-900 text-lg">Need to visit?</h3>
                  <div className="space-y-4">
                    <Link href="/appointments" className="block">
                      <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white h-12 shadow-md shadow-cyan-200 font-bold">
                        <Calendar className="mr-2 h-4 w-4" /> Book Appointment
                      </Button>
                    </Link>
                    <Link href="/contact" className="block">
                      <Button variant="outline" className="w-full h-12 border-slate-200 text-slate-600 hover:text-cyan-600 hover:border-cyan-200">
                        <Phone className="mr-2 h-4 w-4" /> Contact Clinic
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* Mini Help Section */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white text-center">
                 <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 text-cyan-400">
                    <Phone className="w-6 h-6" />
                 </div>
                 <h4 className="font-bold mb-2">Emergency?</h4>
                 <p className="text-sm text-slate-300 mb-4">Call our dedicated emergency line for immediate assistance.</p>
                 <a href="tel:119" className="text-2xl font-bold text-cyan-400 hover:text-white transition-colors">
                   119
                 </a>
              </div>

            </div>
          </aside>

        </div>
      </main>
    </div>
  );
}