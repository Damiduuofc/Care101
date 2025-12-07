"use client";

import Image from "next/image";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  AlertCircle, 
  Send,
  Navigation,
  CheckCircle2,
  HelpCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import  Header  from "@/components/layout/Header";
import  Footer  from "@/components/layout/Footer";

export default function ContactPage() {
  
  const contactMethods = [
    {
      icon: Phone,
      title: "Call Us",
      description: "Mon-Fri from 8am to 5pm",
      action: "(123) 456-7890",
      link: "tel:1234567890",
      color: "text-cyan-600",
      bg: "bg-cyan-50"
    },
    {
      icon: Mail,
      title: "Email Us",
      description: "We'll respond within 24 hours",
      action: "contact@carelink.com",
      link: "mailto:contact@carelink.com",
      color: "text-blue-600",
      bg: "bg-blue-50"
    },
    {
      icon: MapPin,
      title: "Visit Us",
      description: "123 Health St, Wellness City",
      action: "View on Map",
      link: "#map",
      color: "text-purple-600",
      bg: "bg-purple-50"
    }
  ];

  const faqs = [
    { q: "Where can I park?", a: "We have a dedicated multi-level parking lot available for patients and visitors via Gate 3." },
    { q: "Do you accept insurance?", a: "Yes, we accept most major insurance providers. Please contact our billing department for verification." },
    { q: "What are visiting hours?", a: "General visiting hours are from 10:00 AM to 8:00 PM daily. ICU hours differ." }
  ];

  const sectionVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-cyan-100 selection:text-cyan-900">
     <Header/> 
      {/* ================= HERO SECTION ================= */}
      <motion.section
        className="relative w-full h-[45vh] bg-slate-900 flex items-center justify-center overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
      >
        <div className="absolute inset-0">
          <Image
            src="/images/contact-hero.jpg" // Ensure this exists
            alt="Reception Desk"
            fill
            className="object-cover opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent" />
        </div>
        
        <div className="relative container px-6 text-center z-10 -mt-10">
          <span className="inline-block py-1 px-3 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-sm font-semibold mb-4 backdrop-blur-md">
            24/7 Support
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            Get in <span className="text-cyan-400">Touch</span>
          </h1>
          <p className="max-w-xl mx-auto text-slate-300 text-lg">
            We are here to help. Reach out to us for appointments, general inquiries, or medical support.
          </p>
        </div>
      </motion.section>

      {/* ================= FLOATING CARDS ================= */}
      <section className="relative z-20 -mt-20 pb-20">
        <div className="container px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {contactMethods.map((method, i) => (
              <motion.div
                key={method.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="border-0 shadow-xl bg-white hover:-translate-y-1 transition-transform duration-300 h-full">
                  <CardContent className="p-8 flex flex-col items-center text-center">
                    <div className={`w-14 h-14 rounded-2xl ${method.bg} ${method.color} flex items-center justify-center mb-6`}>
                      <method.icon className="w-7 h-7" />
                    </div>
                    <h3 className="font-bold text-xl text-slate-900 mb-2">{method.title}</h3>
                    <p className="text-slate-500 text-sm mb-4">{method.description}</p>
                    <a href={method.link} className={`font-bold ${method.color} hover:underline`}>
                      {method.action}
                    </a>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            
            {/* ================= LEFT: CONTACT FORM ================= */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={sectionVariants}
            >
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Send us a Message</h2>
                <p className="text-slate-500">
                  Please fill out the form below and our team will get back to you shortly.
                </p>
              </div>

              <Card className="border-slate-100 shadow-lg">
                <CardContent className="p-8">
                  <form className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-semibold text-slate-700">Full Name</label>
                        <Input id="name" placeholder="John Doe" className="h-12 bg-slate-50 border-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-semibold text-slate-700">Email Address</label>
                        <Input id="email" type="email" placeholder="john@example.com" className="h-12 bg-slate-50 border-slate-200" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="subject" className="text-sm font-semibold text-slate-700">Subject</label>
                      <Input id="subject" placeholder="Appointment Inquiry" className="h-12 bg-slate-50 border-slate-200" />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="message" className="text-sm font-semibold text-slate-700">Message</label>
                      <Textarea id="message" placeholder="How can we help you?" rows={6} className="bg-slate-50 border-slate-200 resize-none" />
                    </div>
                    
                    <Button type="submit" size="lg" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12 shadow-lg shadow-cyan-200">
                      Send Message <Send className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* ================= RIGHT: MAP & EMERGENCY ================= */}
            <div className="space-y-8">
              
              {/* Emergency Box */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-red-50 border border-red-100 rounded-3xl p-8 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <AlertCircle className="w-32 h-32 text-red-600" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-lg text-red-600">
                      <Phone className="w-6 h-6 animate-pulse" />
                    </div>
                    <h3 className="text-xl font-bold text-red-700">Emergency Hotline</h3>
                  </div>
                  <p className="text-red-600/80 mb-6 max-w-xs">
                    If you are experiencing a medical emergency, please dial our 24/7 hotline immediately.
                  </p>
                  <a href="tel:1234567899" className="inline-block text-3xl font-black text-red-600 hover:text-red-700 transition-colors">
                    (123) 456-7899
                  </a>
                </div>
              </motion.div>

              {/* Map Card */}
              <motion.div
                id="map"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="relative h-[400px] rounded-3xl overflow-hidden shadow-lg group"
              >
                <Image 
                  src="/images/map-bg.jpg" // Ensure this exists
                  alt="Hospital Location Map"
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-slate-900/20 transition-colors" />
                
                {/* Floating Map Detail */}
                <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur p-6 rounded-2xl shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-cyan-100 rounded-xl text-cyan-700 shrink-0">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Care Link Hospital</h4>
                      <p className="text-sm text-slate-500 mb-3">123 Health St, Wellness City</p>
                      <Button variant="outline" size="sm" className="w-full text-cyan-700 border-cyan-200 hover:bg-cyan-50">
                        <Navigation className="w-3 h-3 mr-2" /> Get Directions
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* FAQ Section */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm"
              >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-cyan-500" /> Common Questions
                </h3>
                <div className="space-y-4">
                  {faqs.map((faq, i) => (
                    <div key={i} className="flex gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{faq.q}</p>
                        <p className="text-slate-500 text-xs mt-1">{faq.a}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>
          </div>
        </div>
      </section>
   <Footer />
    </div>
  );
}