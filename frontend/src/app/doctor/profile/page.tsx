"use client";
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Lock, LogOut, Edit, Shield } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const profileImage = PlaceHolderImages.find(img => img.id === 'doctor-profile');
  
  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div 
        className="space-y-8 max-w-4xl mx-auto"
        initial="hidden"
        animate="visible"
        variants={sectionVariants}
    >
      <div>
        <h1 className="text-3xl font-bold font-headline">Profile</h1>
        <p className="text-muted-foreground">Manage your personal and account details.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative h-32 w-32 rounded-full overflow-hidden shadow-md">
            {profileImage && (
              <Image
                src={profileImage.imageUrl}
                alt={profileImage.description}
                fill
                style={{ objectFit: 'cover' }}
                data-ai-hint={profileImage.imageHint}
              />
            )}
            <Button size="icon" className="absolute bottom-1 right-1 h-8 w-8 rounded-full">
                <Edit className="h-4 w-4"/>
            </Button>
          </div>
          <div className="text-center md:text-left">
            <CardTitle className="text-3xl">Dr. Benjamin Lee</CardTitle>
            <CardDescription className="mt-1">Orthopedics Specialist</CardDescription>
          </div>
           <Button className="md:ml-auto">
              <Edit className="mr-2 h-4 w-4" /> Edit Profile
          </Button>
        </CardHeader>
        <CardContent className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" defaultValue="Dr. Benjamin Lee" readOnly />
            </div>
             <div className="space-y-2">
              <Label htmlFor="initialsName">Name with Initials</Label>
              <Input id="initialsName" defaultValue="Dr. B. Lee" readOnly />
            </div>
             <div className="space-y-2">
              <Label htmlFor="nic">NIC Number</Label>
              <Input id="nic" defaultValue="198512345678" readOnly />
            </div>
             <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" defaultValue="+94 71 234 5678" readOnly />
            </div>
             <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue="ben.lee@mediserve.hub" readOnly />
            </div>
          </div>

          <Separator className="my-8" />

          <div className="space-y-6">
             <h3 className="text-lg font-semibold flex items-center"><Shield className="mr-2 h-5 w-5 text-primary"/> Account Management</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline">Manage Subscription</Button>
                <Button variant="outline">Change Email</Button>
                <Button variant="outline">Change Password</Button>
             </div>
             
             <Separator className="my-8" />

             <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <p className="text-sm text-muted-foreground">
                    Logged in as <span className="font-medium text-foreground">ben.lee@mediserve.hub</span>
                </p>
                <Button variant="destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
             </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
