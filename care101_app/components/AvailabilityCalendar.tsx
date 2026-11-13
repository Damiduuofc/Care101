import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

export type DayAvailability = { date: string; freeHours: number; totalHours: number };

type Props = {
  minDate: Date;              // first selectable day (inclusive)
  maxDate: Date;              // last selectable day (inclusive)
  availability: Record<string, DayAvailability>;
  loading?: boolean;
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
};

const CYAN = '#06B6D4';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LIMITED_THRESHOLD = 4; // ≤ this many free hours counts as "limited"

export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Level = 'free' | 'limited' | 'full' | 'unknown';

const levelOf = (a?: DayAvailability): Level => {
  if (!a) return 'unknown';
  if (a.freeHours === 0) return 'full';
  if (a.freeHours <= LIMITED_THRESHOLD) return 'limited';
  return 'free';
};

const LEVEL_COLORS: Record<Level, { bg: string; border: string; text: string; sub: string }> = {
  free:    { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', sub: '#059669' },
  limited: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', sub: '#d97706' },
  full:    { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', sub: '#dc2626' },
  unknown: { bg: '#f8fafc', border: '#e2e8f0', text: '#0f172a', sub: '#94a3b8' },
};

// Month calendar that shows how many free hours each day has, so a doctor can
// see open and fully-booked days before choosing one. Picking a full day lets
// the doctor contact the hospital instead.
export default function AvailabilityCalendar({ minDate, maxDate, availability, loading, selectedDate, onSelect }: Props) {
  const [month, setMonth] = useState(() => new Date(minDate.getFullYear(), minDate.getMonth(), 1));

  const canPrev = month > new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canNext = month < new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const minKey = toDateKey(minDate);
  const maxKey = toDateKey(maxDate);
  const selectedKey = selectedDate ? toDateKey(selectedDate) : null;

  const shiftMonth = (delta: number) =>
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          disabled={!canPrev}
          style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <ChevronLeft size={20} color={canPrev ? '#0f172a' : '#cbd5e1'} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          disabled={!canNext}
          style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <ChevronRight size={20} color={canNext ? '#0f172a' : '#cbd5e1'} />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        {WEEKDAYS.map(w => (
          <Text key={w} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.cell} />;

          const key = toDateKey(day);
          const inRange = key >= minKey && key <= maxKey;
          const info = availability[key];
          const level = levelOf(info);
          const isFull = level === 'full';
          const isSelected = key === selectedKey;
          const disabled = !inRange;
          const colors = LEVEL_COLORS[level];

          return (
            <View key={key} style={styles.cell}>
              <TouchableOpacity
                disabled={disabled}
                onPress={() => onSelect(day)}
                style={[
                  styles.dayBtn,
                  inRange && { backgroundColor: colors.bg, borderColor: colors.border },
                  !inRange && styles.dayOutOfRange,
                  isSelected && styles.daySelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={
                  `${day.toDateString()}${inRange && info ? (isFull ? ', fully booked' : `, ${info.freeHours} free hours`) : ''}`
                }
              >
                <Text
                  style={[
                    styles.dayNum,
                    inRange ? { color: colors.text } : styles.dayNumMuted,
                    isSelected && styles.textSelected,
                  ]}
                >
                  {day.getDate()}
                </Text>
                {inRange && (
                  loading && !info ? (
                    <Text style={[styles.daySub, { color: '#cbd5e1' }]}>·</Text>
                  ) : info ? (
                    <Text style={[styles.daySub, { color: colors.sub }, isSelected && styles.textSelected]}>
                      {isFull ? 'Full' : `${info.freeHours}h`}
                    </Text>
                  ) : null
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        {loading ? (
          <View style={styles.legendItem}>
            <ActivityIndicator size="small" color={CYAN} />
            <Text style={styles.legendText}>Checking free hours…</Text>
          </View>
        ) : (
          ([
            ['free', 'Free'],
            ['limited', `Few hours (≤${LIMITED_THRESHOLD})`],
            ['full', 'Fully booked'],
          ] as [Level, string][]).map(([lvl, label]) => (
            <View key={lvl} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: LEVEL_COLORS[lvl].sub }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  navBtnDisabled: { backgroundColor: 'transparent' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94a3b8', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 0.9, padding: 2 },
  dayBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOutOfRange: { opacity: 0.4 },
  daySelected: { backgroundColor: CYAN, borderColor: CYAN },
  dayNum: { fontSize: 15, fontWeight: '700' },
  dayNumMuted: { color: '#94a3b8', fontWeight: '500' },
  daySub: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  textSelected: { color: '#fff' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: '#64748b' },
});
