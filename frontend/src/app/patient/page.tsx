
"use client";
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, Upload, MessageSquare, Bell, BarChart3, ShieldCheck, HeartPulse, List } from 'lucide-react';
import { recentActivities, patientOverview } from '@/lib/patient-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { motion } from 'framer-motion';

export default function PatientHomePage() {
  const bannerImage = PlaceHolderImages.find(img => img.id === 'doctor-dashboard-banner'); // Reusing banner for now
  const profileImage = PlaceHolderImages.find(img => img.id === 'patient-profile');

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div 
        className="space-y-8"
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
    >
        <motion.div variants={itemVariants}>
            <Card className="overflow-hidden">
                <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6 bg-gradient-to-r from-primary/10 to-background">
                    <div className="relative h-24 w-24 rounded-full overflow-hidden shadow-md">
                        {profileImage && <Image src={profileImage.imageUrl} alt="Patient Profile" fill style={{objectFit: 'cover'}} data-ai-hint={profileImage.imageHint} />}
                    </div>
                    <div className='text-center md:text-left'>
                        <h1 className="text-3xl font-bold font-headline">Welcome, Jane Doe!</h1>
                        <p className="text-muted-foreground">Here is your health summary and quick access to your records.</p>
                    </div>
                    <div className="md:ml-auto flex items-center gap-2 bg-yellow-100 border border-yellow-300 text-yellow-800 p-2 rounded-lg text-sm">
                        <Bell className="h-5 w-5"/>
                        <span>You have 2 new notifications.</span>
                        <Link href="/patient/notifications"><Button variant="link" className="p-0 h-auto text-yellow-800">View</Button></Link>
                    </div>
                </CardContent>
            </Card>
        </motion.div>

        <motion.div variants={sectionVariants}>
            <h2 className="text-2xl font-bold tracking-tight mb-4 font-headline">Overview</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {patientOverview.map((item, i) => {
                    const Icon = item.icon;
                    return (
                     <motion.div key={i} variants={itemVariants}>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                                <Icon className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{item.value}</div>
                                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )})}
            </div>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div className="lg:col-span-2" variants={itemVariants}>
                 <h2 className="text-2xl font-bold tracking-tight mb-4 font-headline">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <QuickActionCard href="/patient/appointments" icon={Calendar} title="Book Appointment" description="Schedule your next visit."/>
                    <QuickActionCard href="/patient/records" icon={FileText} title="View Prescriptions" description="Access your medication history."/>
                    <QuickActionCard href="/patient/records" icon={Upload} title="Upload Documents" description="Add new reports or scans."/>
                    <QuickActionCard href="#" icon={MessageSquare} title="Contact Doctor" description="Send a message to your provider."/>
                </div>
            </motion.div>
            <motion.div variants={itemVariants}>
                <h2 className="text-2xl font-bold tracking-tight mb-4 font-headline">Recent Activities</h2>
                <Card>
                    <CardContent className="p-4">
                        <div className="space-y-4">
                            {recentActivities.map((activity) => (
                                <div key={activity.id} className="flex items-start gap-4">
                                    <div className="bg-secondary p-2 rounded-full">
                                        <activity.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-grow">
                                        <p className="font-medium text-sm">{activity.description}</p>
                                        <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    </motion.div>
  );
}


function QuickActionCard({ href, icon: Icon, title, description }: { href: string, icon: React.ElementType, title: string, description: string }) {
  return (
    <Link href={href}>
        <Card className="hover:bg-accent transition-colors h-full">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </CardContent>
        </Card>
    </Link>
  );
}
