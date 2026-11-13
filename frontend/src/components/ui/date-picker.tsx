"use client"

import * as React from "react"
import { format, parse, isValid, startOfDay } from "date-fns"
import { CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** Parse a "yyyy-MM-dd" string into a local Date (no UTC shift). */
function parseKey(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, "yyyy-MM-dd", new Date())
  return isValid(d) ? d : undefined
}

const toKey = (d: Date) => format(d, "yyyy-MM-dd")

export interface DatePickerProps {
  /** Selected date as "yyyy-MM-dd" (same format as <input type="date">). */
  value?: string
  onChange: (value: string) => void
  /** Earliest selectable date, "yyyy-MM-dd". */
  min?: string
  /** Latest selectable date, "yyyy-MM-dd". */
  max?: string
  placeholder?: string
  /** Show month/year dropdowns (useful for date of birth). */
  withYearPicker?: boolean
  /** Show a clear (x) button when a value is set. */
  clearable?: boolean
  /** Show a "Today" shortcut in the footer. */
  showToday?: boolean
  /** Text format shown on the trigger. */
  displayFormat?: string
  className?: string
  /** "field" = full-width form input; "ghost" = borderless inline trigger. */
  variant?: "field" | "ghost"
  align?: "start" | "center" | "end"
  id?: string
  "aria-label"?: string
}

export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select a date",
  withYearPicker = false,
  clearable = false,
  showToday = true,
  displayFormat = "EEE, d MMM yyyy",
  className,
  variant = "field",
  align = "start",
  id,
  "aria-label": ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseKey(value)
  const minDate = parseKey(min)
  const maxDate = parseKey(max)
  const [month, setMonth] = React.useState<Date>(selected ?? maxDate ?? new Date())

  // Jump the visible month to the selected date whenever the popover opens.
  React.useEffect(() => {
    if (open) setMonth(selected ?? (maxDate && maxDate < new Date() ? maxDate : new Date()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ]

  const today = startOfDay(new Date())
  const todayAllowed =
    (!minDate || today >= startOfDay(minDate)) && (!maxDate || today <= startOfDay(maxDate))

  const thisYear = new Date().getFullYear()
  const fromYear = minDate?.getFullYear() ?? thisYear - 110
  const toYear = maxDate?.getFullYear() ?? thisYear + 5

  return (
    // modal: keeps the calendar clickable/focusable when used inside a Dialog
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          className={cn(
            "group inline-flex items-center gap-2 text-left text-sm transition-colors focus:outline-none",
            variant === "field" &&
              "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 hover:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-500 data-[state=open]:border-cyan-500 data-[state=open]:ring-2 data-[state=open]:ring-cyan-500/30",
            variant === "ghost" &&
              "rounded-lg px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-cyan-500",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-cyan-600" />
          <span className={cn("flex-1 truncate", !selected && "text-slate-400 font-normal")}>
            {selected ? format(selected, displayFormat) : placeholder}
          </span>
          {clearable && selected && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              onClick={(e) => {
                e.stopPropagation()
                onChange("")
              }}
              className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="z-[100] w-auto rounded-2xl border-slate-200 p-0 shadow-xl shadow-slate-900/10"
      >
        <Calendar
          mode="single"
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          onSelect={(d) => {
            if (!d) return
            onChange(toKey(d))
            setOpen(false)
          }}
          disabled={disabled}
          fromDate={minDate}
          toDate={maxDate}
          {...(withYearPicker
            ? { captionLayout: "dropdown-buttons" as const, fromYear, toYear }
            : {})}
          initialFocus
        />
        {showToday && (
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              disabled={!todayAllowed}
              onClick={() => {
                onChange(toKey(today))
                setOpen(false)
              }}
              className="rounded-lg px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
