"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Stethoscope } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      
      {/* Simple Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-900">Create your account</h1>
        <p className="text-slate-500 mt-2">Choose the account type that best describes you.</p>
      </div>

      {/* Selection Grid */}
      <div className="grid md:grid-cols-2 gap-6 max-w-3xl w-full">
        
        {/* Option 1: Patient */}
        <Link href="/signup/patient/step1" className="group w-full">
          <Card className="h-full border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all duration-200 cursor-pointer">
            <CardHeader className="text-center pt-10">
              <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                <User className="h-10 w-10" />
              </div>
              <CardTitle className="text-xl">I am a Patient</CardTitle>
              <CardDescription className="text-slate-500">
                Book appointments, access lab reports, and manage your family's health.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-10 px-8 mt-auto">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                Join as Patient
              </Button>
            </CardContent>
          </Card>
        </Link>

        {/* Option 2: Doctor */}
        <Link href="/signup/doctor/step1" className="group w-full">
          <Card className="h-full border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 cursor-pointer">
            <CardHeader className="text-center pt-10">
              <div className="mx-auto w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                <Stethoscope className="h-10 w-10" />
              </div>
              <CardTitle className="text-xl">I am a Doctor</CardTitle>
              <CardDescription className="text-slate-500">
                Manage your schedule, view patient records, and streamline your practice.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-10 px-8 mt-auto">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                Join as Doctor
              </Button>
            </CardContent>
          </Card>
        </Link>

      </div>

      {/* Footer */}
      <p className="mt-12 text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-slate-900 font-semibold hover:underline">
          Log in
        </Link>
      </p>

    </div>
  );
}