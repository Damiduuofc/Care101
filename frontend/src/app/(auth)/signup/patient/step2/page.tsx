"use client";

import { useEffect } from "react"; // Import useEffect
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
import { Phone, Mail, MapPin, ArrowLeft, ChevronRight } from "lucide-react";

const districts = [
    "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", 
    "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", 
    "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", 
    "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
];

const formSchema = z.object({
  mobileNumber: z.string().min(9, { message: "Valid mobile number is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  district: z.string().min(1, { message: "Please select a district." }),
});

export default function PatientSignupStep2() {
  const router = useRouter();

  // Check if Step 1 data exists
  useEffect(() => {
    if (typeof window !== "undefined") {
      const step1 = sessionStorage.getItem("patientStep1");
      if (!step1) router.push("/signup/patient/step1");
    }
  }, [router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        mobileNumber: "",
        email: "",
        district: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    // Save Step 2 data
    if (typeof window !== "undefined") {
      sessionStorage.setItem("patientStep2", JSON.stringify(values));
    }
    // Proceed to Step 3
    router.push("/signup/patient/step3");
  }

  // ... (Return statement remains exactly the same as your code) ...
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg border-cyan-200">
        <div className="w-full h-2 bg-cyan-100">
          <div className="h-full w-2/3 bg-cyan-600 rounded-r-full transition-all duration-500" />
        </div>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-cyan-900">Contact Information</CardTitle>
            <span className="text-sm font-semibold text-blue-600 bg-cyan-50 px-3 py-1 rounded-full">
              Step 2 of 3
            </span>
          </div>
          <CardDescription>How can we get in touch with you?</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="mobileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="+94 77 123 4567" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="you@example.com" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="district"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>District</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="pl-10 relative bg-white border-slate-200">
                          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <SelectValue placeholder="Select your district" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {districts.map((district) => (
                          <SelectItem key={district} value={district}>
                            {district}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-between pt-6">
                 <Link href="/signup/patient/step1">
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
    </div>
  );
}