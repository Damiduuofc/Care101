"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapse: () => void;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
  setCollapsed: (collapsed: boolean) => void;
  contentMarginClass: string;
}

const defaultContext: SidebarContextType = {
  isCollapsed: false,
  isMobileOpen: false,
  toggleCollapse: () => {},
  toggleMobileOpen: () => {},
  closeMobile: () => {},
  setCollapsed: () => {},
  contentMarginClass: "ml-0 md:ml-64",
};

const SidebarContext = createContext<SidebarContextType>(defaultContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Collapse sidebar by default on medium screens (768px - 1023px, such as 800x1340 tablet portrait)
  // Expand by default on large screens (>= 1024px, such as 1340x800 tablet landscape)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        // Mobile screen: sidebar is drawer-based
        setIsCollapsed(false);
      } else if (width >= 768 && width < 1024) {
        // Tablet portrait (e.g. 800px): default to compact icon-rail (64px) for maximum workspace
        setIsCollapsed(true);
      } else {
        // Tablet landscape / desktop (>= 1024px, e.g. 1340px): default to expanded (256px)
        setIsCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleCollapse = () => setIsCollapsed(prev => !prev);
  const toggleMobileOpen = () => setIsMobileOpen(prev => !prev);
  const closeMobile = () => setIsMobileOpen(false);
  const setCollapsed = (val: boolean) => setIsCollapsed(val);

  // Responsive margin for the main content:
  // - on mobile (< 768px): ml-0 (sidebar is an overlay drawer)
  // - when collapsed on tablet/desktop: ml-0 md:ml-16 (64px icon rail)
  // - when expanded on tablet/desktop: ml-0 md:ml-64 (256px sidebar)
  const contentMarginClass = mounted
    ? isCollapsed
      ? "ml-0 md:ml-16"
      : "ml-0 md:ml-64"
    : "ml-0 md:ml-64";

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        toggleCollapse,
        toggleMobileOpen,
        closeMobile,
        setCollapsed,
        contentMarginClass,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
