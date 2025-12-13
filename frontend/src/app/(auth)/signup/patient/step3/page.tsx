"use client";

import { useState, useEffect } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User, Lock, Eye, EyeOff, Check, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

const formSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export default function PatientSignupStep3() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step1Data, setStep1Data] = useState<any>(null);
  const [step2Data, setStep2Data] = useState<any>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        username: "",
        password: "",
        confirmPassword: "",
    },
  });

  // Load data after mount
  useEffect(() => {
    setIsMounted(true);
    
    if (typeof window !== "undefined") {
      const s1 = sessionStorage.getItem("patientStep1");
      const s2 = sessionStorage.getItem("patientStep2");
      
      // Don't redirect immediately - let component mount first
      if (!s1 || !s2) {
        console.warn("Missing step data, will redirect");
        setTimeout(() => {
          if (!s1) router.push("/signup/patient/step1");
          else if (!s2) router.push("/signup/patient/step2");
        }, 100);
        return;
      }
      
      try {
        setStep1Data(JSON.parse(s1));
        setStep2Data(JSON.parse(s2));
      } catch (err) {
        console.error("Failed to parse session data:", err);
        router.push("/signup/patient/step1");
      }
    }
  }, [router]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    setError(null);
    
    const payload = {
      ...step1Data, 
      ...step2Data,
      username: values.username,
      password: values.password,
    };

    console.log("Submitting Payload:", payload);

    try {
      const response = await fetch("http://localhost:5000/api/auth/register-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.msg || "Registration failed");

      sessionStorage.clear();
      router.push("/login"); 

    } catch (err: any) {
      console.error("Registration Error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Show loading state while mounting
  if (!isMounted) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Header />
      
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <Card className="w-full max-w-lg shadow-lg border-slate-200">
          
          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-100">
            <div className="h-full w-full bg-cyan-600 transition-all duration-500" />
          </div>

          <CardHeader className="space-y-1 pb-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">Security</CardTitle>
              <span className="text-sm font-semibold text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full">
                Step 3 of 3
              </span>
            </div>
            <CardDescription className="text-slate-500">
              Finally, create your username and password to secure your account.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Error Alert */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center gap-2 text-sm mb-6">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                
                {/* Username */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                          <Input 
                            placeholder="jane.doe" 
                            className="pl-10 h-10 bg-white border-slate-200 focus-visible:ring-cyan-500" 
                            {...field} 
                          />
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
                      <FormLabel className="text-slate-700">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            className="pl-10 pr-10 h-10 bg-white border-slate-200 focus-visible:ring-cyan-500" 
                            {...field} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Confirm Password */}
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-700">Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                          <Input 
                            type={showConfirmPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            className="pl-10 pr-10 h-10 bg-white border-slate-200 focus-visible:ring-cyan-500" 
                            {...field} 
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                          >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                  <Link href="/signup/patient/step2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      disabled={isSubmitting}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                  </Link>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white min-w-[140px] h-10 shadow-md shadow-cyan-200"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Complete
                      </>
                    )}
                  </Button>
                </div>

              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}