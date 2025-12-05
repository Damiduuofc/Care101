
import { Calendar, FileText, BarChart3, ShieldCheck, HeartPulse, List, LucideIcon } from 'lucide-react';

export const patientOverview: { title: string; value: string; subtitle: string; icon: LucideIcon }[] = [
    { title: "Upcoming Appointments", value: "2", subtitle: "Next one is tomorrow", icon: Calendar },
    { title: "Completed Visits", value: "12", subtitle: "Since last year", icon: ShieldCheck },
    { title: "Pending Payments", value: "1", subtitle: "LKR 2,500.00 due", icon: FileText },
    { title: "Medical Reports", value: "8", subtitle: "Available to view", icon: BarChart3 },
];

export const recentActivities = [
  { id: 1, description: "Your appointment with Dr. Carter is confirmed for tomorrow.", icon: Calendar, timestamp: "1 hour ago" },
  { id: 2, description: "New lab result available for 'Blood Test'.", icon: HeartPulse, timestamp: "3 hours ago" },
  { id: 3, description: "Invoice #INV-0078 is now due.", icon: FileText, timestamp: "1 day ago" },
  { id: 4, description: "Prescription for 'Metformin' was updated by Dr. Anderson.", icon: List, timestamp: "2 days ago" },
];

export const appointments = [
    { id: 1, doctorName: 'Dr. Emily Carter', specialty: 'Cardiology', hospital: 'Lakeside Hospital', date: '2024-08-15', time: '10:00 AM', type: 'Channeling', status: 'Upcoming' },
    { id: 2, doctorName: 'Dr. Benjamin Lee', specialty: 'Orthopedics', hospital: 'Central City Medical', date: '2024-08-20', time: '02:00 PM', type: 'Channeling', status: 'Upcoming' },
    { id: 3, doctorName: 'Dr. Olivia Garcia', specialty: 'Pediatrics', hospital: 'Lakeside Hospital', date: '2024-07-22', time: '11:30 AM', type: 'Channeling', status: 'Completed' },
    { id: 4, doctorName: 'Dr. James Anderson', specialty: 'Neurology', hospital: 'Central City Medical', date: '2024-07-10', time: '09:00 AM', type: 'Channeling', status: 'Completed' },
    { id: 5, doctorName: 'Dr. Sophia Martinez', specialty: 'Oncology', hospital: 'Lakeside Hospital', date: '2024-06-30', time: '01:00 PM', type: 'Surgery', status: 'Cancelled' },
];

export const medicalRecords = {
    consultations: [
        { id: 1, date: '2024-07-22', doctor: 'Dr. Olivia Garcia', diagnosis: 'Common Cold', attachment: 'record-01.pdf' },
        { id: 2, date: '2024-05-10', doctor: 'Dr. Emily Carter', diagnosis: 'Routine Check-up', attachment: 'record-02.pdf' },
    ],
    prescriptions: [
        { id: 1, title: 'Metformin 500mg', date: '2024-07-10', doctor: 'Dr. James Anderson', prescriptions: '1 tablet daily', attachment: 'rx-01.pdf' },
        { id: 2, title: 'Amoxicillin 250mg', date: '2024-06-05', doctor: 'Dr. Olivia Garcia', prescriptions: '1 tablet 3 times a day for 7 days', attachment: 'rx-02.pdf' },
    ],
    labTests: [
        { id: 1, title: 'Full Blood Count', date: '2024-07-08', doctor: 'Dr. James Anderson', attachment: 'lab-fbc-01.pdf' },
        { id: 2, title: 'Lipid Profile', date: '2024-05-10', doctor: 'Dr. Emily Carter', attachment: 'lab-lipid-01.pdf' },
    ],
    otherReports: [
        { id: 1, title: 'Chest X-Ray Report', date: '2024-04-15', doctor: 'Dr. Michael Williams', attachment: 'xray-01.pdf' },
    ]
};

export const pendingPayments = [
    { id: 1, invoiceNumber: 'INV-0078', service: 'Neurology Consultation', hospital: 'Central City Medical', amount: 2500.00, dueDate: '2024-08-10' },
];

export const completedPayments = [
    { id: 1, invoiceNumber: 'INV-0065', service: 'Pediatrics Check-up', hospital: 'Lakeside Hospital', amount: 1800.00, dueDate: '2024-07-25' },
    { id: 2, invoiceNumber: 'INV-0051', service: 'Cardiology Consultation', hospital: 'Lakeside Hospital', amount: 3000.00, dueDate: '2024-05-12' },
];

export const notifications = [
    { id: 1, type: 'appointment', message: 'Your appointment with Dr. Carter has been confirmed for Aug 15, 2024.', timestamp: '2 hours ago', read: false },
    { id: 2, type: 'report', message: 'Your latest blood test results are now available.', timestamp: '1 day ago', read: false },
    { id: 3, type: 'payment', message: 'Invoice INV-0078 for LKR 2,500.00 is due.', timestamp: '3 days ago', read: true },
    { id: 4, type: 'message', message: 'Dr. Anderson sent you a message regarding your recent scan.', timestamp: '4 days ago', read: true },
    { id: 5, type: 'appointment', message: 'Reminder: You have an appointment tomorrow.', timestamp: '5 days ago', read: true },
];
