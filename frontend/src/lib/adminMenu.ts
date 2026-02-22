import {
  LayoutDashboard,
  Users,
  CreditCard,
  CalendarCheck,
  Activity,
  ShieldCheck,
  UserCheck,
  Building,
  Clock
} from "lucide-react";

export const menuItems = [
  // --- SYSTEM ADMIN ---
  {
    title: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    roles: ["system_admin", "nurse"],
  },
  {
    title: "All Doctors",
    href: "/admin/doctors",
    icon: Users,
    roles: ["system_admin"],
  },
  {
    title: "Manage Staff",
    href: "/admin/staff",
    icon: ShieldCheck,
    roles: ["system_admin"],
  },

  // --- RECEPTIONIST DASHBOARD DEDICATED ITEMS ---
  {
    title: "Reception Desk",
    href: "/admin/receptionist-dashboard",
    icon: LayoutDashboard,
    roles: ["receptionist"],
  },
  {
    title: "Doctor Arrival",
    href: "/admin/doctors/arrival",
    icon: UserCheck,
    roles: ["receptionist"],
  },
  {
    title: "Appointments",
    href: "/admin/appointments",
    icon: CalendarCheck,
    roles: ["receptionist"],
  },
  {
    title: "Room Allocation",
    href: "/admin/room-allocation",
    icon: Building,
    roles: ["receptionist"],
  },
  {
    title: "Channeling Time",
    href: "/admin/channeling-time",
    icon: Clock,
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
    roles: ["nurse"],
  },

];