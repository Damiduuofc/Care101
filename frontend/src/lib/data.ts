import {
  Stethoscope,
  HeartPulse,
  Brain,
  Bone,
  Baby,
  Activity,
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

export type Department = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  services: string[];
  operatingHours: string;
  doctors: Doctor[];
};

export const departments: Department[] = [
  {
    slug: "cardiology",
    name: "Cardiology",
    description: "Expert care for heart and vascular conditions.",
    longDescription: "Our Cardiology department offers state-of-the-art diagnostic and treatment services for all types of heart conditions. From preventative care and risk assessment to advanced surgical procedures, our team of renowned cardiologists is dedicated to your heart health.",
    services: ["Echocardiography", "Stress Testing", "Cardiac Catheterization", "Heart Failure Management"],
    operatingHours: "Mon-Fri, 8:00 AM - 5:00 PM",
    doctors: [
      { id: 1, name: "Dr. Emily Carter", specialty: "Cardiology", qualifications: "MD, FACC", imageId: "doctor-1" },
      { id: 7, name: "Dr. Isabella Rodriguez", specialty: "Cardiology", qualifications: "MD, PhD", imageId: "doctor-7" },
    ]
  },
  {
    slug: "neurology",
    name: "Neurology",
    description: "Advanced treatment for brain and nervous system disorders.",
    longDescription: "The Neurology department specializes in the diagnosis and treatment of disorders affecting the brain, spinal cord, and nerves. We handle conditions such as stroke, epilepsy, multiple sclerosis, and Parkinson's disease with a multidisciplinary approach.",
    services: ["EEG & EMG", "Stroke Care", "Headache Clinic", "Movement Disorder Treatment"],
    operatingHours: "Mon-Fri, 9:00 AM - 6:00 PM",
    doctors: [
      { id: 2, name: "Dr. James Anderson", specialty: "Neurology", qualifications: "MD, PhD", imageId: "doctor-2" }
    ]
  },
  {
    slug: "orthopedics",
    name: "Orthopedics",
    description: "Comprehensive care for bones, joints, and muscles.",
    longDescription: "From sports injuries to joint replacements, our Orthopedics department provides a full spectrum of care for musculoskeletal conditions. Our surgeons are leaders in minimally invasive techniques, ensuring faster recovery times.",
    services: ["Joint Replacement", "Sports Medicine", "Spine Surgery", "Trauma Care"],
    operatingHours: "Mon-Fri, 8:30 AM - 5:30 PM",
    doctors: [
      { id: 4, name: "Dr. Benjamin Lee", specialty: "Orthopedics", qualifications: "MD, FRCS", imageId: "doctor-4" }
    ]
  },
  {
    slug: "pediatrics",
    name: "Pediatrics",
    description: "Specialized care for infants, children, and adolescents.",
    longDescription: "Our Pediatrics team is committed to providing a friendly and comforting environment for our youngest patients. We offer everything from routine check-ups and immunizations to specialized care for complex childhood illnesses.",
    services: ["Well-Child Visits", "Vaccinations", "Developmental Screening", "Adolescent Medicine"],
    operatingHours: "Mon-Sat, 8:00 AM - 7:00 PM",
    doctors: [
      { id: 3, name: "Dr. Olivia Garcia", specialty: "Pediatrics", qualifications: "MD, FAAP", imageId: "doctor-3" }
    ]
  },
  {
    slug: "oncology",
    name: "Oncology",
    description: "Compassionate and advanced cancer treatment.",
    longDescription: "The Oncology department provides comprehensive cancer care, from diagnosis to treatment and survivorship. We utilize the latest in chemotherapy, radiation therapy, and immunotherapy, all delivered with a patient-centered focus.",
    services: ["Chemotherapy", "Radiation Therapy", "Immunotherapy", "Genetic Counseling"],
    operatingHours: "Mon-Fri, 8:00 AM - 5:00 PM",
    doctors: [
      { id: 5, name: "Dr. Sophia Martinez", specialty: "Oncology", qualifications: "MD", imageId: "doctor-5" }
    ]
  },
  {
    slug: "general-surgery",
    name: "General Surgery",
    description: "A wide range of surgical procedures.",
    longDescription: "Our General Surgery unit is equipped to handle a broad range of conditions. Our skilled surgeons perform both emergency and elective procedures with precision and care, using advanced laparoscopic and robotic techniques.",
    services: ["Appendectomy", "Hernia Repair", "Gallbladder Removal", "Colon Surgery"],
    operatingHours: "24/7 for emergencies",
    doctors: [
      { id: 6, name: "Dr. Michael Williams", specialty: "General Surgery", qualifications: "MD, FACS", imageId: "doctor-6" }
    ]
  },
   {
    slug: "dermatology",
    name: "Dermatology",
    description: "Complete skin care services.",
    longDescription: "Our Dermatology department addresses all conditions related to skin, hair, and nails. We offer medical, surgical, and cosmetic dermatology services to help you achieve and maintain healthy skin.",
    services: ["Acne Treatment", "Skin Cancer Screening", "Cosmetic Procedures", "Eczema Management"],
    operatingHours: "Mon-Fri, 9:00 AM - 5:00 PM",
    doctors: [
       { id: 8, name: "Dr. David Chen", specialty: "Dermatology", qualifications: "MD", imageId: "doctor-8" }
    ]
  }
];

export type Doctor = {
  id: number;
  name: string;
  specialty: string;
  qualifications: string;
  imageId: string;
};

export const allDoctors: Doctor[] = departments.flatMap(dep => dep.doctors).reduce((acc: Doctor[], current) => {
  if (!acc.find(item => item.id === current.id)) {
    acc.push(current);
  }
  return acc;
}, []);

export const featuredDoctors: Doctor[] = allDoctors.slice(0, 4);

export type Testimonial = {
  name: string;
  quote: string;
};

export const testimonials: Testimonial[] = [
  {
    name: "Sarah L.",
    quote: "The care I received at MediServe Hub was exceptional. The doctors and nurses were so attentive and made me feel completely at ease during a stressful time.",
  },
  {
    name: "John D.",
    quote: "From the moment I walked in, I was impressed by the professionalism and friendliness of the staff. The facility is modern and clean. Highly recommended!",
  },
  {
    name: "Maria G.",
    quote: "Dr. Carter saved my life. Her expertise and compassionate approach are second to none. I'm forever grateful to the entire cardiology team.",
  },
  {
    name: "David P.",
    quote: "My son's treatment in the pediatric ward was fantastic. They have a wonderful way with children and made the experience as positive as possible.",
  },
];
