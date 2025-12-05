"use client";
import { patientRecords } from '@/lib/doctor-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { motion } from 'framer-motion';

export default function RecordsPage() {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.5,
        },
    }),
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Patient Records</h1>
        <p className="text-muted-foreground">Search and view patient surgery information.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input placeholder="Search by patient name or NIC..." className="pl-10 max-w-sm" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {patientRecords.map((patient, index) => {
          const cardPhoto = PlaceHolderImages.find(p => p.id === patient.cardPhotoId);
          return (
            <motion.div
                key={patient.id}
                custom={index}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
            >
                <Card className="overflow-hidden h-full flex flex-col">
                <div className="relative h-48 w-full">
                    {cardPhoto && (
                    <Image
                        src={cardPhoto.imageUrl}
                        alt={cardPhoto.description}
                        fill
                        style={{ objectFit: 'cover' }}
                        data-ai-hint={cardPhoto.imageHint}
                    />
                    )}
                </div>
                <CardHeader>
                    <CardTitle>{patient.name}</CardTitle>
                    <CardDescription>NIC: {patient.nic}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                    <div className="space-y-2 text-sm">
                    <p><strong>Hospital:</strong> {patient.hospital}</p>
                    <p><strong>Surgery:</strong> {patient.surgery}</p>
                    </div>
                </CardContent>
                </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
