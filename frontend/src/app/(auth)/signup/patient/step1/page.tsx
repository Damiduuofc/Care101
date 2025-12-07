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
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, User, CreditCard, ArrowLeft, ChevronRight } from "lucide-react";
import DatePicker from "react-datepicker";
import  Header  from "@/components/layout/Header";
import  Footer  from "@/components/layout/Footer";

const formSchema = z.object({
  fullName: z.string().min(2, { message: "Full name is required." }),
  dateOfBirth: z.date({ required_error: "A date of birth is required." }).nullable(),
  gender: z.string().min(1, { message: "Please select a gender." }),
  nicNumber: z.string().min(5, { message: "Valid NIC number is required." }),
});

export default function PatientSignupStep1() {
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      dateOfBirth: null,
      gender: "",
      nicNumber: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // 1. Save data to Session Storage
    if (typeof window !== "undefined") {
      sessionStorage.setItem("patientStep1", JSON.stringify(values));
    }
    // 2. Move to Step 2
    router.push("/signup/patient/step2");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Header />
      <Card className="w-full max-w-lg shadow-lg border-slate-200">
        <div className="w-full h-2 bg-slate-100">
          <div className="h-full w-1/3 bg-cyan-600 rounded-r-full" />
        </div>

        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-slate-900">Personal Details</CardTitle>
            <span className="text-sm font-semibold text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full">
              Step 1 of 3
            </span>
          </div>
          <CardDescription>
            Let's start with your basic personal information.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="Jane Doe" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 z-10" />
                        <DatePicker
                          selected={field.value ?? null}
                          onChange={(date: Date | null) => field.onChange(date)}
                          dateFormat="yyyy-MM-dd"
                          placeholderText="Pick a date"
                          maxDate={new Date()}
                          showYearDropdown
                          showMonthDropdown
                          dropdownMode="select"
                          className={cn(
                            "w-full h-10 pl-10 rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500",
                            !field.value && "text-muted-foreground"
                          )}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white border-slate-200">
                          <SelectValue placeholder="Select your gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nicNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>National ID (NIC)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="e.g. 199512345678" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between pt-6">
                <Link href="/">
                  <Button type="button" variant="ghost" className="text-cyan-600 hover:text-cyan-900">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                </Link>
                <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[120px]">
                  Next Step <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

            </form>
          </Form>
        </CardContent>
      </Card>
   <Footer />
    </div>
  );
}