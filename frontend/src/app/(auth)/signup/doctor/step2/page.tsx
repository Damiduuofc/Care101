"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { IdCard, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Check, Upload } from "lucide-react";

const formSchema = z.object({
  nicNumber: z.string().min(1, { message: "NIC number is required." }),
  slmcCertificate: z.any().optional(), // In a real app, use z.instanceof(FileList) and validate
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(9, { message: "Valid phone number is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

export default function DoctorSignupStep2() {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        nicNumber: "",
        email: "",
        phoneNumber: "",
        password: "",
        // File inputs are uncontrolled in react-hook-form usually, so no default value needed here
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log("Step 2 Data:", values);
    // Will create account, backend logic will be handled later
    // Example: router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg border-slate-200">
        
        {/* Progress Bar (Full for Step 2) */}
        <div className="w-full h-2 bg-slate-100">
          <div className="h-full w-full bg-emerald-600 rounded-r-full transition-all duration-500" />
        </div>

        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-slate-900">Account Details</CardTitle>
            <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
              Step 2 of 2
            </span>
          </div>
          <CardDescription>
            Secure your account with contact information and a strong password.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              
              {/* NIC Number */}
              <FormField
                control={form.control}
                name="nicNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>National ID (NIC)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="e.g. 199012345678" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* SLMC Certificate Upload */}
              <FormField
                control={form.control}
                name="slmcCertificate"
                render={({ field: { value, onChange, ...fieldProps } }) => (
                  <FormItem>
                    <FormLabel>SLMC Certificate Photo</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Upload className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input 
                          {...fieldProps}
                          type="file"
                          accept="image/*"
                          className="pl-10 pt-2 cursor-pointer file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          onChange={(event) => {
                            onChange(event.target.files && event.target.files[0]);
                          }}
                        />
                      </div>
                    </FormControl>
                    <p className="text-xs text-slate-500">Upload a clear photo of your medical council certificate.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="doctor@hospital.com" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone Number */}
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
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

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          className="pl-10 pr-10" 
                          {...field} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex justify-between pt-6">
                 <Link href="/signup/doctor/step1">
                    <Button type="button" variant="ghost" className="text-slate-600 hover:text-slate-900">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                </Link>
                <Button 
                  type="submit" 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
                >
                  <Check className="mr-2 h-4 w-4" /> Complete
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}