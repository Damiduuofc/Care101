"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { IdCard, Mail, Phone, Lock, Eye, EyeOff, ArrowLeft, Check, Upload, Loader2 } from "lucide-react";

// Define the schema
const formSchema = z.object({
  nicNumber: z.string().min(1, { message: "NIC number is required." }),
  slmcCertificate: z.any().optional(),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(9, { message: "Valid phone number is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

export default function DoctorSignupStep2() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step1Data, setStep1Data] = useState<any>(null);

  // 1. Retrieve Step 1 Data on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedData = sessionStorage.getItem("signupStep1");
      if (savedData) {
        setStep1Data(JSON.parse(savedData));
      } else {
        // If no data, force back to Step 1
        router.push("/signup/doctor/step1");
      }
    }
  }, [router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        nicNumber: "",
        email: "",
        phoneNumber: "",
        password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!step1Data) return;
    setIsSubmitting(true);

    // 2. Prepare the payload for the Backend
    // Backend Expects: name, email, password, specialization, nic, phone, slmcReg, nameWithInitials
    const payload = {
        name: step1Data.fullName,
        nameWithInitials: step1Data.nameWithInitials,
        slmcReg: step1Data.slmcRegistrationNumber,
        specialization: step1Data.specialization,
        nic: values.nicNumber,
        phone: values.phoneNumber,
        email: values.email,
        password: values.password,
        // Note: We are not sending the image file yet as backend requires multipart/form-data setup
    };

    try {
        // 3. Call the API
        const response = await fetch("http://localhost:5000/api/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.msg || "Registration failed");
        }

        console.log("Success:", data);
        // Clear temp storage
        sessionStorage.removeItem("signupStep1");
        
        // Redirect to Dashboard
router.push('/doctor');

    } catch (error: any) {
        console.error("Signup Error:", error);
        alert(error.message); // Replace with a Toast component in production
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg border-slate-200">
        
        <div className="w-full h-2 bg-slate-100">
          <div className="h-full w-full bg-cyan-600 rounded-r-full transition-all duration-500" />
        </div>

        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-slate-900">Account Details</CardTitle>
            <span className="text-sm font-semibold text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full">
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
                          className="pl-10 pt-2 cursor-pointer file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100"
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
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-cyan-600 focus:outline-none"
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

              <div className="flex justify-between pt-6">
                 <Link href="/signup/doctor/step1">
                    <Button type="button" variant="ghost" className="text-cyan-600 hover:text-cyan-900">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[140px]"
                >
                  {isSubmitting ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Please wait
                    </>
                  ) : (
                    <>
                        <Check className="mr-2 h-4 w-4" /> Complete
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}