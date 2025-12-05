
"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, Clock, Hospital, Stethoscope, PlusCircle, CalendarDays, User, List } from 'lucide-react';
import { appointments } from '@/lib/patient-data';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { departments, allDoctors } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export default function AppointmentsPage() {
    const sectionVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
    };

    return (
        <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
        >
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Appointments</h1>
                    <p className="text-muted-foreground">Manage your upcoming and past appointments.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <Tabs defaultValue="upcoming">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                            <TabsTrigger value="completed">Completed</TabsTrigger>
                            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
                        </TabsList>
                        <TabsContent value="upcoming">
                            <AppointmentList status="Upcoming" />
                        </TabsContent>
                        <TabsContent value="completed">
                            <AppointmentList status="Completed" />
                        </TabsContent>
                        <TabsContent value="cancelled">
                            <AppointmentList status="Cancelled" />
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="space-y-6">
                    <BookingForm />
                </div>
            </div>
        </motion.div>
    );
}

function AppointmentList({ status }: { status: 'Upcoming' | 'Completed' | 'Cancelled' }) {
    const filteredAppointments = appointments.filter(a => a.status === status);
    
    const statusColors = {
        Upcoming: 'bg-blue-100 text-blue-800',
        Completed: 'bg-green-100 text-green-800',
        Cancelled: 'bg-red-100 text-red-800',
    };

    return (
        <div className="space-y-4 mt-4">
            {filteredAppointments.length > 0 ? (
                filteredAppointments.map(app => (
                    <Card key={app.id}>
                        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
                            <div className="flex-grow space-y-3">
                                <div className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    <p className="font-bold text-lg">{app.doctorName}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Stethoscope className="h-4 w-4" />
                                    <p>{app.specialty}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Hospital className="h-4 w-4" />
                                    <p>{app.hospital}</p>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    <p>{app.date}</p>
                                    <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                                    <p>{app.time}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-start md:items-end justify-between gap-2">
                                <Badge className={cn("text-xs", statusColors[status])}>{app.status}</Badge>
                                <div className="flex gap-2">
                                    {status === 'Upcoming' && (
                                        <>
                                            <Button variant="outline" size="sm">Reschedule</Button>
                                            <Button variant="destructive" size="sm">Cancel</Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <p className="text-muted-foreground text-center py-8">No {status.toLowerCase()} appointments.</p>
            )}
        </div>
    );
}

function BookingForm() {
    const [date, setDate] = useState<Date>();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><PlusCircle className="h-6 w-6 text-primary"/> Book New Appointment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <label>Department</label>
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a department" />
                        </SelectTrigger>
                        <SelectContent>
                            {departments.map(d => <SelectItem key={d.slug} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label>Doctor</label>
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a doctor" />
                        </SelectTrigger>
                        <SelectContent>
                           {allDoctors.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <label>Visit Type</label>
                    <Select>
                        <SelectTrigger>
                            <SelectValue placeholder="Select visit type" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="channeling">Channeling</SelectItem>
                           <SelectItem value="surgery">Surgery Consultation</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <label>Date</label>
                     <Popover>
                      <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !date && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={setDate}
                          initialFocus
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                </div>
                 <div className="space-y-2">
                    <label>Reason for Visit</label>
                    <Textarea placeholder="Briefly describe your reason for the visit..."/>
                 </div>
                <Button className="w-full">Book Appointment</Button>
            </CardContent>
        </Card>
    )
}
