
"use client";
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, Lock, LogOut, Edit, Shield, QrCode, Heart, PlusCircle } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';

export default function ProfilePage() {
  const profileImage = PlaceHolderImages.find(img => img.id === 'patient-profile');
  
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
        <h1 className="text-3xl font-bold font-headline">My Profile</h1>
        <p className="text-muted-foreground">Manage your personal, medical, and account details.</p>
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
            <CardTitle className="text-3xl">Jane Doe</CardTitle>
            <CardDescription className="mt-1">NIC: 199012345678</CardDescription>
            <div className='mt-2 flex items-center gap-2 justify-center md:justify-start'>
                <Mail className="h-4 w-4 text-muted-foreground"/>
                <span className='text-sm'>jane.doe@example.com</span>
            </div>
            <div className='mt-1 flex items-center gap-2 justify-center md:justify-start'>
                <Phone className="h-4 w-4 text-muted-foreground"/>
                <span className='text-sm'>+94 77 123 4567</span>
            </div>
          </div>
           <Button variant="outline" className="md:ml-auto">
              <QrCode className="mr-2 h-4 w-4" /> Show QR ID
          </Button>
        </CardHeader>
      </Card>

        <Card>
            <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>These details can be edited.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" defaultValue="Jane Doe" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input id="dob" defaultValue="1990-05-15" type="date" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gender">Gender</Label>
                        <Input id="gender" defaultValue="Female" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="emergencyContact">Emergency Contact</Label>
                        <Input id="emergencyContact" defaultValue="+94 71 876 5432" />
                    </div>
                </div>
                 <div className="flex justify-end mt-6">
                    <Button>Save Changes</Button>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Medical Details</CardTitle>
                <CardDescription>Your health conditions and allergies.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="conditions">Medical Conditions</Label>
                        <Textarea id="conditions" placeholder='e.g., Asthma, Diabetes' defaultValue="Mild Asthma" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="allergies">Allergies</Label>
                        <Textarea id="allergies" placeholder='e.g., Penicillin, Peanuts' defaultValue="Peanuts" />
                    </div>
                </div>
                 <div className="flex justify-end mt-6">
                    <Button>Save Medical Details</Button>
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>Insurance Details</CardTitle>
            </CardHeader>
             <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="provider">Provider</Label>
                        <Input id="provider" defaultValue="FairHealth Plus" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="policy">Policy Number</Label>
                        <Input id="policy" defaultValue="FH-8373-2982" />
                    </div>
                </div>
                 <div className="flex justify-end mt-6">
                    <Button>Update Insurance</Button>
                </div>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><Shield className="mr-2 h-5 w-5 text-primary"/> Account Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline">Manage Subscription</Button>
                <Button variant="outline">Change Email</Button>
                <Button variant="outline">Change Password</Button>
             </div>
             
             <Separator className="my-8" />

             <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <Button variant="destructive">
                    <LogOut className="mr-2 h-4 w-4" /> Logout
                </Button>
                <Button variant="destructive" className="bg-red-800 hover:bg-red-900">
                    Delete Account
                </Button>
             </div>
          </CardContent>
      </Card>
    </motion.div>
  );
}
