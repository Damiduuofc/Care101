"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { departments } from "@/lib/data";
import { User, FileBadge, Stethoscope, ChevronRight, ArrowLeft } from "lucide-react";

const formSchema = z.object({
  fullName: z.string().min(2, { message: "Full name is required." }),
  nameWithInitials: z.string().min(2, { message: "Name with initials is required." }),
  slmcRegistrationNumber: z.string().min(3, { message: "Valid SLMC number is required." }),
  specialization: z.string().min(1, { message: "Please select a specialization." }),
});

export default function DoctorSignupStep1() {
  const router = useRouter();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        fullName: "",
        nameWithInitials: "",
        slmcRegistrationNumber: "",
        specialization: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Step 1 Data:", values);
    // In a real app, you would save this to state/context/localstorage here
    router.push("/signup/doctor/step2");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg border-slate-200">
        
        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100">
          <div className="h-full w-1/2 bg-emerald-600 rounded-r-full" />
        </div>

        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-slate-900">Professional Details</CardTitle>
            <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              Step 1 of 2
            </span>
          </div>
          <CardDescription>
            Please provide your official identification details for verification.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              
              {/* Full Name */}
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="Dr. Johnathan Doe" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Name with Initials */}
              <FormField
                control={form.control}
                name="nameWithInitials"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name with Initials</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="Dr. J. A. Doe" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SLMC Number */}
              <FormField
                control={form.control}
                name="slmcRegistrationNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SLMC Registration Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <FileBadge className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="e.g. 12345" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Specialization */}
              <FormField
                control={form.control}
                name="specialization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialization</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="pl-10 relative">
                          <Stethoscope className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <SelectValue placeholder="Select your field" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.slug || dept.name} value={dept.name}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Buttons */}
              <div className="flex justify-between pt-6">
                <Link href="/signup">
                  <Button type="button" variant="ghost" className="text-slate-600 hover:text-slate-900">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </Link>
                
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                >
                  Next Step <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}