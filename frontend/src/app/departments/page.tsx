"use client";

import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  Heart, Brain, Baby, Bone, Stethoscope, Eye, Activity, Microscope,
  Scissors, Smile, Users, Pill, Syringe
} from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// --- Departments data ---
export const departments = [
  // --- CHILD & MATERNAL ---
  {
    slug: "pediatrics",
    name: "Paediatrics & Child Care",
    description: "Comprehensive care for infants and children including neonatology, pediatric cardiology, neurology, and surgery.",
    services: ["Neonatology", "Paediatric Surgery", "Paediatric Cardiology", "Paediatric Neurology", "Paediatric Nephrology"]
  },
  {
    slug: "obgyn",
    name: "Obstetrics & Gynaecology (VOG)",
    description: "Women's health services including maternity, reproductive health, and gynecological onco-surgery.",
    services: ["Maternity Care", "Gynaecological Oncology", "Reproductive Health", "Prenatal Care"]
  },

  // --- SURGERY GROUPS ---
  {
    slug: "surgery",
    name: "General & Transplant Surgery",
    description: "Advanced surgical interventions including vascular, transplant, and hepatopancreaticobiliary surgeries.",
    services: ["General Surgery", "Transplant Surgery", "Vascular Surgery", "Hepatopancreaticobiliary Surgeon"]
  },
  {
    slug: "plastic-surgery",
    name: "Plastic & Reconstructive Surgery",
    description: "Aesthetic and reconstructive procedures performed by specialized plastic surgeons.",
    services: ["Cosmetic Surgery", "Reconstructive Surgery", "Burn Care"]
  },

  // --- SPECIALIZED MEDICINE (Broken down to match Image) ---
  {
    slug: "general-medicine",
    name: "General Medicine & Physicians",
    description: "Primary healthcare, elderly care, and community medicine for overall wellness.",
    services: ["General Medicine", "Elderly Care", "Community Medicine", "Critical Care"]
  },
  {
    slug: "dermatology",
    name: "Dermatology & Skin Care",
    description: "Diagnosis and treatment of skin, hair, and nail conditions.",
    services: ["Clinical Dermatology", "Cosmetic Dermatology", "Skin Surgery"]
  },
  {
    slug: "endocrinology",
    name: "Endocrinology & Diabetes",
    description: "Management of hormonal disorders, diabetes, and thyroid conditions.",
    services: ["Diabetes Care", "Thyroid Disorders", "Hormonal Therapy"]
  },
  {
    slug: "gastroenterology",
    name: "Gastroenterology",
    description: "Care for the digestive system, liver, and gastrointestinal tract.",
    services: ["Endoscopy", "Liver Disease (Hepatology)", "Gastroenterological Surgery"]
  },
  {
    slug: "urology",
    name: "Urology & Renal Science",
    description: "Treatment for urinary tract systems and male reproductive organs.",
    services: ["Urology", "Nephrology (Kidney)", "Renal Transplant"]
  },
  
  // --- HEAD, NECK & SENSORY ---
  {
    slug: "dental",
    name: "Dental & Maxillofacial",
    description: "Complete oral healthcare including orthodontics, restorative dentistry, and OMF surgery.",
    services: ["Dental Surgery", "Orthodontics", "Restorative Dentistry", "OMF Surgery"]
  },
  {
    slug: "ent",
    name: "Ear, Nose & Throat (ENT)",
    description: "Head and neck surgery and medical treatment for ENT disorders.",
    services: ["Head & Neck Surgery", "ENT Services", "Audiology"]
  },
  {
    slug: "ophthalmology",
    name: "Eye Surgeons (Ophthalmology)",
    description: "Advanced vision care and eye surgery.",
    services: ["Cataract Surgery", "Vision Correction", "Eye Surgery"]
  },

  // --- CHRONIC & CRITICAL ---
  {
    slug: "oncology",
    name: "Oncology (Cancer Center)",
    description: "Integrated cancer care including surgical, medical, and hemato-oncology.",
    services: ["Onco-Surgery", "Hemato-Oncology", "Medical Oncology", "Gynecologist Onco-Surgeon"]
  },
  {
    slug: "neurology",
    name: "Neurology & Neurosurgery",
    description: "Brain and spine care provided by neurologists and neurosurgeons.",
    services: ["Clinical Neurology", "Neuro-Surgery", "Neurophysiology"]
  },
  {
    slug: "cardiology",
    name: "Cardiology & Chest Medicine",
    description: "Heart and lung care, including thoracic medicine and respiratory health.",
    services: ["Cardiology", "Chest Physicians", "Thoracic Medicine"]
  },
  {
    slug: "orthopedics",
    name: "Orthopaedics & Rheumatology",
    description: "Bone, joint, and muscle care including sports medicine and rehabilitation.",
    services: ["Orthopaedic Surgery", "Rheumatology", "Sports Medicine", "Rehabilitation"]
  },
  {
    slug: "mental-health",
    name: "Psychiatry & Counselling",
    description: "Mental health support, psychology, and behavioral therapy.",
    services: ["Psychiatry", "Counseling", "Psychology"]
  },
  
  // --- DIAGNOSTICS & OTHERS ---
  {
    slug: "diagnostics",
    name: "Radiology & Laboratory",
    description: "Advanced imaging and lab services.",
    services: ["Radiology", "Interventional Radiology", "Haematology", "Microbiology"]
  },
  {
    slug: "nutrition",
    name: "Nutrition & Dietetics",
    description: "Personalized dietary planning and nutritional support.",
    services: ["Clinical Nutrition", "Diet Planning", "Weight Management"]
  }
];

// --- Helper for images/icons ---
const getDeptAssets = (slug: string) => {
  switch (slug.toLowerCase()) {
    case 'pediatrics': return { icon: Baby, color: 'text-pink-500', bg: 'bg-pink-50', img: '/images/dept-pediatrics.jpg' };
    case 'surgery': return { icon: Scissors, color: 'text-emerald-500', bg: 'bg-emerald-50', img: '/images/dept-surgery.jpg' };
    case 'dental': return { icon: Smile, color: 'text-cyan-500', bg: 'bg-cyan-50', img: '/images/dept-dental.jpg' };
    case 'obgyn': return { icon: Users, color: 'text-rose-500', bg: 'bg-rose-50', img: '/images/dept-obgyn.jpg' };
    case 'oncology': return { icon: Microscope, color: 'text-amber-500', bg: 'bg-amber-50', img: '/images/dept-oncology.jpg' };
    case 'neurology': return { icon: Brain, color: 'text-purple-500', bg: 'bg-purple-50', img: '/images/dept-neurology.jpg' };
    case 'orthopedics': return { icon: Bone, color: 'text-slate-500', bg: 'bg-slate-100', img: '/images/dept-orthopedics.jpg' };
    case 'cardiology': return { icon: Heart, color: 'text-red-500', bg: 'bg-red-50', img: '/images/dept-cardiology.jpg' };
    case 'specialized-medicine': return { icon: Pill, color: 'text-indigo-500', bg: 'bg-indigo-50', img: '/images/dept-internal.jpg' };
    case 'mental-health': return { icon: Activity, color: 'text-teal-500', bg: 'bg-teal-50', img: '/images/dept-psych.jpg' };
    case 'ent-eye': return { icon: Eye, color: 'text-blue-500', bg: 'bg-blue-50', img: '/images/dept-eye.jpg' };
    case 'diagnostics': return { icon: Syringe, color: 'text-orange-500', bg: 'bg-orange-50', img: '/images/dept-lab.jpg' };
    default: return { icon: Stethoscope, color: 'text-cyan-600', bg: 'bg-cyan-50', img: '/images/dept-general.jpg' };
  }
};

export default function DepartmentsPage() {
  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      <Header />
      <section className="relative h-[45vh] flex items-center justify-center overflow-hidden bg-slate-900">
        <Image src="/images/departments-hero.jpg" fill alt="Departments" className="object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent" />
        <div className="relative z-10 text-center px-6">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4">Centers of <span className="text-cyan-600">Excellence</span></h1>
          <p className="text-slate-600 md:text-xl font-light max-w-2xl mx-auto">World-class specialized care delivered by expert teams using advanced technology.</p>
        </div>
      </section>

      <section className="py-20 -mt-20 relative z-20">
        <div className="container mx-auto px-6">
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
            {departments.map((dept) => {
              const assets = getDeptAssets(dept.slug);
              const Icon = assets.icon;
              return (
                <motion.div key={dept.slug} variants={itemVariants} className="group h-full">
                  <Card className="h-full flex flex-col bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300">
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image src={assets.img} alt={dept.name} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                      <div className={`absolute -bottom-6 right-6 w-14 h-14 rounded-2xl ${assets.bg} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-7 h-7 ${assets.color}`} />
                      </div>
                    </div>
                    <CardContent className="pt-10 px-8 flex-grow">
                      <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-cyan-600 transition-colors">{dept.name}</h3>
                      <p className="text-slate-500 text-sm mb-6 line-clamp-3">{dept.description}</p>
                      <ul className="space-y-1 text-sm text-slate-600">
                        {dept.services.slice(0,3).map((s) => <li key={s}>• {s}</li>)}
                      </ul>
                    </CardContent>
                    <CardFooter className="px-8 pb-8 pt-0">
                      <Link href={`/departments/${dept.slug}`}>
                        <Button className="w-full bg-slate-50 text-slate-900 hover:bg-cyan-500 hover:text-white border border-slate-200 hover:border-cyan-500 transition-all duration-300 font-semibold">
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

      <Footer />
    </div>
  );
}
