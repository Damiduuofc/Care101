"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-3",
        caption: "flex justify-center items-center relative h-9",
        caption_label: "inline-flex items-center gap-1 text-sm font-bold text-slate-800",
        caption_dropdowns: "flex items-center gap-1.5",
        // react-day-picker v8 overlays an invisible <select> on top of the caption label
        dropdown: "absolute inset-0 z-10 w-full cursor-pointer appearance-none opacity-0",
        dropdown_month:
          "relative inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 hover:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-500/40",
        dropdown_year:
          "relative inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 hover:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-500/40",
        dropdown_icon: "h-3.5 w-3.5 text-slate-400",
        vhidden: "sr-only",
        nav: "flex items-center",
        nav_button:
          "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-200 disabled:opacity-30 disabled:pointer-events-none",
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse",
        head_row: "flex",
        head_cell:
          "w-10 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400",
        row: "flex w-full mt-1",
        cell: "h-10 w-10 p-0 text-center text-sm relative focus-within:z-20",
        day: "inline-flex h-10 w-10 items-center justify-center rounded-xl text-sm font-medium text-slate-700 transition-colors hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 aria-selected:opacity-100",
        day_range_end: "day-range-end",
        day_selected:
          "!bg-cyan-600 !text-white font-bold shadow-sm shadow-cyan-600/30 hover:!bg-cyan-700",
        day_today: "text-cyan-700 font-bold ring-1 ring-inset ring-cyan-300",
        day_outside: "day-outside !text-slate-300",
        day_disabled: "!text-slate-300 line-through decoration-slate-200 pointer-events-none",
        day_range_middle: "aria-selected:bg-cyan-50 aria-selected:text-cyan-800",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
