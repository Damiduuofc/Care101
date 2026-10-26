// Keep in sync with frontend/src/lib/data.ts — the admin "Create Doctor Account" form uses that list.
// A doctor's specialization is stored as the department name.
export type Department = {
  slug: string;
  name: string;
};

export const departments: Department[] = [
  { slug: "pediatrics", name: "Paediatrics & Child Care" },
  { slug: "obgyn", name: "Obstetrics & Gynaecology (VOG)" },
  { slug: "surgery", name: "General & Transplant Surgery" },
  { slug: "plastic-surgery", name: "Plastic & Reconstructive Surgery" },
  { slug: "general-medicine", name: "General Medicine & Physicians" },
  { slug: "dermatology", name: "Dermatology & Skin Care" },
  { slug: "endocrinology", name: "Endocrinology & Diabetes" },
  { slug: "gastroenterology", name: "Gastroenterology" },
  { slug: "urology", name: "Urology & Renal Science" },
  { slug: "dental", name: "Dental & Maxillofacial" },
  { slug: "ent", name: "Ear, Nose & Throat (ENT)" },
  { slug: "ophthalmology", name: "Eye Surgeons (Ophthalmology)" },
  { slug: "oncology", name: "Oncology (Cancer Center)" },
  { slug: "neurology", name: "Neurology & Neurosurgery" },
  { slug: "cardiology", name: "Cardiology & Chest Medicine" },
  { slug: "orthopedics", name: "Orthopaedics & Rheumatology" },
  { slug: "mental-health", name: "Psychiatry & Counselling" },
  { slug: "diagnostics", name: "Radiology & Laboratory" },
  { slug: "nutrition", name: "Nutrition & Dietetics" },
];

// Display name for a stored specialization; older accounts may hold a slug like "cardiology"
export const departmentLabel = (value?: string) => {
  if (!value) return '';
  const match = departments.find(d => d.name === value || d.slug === value.toLowerCase());
  return match ? match.name : value;
};
