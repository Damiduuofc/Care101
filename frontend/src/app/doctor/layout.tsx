"use client";
import { useState } from 'react';
import DoctorSidebar from "@/components/layout/DoctorSidebar";
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export default function DoctorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-secondary">
      {/* Mobile Sidebar */}
      <div className="md:hidden">
         <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 bg-background">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
                <DoctorSidebar onLinkClick={() => setIsSidebarOpen(false)} />
            </SheetContent>
        </Sheet>
      </div>
      
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <DoctorSidebar />
      </div>
      
      <main className="flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 overflow-y-auto">
         <div className="md:hidden h-12"></div> {/* Spacer for mobile header */}
        {children}
      </main>
    </div>
  );
}
