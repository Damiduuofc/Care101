"use client";
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Stethoscope, BookText, FilePlus, HandCoins, Activity } from 'lucide-react';
import { overviewStats, recentActivities } from '@/lib/doctor-data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { motion } from 'framer-motion';

export default function DoctorHomePage() {
  const bannerImage = PlaceHolderImages.find(img => img.id === 'doctor-dashboard-banner');
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <div className="space-y-8">
      <motion.div
        className="relative w-full h-64 rounded-xl overflow-hidden shadow-lg"
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        {bannerImage && (
            <Image
                src={bannerImage.imageUrl}
                alt={bannerImage.description}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint={bannerImage.imageHint}
                className="opacity-90"
            />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent p-8 flex flex-col justify-end">
            <h1 className="text-3xl font-bold text-white font-headline">Welcome back, Dr. Lee!</h1>
            <p className="text-white/90">Here is your summary for today.</p>
        </div>
      </motion.div>

      <motion.div
         variants={sectionVariants}
         initial="hidden"
         animate="visible"
         transition={{ delay: 0.2 }}
      >
        <h2 className="text-2xl font-bold tracking-tight mb-4 font-headline">Overview</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payable Income</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.totalPayableIncome}</div>
              <p className="text-xs text-muted-foreground">After 5% service fee deduction</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Channeling Sessions</CardTitle>
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.channelingSessions}</div>
               <p className="text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Surgery Records</CardTitle>
              <BookText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overviewStats.surgeryRecords}</div>
               <p className="text-xs text-muted-foreground">Total surgeries logged</p>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-2xl font-bold tracking-tight mb-4 font-headline">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/doctor/finance">
                <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                        <HandCoins className="h-10 w-10 text-primary mb-2" />
                        <h3 className="font-semibold">Finance Management</h3>
                        <p className="text-sm text-muted-foreground">Manage hospital income and payments.</p>
                    </CardContent>
                </Card>
            </Link>
            <Link href="/doctor/records">
                <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                        <BookText className="h-10 w-10 text-primary mb-2" />
                        <h3 className="font-semibold">Surgery Records</h3>
                        <p className="text-sm text-muted-foreground">Access and update patient surgery details.</p>
                    </CardContent>
                </Card>
            </Link>
             <Link href="/doctor/instructions">
                <Card className="hover:bg-accent hover:text-accent-foreground transition-colors">
                    <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                        <FilePlus className="h-10 w-10 text-primary mb-2" />
                        <h3 className="font-semibold">Surgery Instructions</h3>
                        <p className="text-sm text-muted-foreground">Create and manage patient instructions.</p>
                    </CardContent>
                </Card>
            </Link>
        </div>
      </motion.div>

       <motion.div
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-2xl font-bold tracking-tight mb-4 font-headline">Recent Activities</h2>
         <Card>
            <CardContent className="p-6">
                 <div className="space-y-4">
                    {recentActivities.map((activity) => (
                        <div key={activity.id} className="flex items-center gap-4">
                            <div className="bg-secondary p-2 rounded-full">
                                <Activity className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-grow">
                                <p className="font-medium">{activity.description}</p>
                                <p className="text-sm text-muted-foreground">{activity.timestamp}</p>
                            </div>
                        </div>
                    ))}
                 </div>
            </CardContent>
        </Card>
       </motion.div>
    </div>
  );
}
