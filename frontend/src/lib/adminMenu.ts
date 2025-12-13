import { 
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  CreditCard, 
  CalendarCheck, 
  Activity, 
  ShieldCheck,
  UserPlus
} from "lucide-react";

export const menuItems = [
  // --- COMMON ---
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: ["system_admin", "nurse", "receptionist"], // Everyone sees this
  },

  // --- RECEPTIONIST ---
  {
    title: "Appointments",
    href: "/admin/appointments",
    icon: CalendarCheck,
    roles: ["receptionist", "system_admin"],
  },
  {
    title: "Patient Registration",
    href: "/admin/patients/new",
    icon: UserPlus,
    roles: ["receptionist"],
  },
  {
    title: "Billing & Invoices",
    href: "/admin/billing",
    icon: CreditCard,
    roles: ["receptionist", "system_admin"],
  },

  // --- NURSE ---
  {
    title: "OPD Queue",
    href: "/admin/queue",
    icon: Activity,
    roles: ["nurse", "system_admin"],
  },
  {
    title: "Doctor Coordination",
    href: "/admin/doctor-status",
    icon: Stethoscope,
    roles: ["nurse"],
  },

  // --- SYSTEM ADMIN ---
  {
    title: "Manage Staff",
    href: "/admin/staff",
    icon: ShieldCheck,
    roles: ["system_admin"],
  },
  {
    title: "All Doctors",
    href: "/admin/doctors",
    icon: Users,
    roles: ["system_admin", "receptionist"],
  },
];