"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Loader2, 
  ArrowRight, 
  CheckCircle2 
} from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      console.log(values);
      setIsLoading(false);
    }, 2000);
  }

  return (
    <div className="w-full min-h-screen grid lg:grid-cols-2">
      
      {/* ================= LEFT: FORM SECTION ================= */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md space-y-8">
          
          {/* Header */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="text-slate-500 mt-2">
              Enter your credentials to access your patient portal.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Email Field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700">Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <Input 
                          placeholder="name@example.com" 
                          className="pl-10 h-11 bg-slate-50 border-slate-200 focus-visible:ring-cyan-500" 
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password Field */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-slate-700">Password</FormLabel>
                      <Link 
                        href="/forgot-password" 
                        className="text-sm font-medium text-cyan-600 hover:text-cyan-500 hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <Input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••" 
                          className="pl-10 pr-10 h-11 bg-slate-50 border-slate-200 focus-visible:ring-cyan-500" 
                          {...field} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
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

              <Button 
                type="submit" 
                className="w-full h-11 bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-200 transition-all"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </Form>



          <p className="text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-cyan-600 hover:text-cyan-500 hover:underline">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>

      {/* ================= RIGHT: IMAGE SECTION ================= */}
      <div className="hidden lg:block relative bg-slate-900 h-full">
        <div className="absolute inset-0">
          <Image
            src="/images/login-bg.jpg" // Ensure this exists
            alt="Medical Professional"
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
        </div>
        
        <div className="relative h-full flex flex-col justify-end p-12 text-white">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium mb-6 backdrop-blur-md">
              <CheckCircle2 className="w-4 h-4" /> Trusted Healthcare
            </div>
            <h2 className="text-4xl font-bold mb-4">Manage your health with confidence.</h2>
            <p className="text-slate-300 text-lg max-w-md">
              Access your medical records, book appointments, and communicate with your doctors securely from one place.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="w-12 h-1 bg-cyan-500 rounded-full" />
            <div className="w-2 h-1 bg-slate-600 rounded-full" />
            <div className="w-2 h-1 bg-slate-600 rounded-full" />
          </div>
        </div>
      </div>

    </div>
  );
}