import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export type TimelineSlot = {
  hour: number;
  startLabel: string;
  endLabel: string;
  isAvailable: boolean;
  isPast?: boolean;
};

export type HourRange = { start: number; end: number } | null; // end is the last selected hour (inclusive)

type Props = {
  slots: TimelineSlot[];
  range: HourRange;
  onChange: (range: HourRange) => void;
};

const CYAN = '#06B6D4';

// Hour-by-hour day view. First tap sets the start hour, second tap sets the end hour.
// A range can never cross a blocked hour: tapping past one starts a new range instead.
export default function HourTimeline({ slots, range, onChange }: Props) {
  const isBlockedBetween = (a: number, b: number) =>
    slots.some(s => s.hour >= Math.min(a, b) && s.hour <= Math.max(a, b) && !s.isAvailable);

  const handlePress = (slot: TimelineSlot) => {
    if (!slot.isAvailable) return;

    // No range yet, or a full range already chosen → start over at this hour
    if (!range || range.start !== range.end) {
      onChange({ start: slot.hour, end: slot.hour });
      return;
    }
    // Same hour tapped again → keep one-hour session
    if (slot.hour === range.start) return;

    if (isBlockedBetween(range.start, slot.hour)) {
      onChange({ start: slot.hour, end: slot.hour });
      return;
    }
    onChange({ start: Math.min(range.start, slot.hour), end: Math.max(range.start, slot.hour) });
  };

  return (
    <View style={styles.wrap}>
      {slots.map((slot, idx) => {
        const selected = !!range && slot.hour >= range.start && slot.hour <= range.end;
        const isFirstSelected = selected && slot.hour === range!.start;
        const blocked = !slot.isAvailable;
        const prevBlocked = idx > 0 && !slots[idx - 1].isAvailable;

        return (
          <View key={slot.hour} style={styles.row}>
            <Text style={[styles.time, blocked && styles.timeMuted]}>{slot.startLabel}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={blocked}
              onPress={() => handlePress(slot)}
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked, selected }}
              accessibilityLabel={`${slot.startLabel} to ${slot.endLabel}, ${
                blocked ? 'not available' : selected ? 'your session' : 'free'
              }`}
              style={[
                styles.cell,
                blocked && styles.cellBlocked,
                selected && styles.cellSelected,
              ]}
            >
              {blocked && !prevBlocked && (
                <Text style={styles.blockedText}>{slot.isPast ? 'Passed' : 'Not available'}</Text>
              )}
              {isFirstSelected && <Text style={styles.selectedText}>Your session</Text>}
            </TouchableOpacity>
          </View>
        );
      })}
      {slots.length > 0 && (
        <View style={styles.row}>
          <Text style={styles.time}>{slots[slots.length - 1].endLabel}</Text>
          <View style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  time: {
    width: 72,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: -7,
  },
  timeMuted: { color: '#94a3b8' },
  cell: {
    flex: 1,
    height: 48,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  cellBlocked: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  cellSelected: {
    backgroundColor: CYAN,
    borderColor: CYAN,
  },
  blockedText: { fontSize: 13, fontWeight: '600', color: '#dc2626' },
  selectedText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
