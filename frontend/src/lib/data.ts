import { 
  Baby, Users, Scissors, Smile, Stethoscope, Microscope, Brain, Heart, 
  Bone, Activity, Eye, Syringe, Pill, Apple,HeartPulse,
  type LucideIcon,
} from "lucide-react";


export type Service = {
  name: string;
  description: string;
  icon: LucideIcon;
};

export const services: Service[] = [
  {
    name: "Cardiology",
    description: "Expert care for heart and vascular conditions.",
    icon: HeartPulse,
  },
  {
    name: "Neurology",
    description: "Advanced treatment for brain and nervous system disorders.",
    icon: Brain,
  },
  {
    name: "Orthopedics",
    description: "Comprehensive care for bones, joints, and muscles.",
    icon: Bone,
  },
  {
    name: "Pediatrics",
    description: "Specialized medical attention for infants, children, and adolescents.",
    icon: Baby,
  },
  {
    name: "General Surgery",
    description: "A wide range of surgical procedures from routine to complex.",
    icon: Stethoscope,
  },
  {
    name: "Oncology",
    description: "Compassionate and advanced cancer treatment and therapies.",
    icon: Activity,
  },
];



// lib/data.ts


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

  // --- SPECIALIZED MEDICINE ---
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

