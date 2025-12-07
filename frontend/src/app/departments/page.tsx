"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  Heart, 
  Brain, 
  Baby, 
  Bone, 
  Stethoscope, 
  Eye, 
  Activity, 
  Microscope 
} from "lucide-react";
import { departments } from "@/lib/data";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import  Header  from "@/components/layout/Header";
import  Footer  from "@/components/layout/Footer";
// Helper function to get Icon and Image based on department slug
// This allows you to style specific departments without changing your data.ts file
const getDeptAssets = (slug: string) => {
  switch (slug.toLowerCase()) {
    case 'cardiology':
      return { icon: Heart, color: 'text-red-500', bg: 'bg-red-50', img: '/images/dept-cardiology.jpg' };
    case 'neurology':
      return { icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50', img: '/images/dept-neurology.jpg' };
    case 'pediatrics':
      return { icon: Baby, color: 'text-yellow-500', bg: 'bg-yellow-50', img: '/images/dept-pediatrics.jpg' };
    case 'orthopedics':
      return { icon: Bone, color: 'text-slate-500', bg: 'bg-slate-100', img: '/images/dept-orthopedics.jpg' };
    case 'ophthalmology':
      return { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50', img: '/images/dept-general.jpg' };
    default:
      return { icon: Stethoscope, color: 'text-cyan-600', bg: 'bg-cyan-50', img: '/images/dept-general.jpg' };
  }
};

export default function DepartmentsPage() {
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      <Header /> 
      {/* ================= HERO SECTION ================= */}
      <section className="relative h-[45vh] flex items-center justify-center overflow-hidden bg-slate-900">
        <div className="absolute inset-0">
          <Image
            src="/images/departments-hero.jpg" // Ensure this exists in public/images/
            alt="Medical Departments"
            fill
            className="object-cover opacity-40"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent" />
        </div>
        
        <div className="relative container px-6 text-center z-10 pt-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-4">
              Centers of <span className="text-cyan-600">Excellence</span>
            </h1>
            <p className="max-w-2xl mx-auto text-slate-600 md:text-xl font-light">
              World-class specialized care delivered by expert teams using advanced technology.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ================= GRID SECTION ================= */}
      <section className="py-20 -mt-20 relative z-20">
        <div className="container px-6 mx-auto">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {departments.map((dept) => {
              const assets = getDeptAssets(dept.slug || dept.name);
              const Icon = assets.icon;

              return (
                <motion.div key={dept.slug} variants={itemVariants} className="group h-full">
                  <Card className="h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col bg-white rounded-3xl group-hover:-translate-y-2">
                    
                    {/* Card Image Header */}
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={assets.img}
                        alt={dept.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                      
                      {/* Floating Icon */}
                      <div className={`absolute -bottom-6 right-6 w-14 h-14 rounded-2xl ${assets.bg} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-7 h-7 ${assets.color}`} />
                      </div>
                    </div>

                    <CardContent className="pt-10 px-8 flex-grow">
                      <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-cyan-600 transition-colors">
                        {dept.name}
                      </h3>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-3">
                        {dept.description}
                      </p>
                      
                      {/* Services List */}
                      <div className="space-y-2 mb-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Key Services</p>
                        <ul className="space-y-2">
                          {dept.services.slice(0, 3).map((service) => (
                            <li key={service} className="flex items-center text-sm text-slate-600">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-2" />
                              {service}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>

                    <CardFooter className="px-8 pb-8 pt-0">
                      <Link href={`/departments/${dept.slug}`} className="w-full">
                        <Button className="w-full bg-slate-50 text-slate-900 hover:bg-cyan-500 hover:text-white border border-slate-200 hover:border-cyan-500 transition-all duration-300 font-semibold group-hover:shadow-lg shadow-cyan-500/20">
                          View Department <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ================= BOTTOM CTA ================= */}
      <section className="py-20 bg-cyan-600 text-white">
        <div className="container px-6 mx-auto text-center">
          <div className="max-w-3xl mx-auto">
            <Activity className="w-16 h-16 mx-auto mb-6 text-cyan-200 opacity-80" />
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Not sure which department you need?</h2>
            <p className="text-cyan-100 text-lg mb-10">
              Our patient care coordinators are available 24/7 to guide you to the right specialist for your specific symptoms.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/contact">
                <Button size="lg" variant="secondary" className="font-bold text-cyan-700 hover:text-cyan-900">
                  Contact Support
                </Button>
              </Link>
              <Link href="/appointments">
                <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white hover:text-cyan-700">
                  Book General Checkup
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

   <Footer />
    </div>
  );
}