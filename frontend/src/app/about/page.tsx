"use client";

import Image from "next/image";
import { 
  Award, 
  Goal, 
  History, 
  Lightbulb, 
  Building2, 
  Users, 
  Heart, 
  ShieldCheck, 
  Stethoscope 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function AboutPage() {
  
  // Data for Core Values
  const coreValues = [
    { 
      icon: Heart,
      title: "Compassion", 
      description: "We treat every patient with empathy, kindness, and respect, ensuring they feel heard and valued." 
    },
    { 
      icon: Award,
      title: "Excellence", 
      description: "We relentlessly strive for the highest standards in medical care, technology, and service." 
    },
    { 
      icon: ShieldCheck,
      title: "Integrity", 
      description: "We adhere to the highest ethical principles, fostering trust through transparency and honesty." 
    },
    { 
      icon: Users,
      title: "Teamwork", 
      description: "We collaborate across disciplines to provide holistic, best-in-class patient outcomes." 
    },
  ];

  // Data for Gallery
  const galleryImages = [
    { src: "/images/gallery-1.jpg", label: "Advanced O.T." },
    { src: "/images/gallery-2.jpg", label: "Patient Ward" },
    { src: "/images/gallery-3.jpg", label: "MRI Diagnostics" },
    { src: "/images/gallery-4.jpg", label: "Reception Area" },
    { src: "/images/gallery-5.jpg", label: "Emergency Unit" },
    { src: "/images/gallery-6.jpg", label: "Rehabilitation" },
  ];

  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      
      {/* ================= HERO SECTION ================= */}
      <motion.section
        className="relative h-[50vh] flex items-center justify-center overflow-hidden bg-slate-900"
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
      >
        <div className="absolute inset-0 opacity-40">
           {/* Ensure about-hero.jpg is in public/images */}
           <Image
             src="/images/about-hero.jpg"
             alt="Hospital Building"
             fill
             className="object-cover"
             priority
           />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
        
        <div className="relative container px-6 text-center z-10">
          <span className="inline-block py-1 px-3 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-sm font-semibold mb-4 backdrop-blur-md">
            Since 1985
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-4">
            About <span className="text-cyan-400">Care Link</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-300 text-lg md:text-xl font-light leading-relaxed">
            Dedicated to advancing health and wellness in our community through compassionate care and medical innovation.
          </p>
        </div>
      </motion.section>

      {/* ================= MISSION & VISION ================= */}
      <section className="py-20 bg-white">
        <div className="container px-6 mx-auto">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
            className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center"
          >
            {/* Mission */}
            <div className="relative group">
              <div className="absolute inset-0 bg-cyan-100 rounded-3xl transform rotate-3 transition-transform group-hover:rotate-6" />
              <Card className="relative h-full border-none shadow-xl bg-white p-8 rounded-3xl">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500 flex items-center justify-center text-white mb-6 shadow-lg shadow-cyan-500/30">
                  <Goal className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Mission</h2>
                <p className="text-slate-600 text-lg leading-relaxed">
                  To provide outstanding and compassionate care to our patients, to advance medicine through research and education, and to improve the health of the communities we serve.
                </p>
              </Card>
            </div>

            {/* Vision */}
            <div className="relative group mt-8 md:mt-0">
              <div className="absolute inset-0 bg-blue-100 rounded-3xl transform -rotate-3 transition-transform group-hover:-rotate-6" />
              <Card className="relative h-full border-none shadow-xl bg-white p-8 rounded-3xl">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-600/30">
                  <Lightbulb className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Vision</h2>
                <p className="text-slate-600 text-lg leading-relaxed">
                  To be a national leader in healthcare quality and patient safety, setting new standards for patient-centered care and cutting-edge medical innovation.
                </p>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================= CORE VALUES ================= */}
      <section className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-cyan-200 rounded-full blur-[100px] opacity-20" />
        
        <div className="container px-6 mx-auto relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-cyan-600 font-bold tracking-widest uppercase text-sm mb-3">Our Culture</h2>
            <h3 className="text-4xl font-bold text-slate-900 mb-4">Core Values</h3>
            <p className="text-slate-500 text-lg">The guiding principles that define every interaction at Care Link.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <Card className="h-full border-0 shadow-md hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-8 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-cyan-600 mb-6 group-hover:bg-cyan-600 group-hover:text-white transition-colors duration-300">
                      <value.icon className="w-8 h-8" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-3">{value.title}</h4>
                    <p className="text-slate-500 leading-relaxed text-sm">{value.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HISTORY & FACILITIES ================= */}
      <section className="py-24 bg-white">
        <div className="container px-6 mx-auto">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            
            {/* History Column */}
            <motion.div 
              className="space-y-8"
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-cyan-100 rounded-xl text-cyan-700">
                  <History className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900">Our History</h2>
              </div>
              <p className="text-slate-600 text-lg leading-relaxed">
                Founded in 1985, Care Link started as a small community clinic with a big heart. Through decades of dedication and expansion, we have grown into a leading medical center in the region.
              </p>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <Award className="w-6 h-6 text-yellow-500" />
                  <h3 className="text-xl font-bold text-slate-900">Key Achievements</h3>
                </div>
                <ul className="space-y-3">
                  {['Top 100 Hospital nationwide (5 consecutive years)', 'Pioneers in robotic-assisted surgery', 'National Health Institute Safety Award'].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-600">
                      <span className="w-2 h-2 mt-2 rounded-full bg-cyan-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>

            {/* Facilities Column */}
            <motion.div 
              className="space-y-8"
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-blue-100 rounded-xl text-blue-700">
                  <Building2 className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900">Facilities & Tech</h2>
              </div>
              <p className="text-slate-600 text-lg leading-relaxed">
                Our campus features state-of-the-art facilities designed for patient comfort and medical excellence.
              </p>

              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: "20+ Operating Rooms", icon: Stethoscope },
                   { label: "3T MRI & PET/CT", icon: ActivityIcon }, 
                   { label: "Cancer Care Wing", icon: Heart },
                   { label: "500+ Patient Beds", icon: Building2 },
                 ].map((stat, i) => (
                    <Card key={i} className="bg-white border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex flex-col items-center text-center">
                        <stat.icon className="w-6 h-6 text-cyan-500 mb-2" />
                        <span className="font-semibold text-slate-800 text-sm">{stat.label}</span>
                      </CardContent>
                    </Card>
                 ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>
      
      {/* ================= GALLERY SECTION ================= */}
      <section className="py-24 bg-slate-950 text-white">
        <div className="container px-6 mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Inside Care Link</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">A glimpse into our world-class facilities and caring environment.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleryImages.map((image, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative aspect-video overflow-hidden rounded-2xl cursor-pointer"
              >
                {/* Local Image Usage */}
                <Image
                  src={image.src}
                  alt={image.label}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-0 left-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <p className="text-white font-bold text-lg">{image.label}</p>
                  <div className="w-10 h-1 bg-cyan-500 rounded-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

// Simple Helper Icon Component
function ActivityIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}