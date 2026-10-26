"use client";

export type TimelineSlot = {
    hour: number;
    startLabel: string;
    endLabel: string;
    isAvailable: boolean;
    isPast?: boolean;
};

// end is the last selected hour (inclusive)
export type HourRange = { start: number; end: number } | null;

type Props = {
    slots: TimelineSlot[];
    range: HourRange;
    onChange: (range: HourRange) => void;
};

// Hour-by-hour day view. First click sets the start hour, second click sets the end hour.
// A range can never cross a blocked hour: clicking past one starts a new range instead.
export default function HourTimeline({ slots, range, onChange }: Props) {
    const isBlockedBetween = (a: number, b: number) =>
        slots.some(s => s.hour >= Math.min(a, b) && s.hour <= Math.max(a, b) && !s.isAvailable);

    const handleClick = (slot: TimelineSlot) => {
        if (!slot.isAvailable) return;
        if (!range || range.start !== range.end) {
            onChange({ start: slot.hour, end: slot.hour });
            return;
        }
        if (slot.hour === range.start) return;
        if (isBlockedBetween(range.start, slot.hour)) {
            onChange({ start: slot.hour, end: slot.hour });
            return;
        }
        onChange({ start: Math.min(range.start, slot.hour), end: Math.max(range.start, slot.hour) });
    };

    return (
        <div className="select-none">
            {slots.map((slot, idx) => {
                const selected = !!range && slot.hour >= range.start && slot.hour <= range.end;
                const isFirstSelected = selected && slot.hour === range!.start;
                const blocked = !slot.isAvailable;
                const prevBlocked = idx > 0 && !slots[idx - 1].isAvailable;

                return (
                    <div key={slot.hour} className="flex items-stretch">
                        <span className={`w-16 shrink-0 -mt-2 text-[11px] font-semibold ${blocked ? "text-slate-400" : "text-slate-600"}`}>
                            {slot.startLabel}
                        </span>
                        <button
                            type="button"
                            disabled={blocked}
                            onClick={() => handleClick(slot)}
                            aria-pressed={selected}
                            aria-label={`${slot.startLabel} to ${slot.endLabel}, ${blocked ? "not available" : selected ? "selected session" : "free"}`}
                            className={`flex-1 h-9 border-t px-3 text-left text-xs font-semibold transition-colors ${
                                selected
                                    ? "bg-cyan-600 border-cyan-600 text-white"
                                    : blocked
                                        ? "bg-red-50 border-red-200 border-l-[3px] border-l-red-500 text-red-600 cursor-not-allowed"
                                        : "bg-white border-slate-200 hover:bg-cyan-50 cursor-pointer"
                            }`}
                        >
                            {blocked && !prevBlocked && !selected && (slot.isPast ? "Passed" : "Not available")}
                            {isFirstSelected && "Doctor's session"}
                        </button>
                    </div>
                );
            })}
            {slots.length > 0 && (
                <div className="flex">
                    <span className="w-16 shrink-0 -mt-2 text-[11px] font-semibold text-slate-600">
                        {slots[slots.length - 1].endLabel}
                    </span>
                    <div className="flex-1 border-t border-slate-200" />
                </div>
            )}
        </div>
    );
}
