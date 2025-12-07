"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Phone, Stethoscope, Heart, Activity, Users, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { featuredDoctors, services, testimonials } from "@/lib/data";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { motion, useScroll, useTransform } from "framer-motion";
import Autoplay from "embla-carousel-autoplay";
import  Footer  from "@/components/layout/Footer";
import Navbar from "@/components/layout/Header";
export default function Home() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-cyan-100 selection:text-cyan-900">
      <Navbar/>
      {/* ================= HERO SECTION ================= */}
      <section className="relative h-[95vh] flex items-center justify-center overflow-hidden">
        {/* Parallax Background Image */}
        <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
          <Image
            src="/images/hero-bg.jpg"
            alt="Medical Facility"
            fill
            className="object-cover"
            priority
          />
        </motion.div>

        {/* Gradient Overlays for Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-900/80 to-blue-900/40 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent z-10" />

        <div className="container px-6 mx-auto relative z-10 pt-20">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 backdrop-blur-md border border-cyan-400/30 text-cyan-200 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Now accepting new patients
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
              Advanced Care,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-200">
                Personalized for You.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-blue-100 mb-10 leading-relaxed max-w-xl font-light">
              Experience the future of healthcare with our award-winning specialists and state-of-the-art medical technology.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/appointment">
                <Button size="lg" className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold h-14 px-8 rounded-full shadow-lg shadow-cyan-500/30 transition-all hover:scale-105">
                  <Stethoscope className="mr-2 h-5 w-5" /> Book Appointment
                </Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white hover:text-blue-900 h-14 px-8 rounded-full transition-all hover:scale-105">
                  Our Departments
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Floating Abstract Shapes */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-cyan-500/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
      </section>

      {/* ================= STATS BANNER ================= */}
      <div className="container px-6 mx-auto -mt-20 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Users, label: "Expert Doctors", value: "150+", desc: "Top-tier specialists" },
            { icon: Heart, label: "Patients Healed", value: "12k+", desc: "Successful surgeries" },
            { icon: Activity, label: "Emergency Care", value: "24/7", desc: "Always available" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="border-none shadow-xl bg-white/95 backdrop-blur-sm">
                <CardContent className="p-8 flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-blue-50 text-blue-600">
                    <stat.icon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
                    <p className="font-semibold text-slate-600">{stat.label}</p>
                    <p className="text-sm text-slate-400">{stat.desc}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ================= SERVICES SECTION ================= */}
      <section className="py-24 md:py-32 relative">
        <div className="container px-6 mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-sm font-bold tracking-widest text-cyan-600 uppercase mb-3">Medical Services</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">Comprehensive Care Solutions</h3>
            <p className="text-slate-500 text-lg">We combine compassionate care with clinical excellence to bring you the best possible health outcomes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.slice(0, 6).map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -8 }}
              >
                <Card className="h-full border border-slate-100 hover:border-cyan-100 bg-white hover:bg-slate-50/50 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300 group rounded-3xl overflow-hidden">
                  <CardContent className="p-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-cyan-500/20">
                      <service.icon className="w-7 h-7" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-3">{service.name}</h4>
                    <p className="text-slate-500 leading-relaxed mb-6">{service.description}</p>
                    <div className="flex items-center text-cyan-600 font-semibold text-sm group-hover:gap-2 transition-all cursor-pointer">
                      Learn More <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= DOCTORS SECTION ================= */}
      <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute right-0 top-0 w-[500px] h-[500px] bg-blue-500 rounded-full blur-[100px]" />
          <div className="absolute left-0 bottom-0 w-[500px] h-[500px] bg-cyan-500 rounded-full blur-[100px]" />
        </div>

        <div className="container px-6 mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Meet Our Specialists</h2>
              <p className="text-slate-400 text-lg">
                Our team of dedicated doctors brings years of experience and specialized knowledge to ensure you receive the best care.
              </p>
            </div>
            <Button variant="outline" className="border-slate-700 text-slate-200 hover:bg-white hover:text-slate-900 rounded-full px-8">
              View All Doctors
            </Button>
          </div>

          <Carousel
            opts={{ align: "start", loop: true }}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {featuredDoctors.map((doctor, i) => (
                <CarouselItem key={i} className="pl-4 md:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                  <div className="group relative h-[420px] rounded-3xl overflow-hidden cursor-pointer">
                    {/* Local Image Path Logic */}
                    <Image
                      src={`/images/doctor-${(i % 4) + 1}.jpg`} // Assumes you named images doctor-1.jpg, etc.
                      alt={doctor.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                    
                    <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <div className="bg-cyan-500 w-fit px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider mb-2">
                        {doctor.specialty}
                      </div>
                      <h3 className="text-2xl font-bold mb-1">{doctor.name}</h3>
                      <p className="text-slate-300 text-sm mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                        {doctor.qualifications}
                      </p>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-150">
                        <Button size="sm" className="w-full bg-white text-slate-900 hover:bg-slate-200">Book Now</Button>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <div className="flex justify-end gap-2 mt-8">
              <CarouselPrevious className="static translate-y-0 bg-slate-800 border-slate-700 hover:bg-cyan-500 hover:text-white" />
              <CarouselNext className="static translate-y-0 bg-slate-800 border-slate-700 hover:bg-cyan-500 hover:text-white" />
            </div>
          </Carousel>
        </div>
      </section>

      {/* ================= CTA / EMERGENCY ================= */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-rose-700 z-0" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 z-0" />
        
        <div className="container px-6 mx-auto relative z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 md:p-16 border border-white/20 text-center max-w-5xl mx-auto shadow-2xl">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white text-red-600 mb-8 animate-pulse">
              <Phone className="w-10 h-10" />
            </div>
            
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">Need Emergency Help?</h2>
            <p className="text-xl text-red-100 mb-10 max-w-2xl mx-auto">
              Our emergency department is open 24/7. If you are experiencing a medical emergency, do not hesitate to contact us immediately.
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Button size="lg" className="h-16 px-10 text-xl bg-white text-red-600 hover:bg-red-50 hover:scale-105 transition-all shadow-xl rounded-full">
                <Phone className="mr-3 h-6 w-6" /> Call 119 Emergency
              </Button>
              <Button size="lg" variant="outline" className="h-16 px-10 text-xl border-2 border-white/50 text-black hover:bg-white/10 hover:border-white rounded-full">
                <MapPin className="mr-3 h-6 w-6" /> Get Directions
              </Button>
            </div>
          </div>
        </div>
      </section>
              <Footer/>
    </div>
  );
}