"use client";

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { allDoctors, departments } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, MapPin, Star, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DoctorsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');

  // Filter Logic
  const filteredDoctors = useMemo(() => {
    return allDoctors.filter(doctor => {
      const matchesSearch = doctor.name.toLowerCase().includes(searchTerm.toLowerCase());
      // Handle cases where doctor.specialty might not exactly match dept names in data
      const matchesSpecialty = specialtyFilter === 'all' || 
                               doctor.specialty.includes(specialtyFilter) || 
                               (doctor.department && doctor.department === specialtyFilter);
      return matchesSearch && matchesSpecialty;
    });
  }, [searchTerm, specialtyFilter]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      
      {/* ================= HERO SECTION ================= */}
      <section className="relative h-[40vh] min-h-[300px] bg-slate-900 flex flex-col justify-center items-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/doctors-hero.jpg" // Ensure this exists, or use hero-bg.jpg
            alt="Medical Team"
            fill
            className="object-cover opacity-40"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent" />
        </div>
        
        <div className="relative container px-6 text-center z-10 -mt-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Find Your <span className="text-cyan-600">Specialist</span>
            </h1>
            <p className="text-slate-600 text-lg max-w-xl mx-auto">
              Book appointments with the best doctors and specialists in your area.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ================= SEARCH & FILTER BAR ================= */}
      <div className="container px-6 mx-auto -mt-16 relative z-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 shadow-xl border-0 bg-white/90 backdrop-blur-md rounded-2xl">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              
              {/* Search Input */}
              <div className="relative flex-grow w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search by doctor's name..."
                  className="pl-12 h-12 text-base border-slate-200 focus-visible:ring-cyan-500 rounded-xl bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Divider (Desktop only) */}
              <div className="hidden md:block w-px h-8 bg-slate-200" />

              {/* Specialty Select */}
              <div className="w-full md:w-[300px]">
                <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
                  <SelectTrigger className="h-12 border-slate-200 focus:ring-cyan-500 rounded-xl bg-white">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Filter className="w-4 h-4" />
                      <SelectValue placeholder="Filter by specialty" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Specialties</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.slug} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full md:w-auto h-12 px-8 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold shadow-lg shadow-cyan-200">
                Search
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* ================= DOCTORS GRID ================= */}
      <section className="py-20">
        <div className="container px-6 mx-auto">
          
          {filteredDoctors.length > 0 ? (
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {filteredDoctors.map((doctor, index) => (
                <motion.div key={doctor.id} variants={itemVariants}>
                  <Card className="h-full border-0 shadow-md hover:shadow-2xl transition-all duration-300 group overflow-hidden rounded-3xl bg-white flex flex-col">
                    
                    {/* Image Area */}
                    <div className="relative h-64 w-full bg-slate-100 overflow-hidden">
                      {/* Using local images cyclically based on index */}
                      <Image
                        src={`/images/doctor-${(index % 4) + 1}.jpg`} 
                        alt={doctor.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      
                      {/* Overlay Badge */}
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-xs font-bold px-3 py-1 rounded-full text-cyan-700 shadow-sm">
                        Available Today
                      </div>
                    </div>

                    <CardContent className="p-6 flex-grow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-cyan-600 text-sm font-bold tracking-wide uppercase mb-1">
                            {doctor.specialty}
                          </p>
                          <h3 className="text-xl font-bold text-slate-900 leading-tight">
                            {doctor.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-md">
                           <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                           <span className="text-xs font-bold text-yellow-700">4.9</span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-500 mb-4 line-clamp-2">
                        {doctor.qualifications}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-6">
                        <MapPin className="w-3 h-3" />
                        <span>Main Building, Floor 3</span>
                      </div>
                    </CardContent>

                    <CardFooter className="p-6 pt-0 mt-auto">
                      <Link href={`/appointments?doctor=${doctor.id}`} className="w-full">
                        <Button className="w-full bg-slate-50 text-slate-900 hover:bg-cyan-500 hover:text-white border border-slate-200 transition-all font-semibold h-11 rounded-xl group-hover:shadow-lg shadow-cyan-200">
                          <Calendar className="w-4 h-4 mr-2" /> Book Visit
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100"
            >
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">No doctors found</h3>
              <p className="text-slate-500">
                We couldn't find any specialists matching "{searchTerm}". <br />
                Try adjusting your filters or search for a general department.
              </p>
              <Button 
                variant="outline" 
                className="mt-6"
                onClick={() => { setSearchTerm(''); setSpecialtyFilter('all'); }}
              >
                Clear Filters
              </Button>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}