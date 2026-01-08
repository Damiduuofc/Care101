export type Department = {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  services: string[];
  operatingHours: string;
  
};

export const departments: Department[] = [
  {
    slug: "cardiology",
    name: "Cardiology",
    description: "Expert care for heart and vascular conditions.",
    longDescription: "Our Cardiology department offers state-of-the-art diagnostic and treatment services for all types of heart conditions. From preventative care and risk assessment to advanced surgical procedures, our team of renowned cardiologists is dedicated to your heart health.",
    services: ["Echocardiography", "Stress Testing", "Cardiac Catheterization", "Heart Failure Management"],
    operatingHours: "Mon-Fri, 8:00 AM - 5:00 PM",
   
  },
  {
    slug: "neurology",
    name: "Neurology",
    description: "Advanced treatment for brain and nervous system disorders.",
    longDescription: "The Neurology department specializes in the diagnosis and treatment of disorders affecting the brain, spinal cord, and nerves. We handle conditions such as stroke, epilepsy, multiple sclerosis, and Parkinson's disease with a multidisciplinary approach.",
    services: ["EEG & EMG", "Stroke Care", "Headache Clinic", "Movement Disorder Treatment"],
    operatingHours: "Mon-Fri, 9:00 AM - 6:00 PM",
   
  },
  {
    slug: "orthopedics",
    name: "Orthopedics",
    description: "Comprehensive care for bones, joints, and muscles.",
    longDescription: "From sports injuries to joint replacements, our Orthopedics department provides a full spectrum of care for musculoskeletal conditions. Our surgeons are leaders in minimally invasive techniques, ensuring faster recovery times.",
    services: ["Joint Replacement", "Sports Medicine", "Spine Surgery", "Trauma Care"],
    operatingHours: "Mon-Fri, 8:30 AM - 5:30 PM",
    
  },
  {
    slug: "pediatrics",
    name: "Pediatrics",
    description: "Specialized care for infants, children, and adolescents.",
    longDescription: "Our Pediatrics team is committed to providing a friendly and comforting environment for our youngest patients. We offer everything from routine check-ups and immunizations to specialized care for complex childhood illnesses.",
    services: ["Well-Child Visits", "Vaccinations", "Developmental Screening", "Adolescent Medicine"],
    operatingHours: "Mon-Sat, 8:00 AM - 7:00 PM",
   
  },
  {
    slug: "oncology",
    name: "Oncology",
    description: "Compassionate and advanced cancer treatment.",
    longDescription: "The Oncology department provides comprehensive cancer care, from diagnosis to treatment and survivorship. We utilize the latest in chemotherapy, radiation therapy, and immunotherapy, all delivered with a patient-centered focus.",
    services: ["Chemotherapy", "Radiation Therapy", "Immunotherapy", "Genetic Counseling"],
    operatingHours: "Mon-Fri, 8:00 AM - 5:00 PM",
  
  },
  {
    slug: "general-surgery",
    name: "General Surgery",
    description: "A wide range of surgical procedures.",
    longDescription: "Our General Surgery unit is equipped to handle a broad range of conditions. Our skilled surgeons perform both emergency and elective procedures with precision and care, using advanced laparoscopic and robotic techniques.",
    services: ["Appendectomy", "Hernia Repair", "Gallbladder Removal", "Colon Surgery"],
    operatingHours: "24/7 for emergencies",
 
  },

   {
    slug: "dermatology",
    name: "Dermatology",
    description: "Complete skin care services.",
    longDescription: "Our Dermatology department addresses all conditions related to skin, hair, and nails. We offer medical, surgical, and cosmetic dermatology services to help you achieve and maintain healthy skin.",
    services: ["Acne Treatment", "Skin Cancer Screening", "Cosmetic Procedures", "Eczema Management"],
    operatingHours: "Mon-Fri, 9:00 AM - 5:00 PM",
 
  }
];



