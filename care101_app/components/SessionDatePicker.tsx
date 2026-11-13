import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react-native';

type Props = {
  /** Days that have at least one session (any time of day) */
  sessionDates: Date[];
  /** True when every session on that day is full */
  isDayFull: (date: Date) => boolean;
  selectedDate: Date | null;
  onSelect: (date: Date) => void;
  doctorName?: string;
};

const CYAN = '#06b6d4';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const niceDay = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const toTyped = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

// Keeps only digits and adds the slashes for DD/MM/YYYY as the user types.
// A slash is only added once a digit follows it, so backspace never gets "stuck".
const maskDate = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

type Feedback =
  | { kind: 'idle' }
  | { kind: 'hint'; text: string }
  | { kind: 'error'; text: string; suggestion?: Date }
  | { kind: 'ok'; text: string };

// Month calendar of a doctor's session days plus a "type a date" box.
// Only days with an open session can be chosen; typing a date that has no
// session explains why and offers the nearest open day instead.
export default function SessionDatePicker({ sessionDates, isDayFull, selectedDate, onSelect, doctorName }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);

  const dayStatus = useMemo(() => {
    const map: Record<string, 'open' | 'full'> = {};
    sessionDates.forEach(d => {
      if (startOfDay(d) < today) return;
      map[keyOf(d)] = isDayFull(d) ? 'full' : 'open';
    });
    return map;
  }, [sessionDates, isDayFull, today]);

  const openDates = useMemo(
    () => sessionDates
      .map(startOfDay)
      .filter(d => dayStatus[keyOf(d)] === 'open')
      .sort((a, b) => a.getTime() - b.getTime()),
    [sessionDates, dayStatus]
  );

  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastSession = sessionDates.length
    ? sessionDates.reduce((a, b) => (a > b ? a : b))
    : today;
  const lastMonth = new Date(lastSession.getFullYear(), lastSession.getMonth(), 1);

  const [month, setMonth] = useState(() => {
    const first = openDates[0] || today;
    return new Date(first.getFullYear(), first.getMonth(), 1);
  });
  const [typed, setTyped] = useState('');
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });

  // Keep the calendar and the text box in step with the chosen day
  useEffect(() => {
    if (!selectedDate) return;
    setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setTyped(toTyped(selectedDate));
  }, [selectedDate]);

  const nearestOpen = (target: Date) => {
    if (!openDates.length) return undefined;
    return openDates.reduce((best, d) =>
      Math.abs(d.getTime() - target.getTime()) < Math.abs(best.getTime() - target.getTime()) ? d : best
    );
  };

  const choose = (d: Date) => {
    setFeedback({ kind: 'ok', text: niceDay(d) });
    onSelect(d);
  };

  const handleTyped = (raw: string) => {
    const masked = maskDate(raw);
    setTyped(masked);
    const digits = masked.replace(/\D/g, '');

    if (digits.length === 0) return setFeedback({ kind: 'idle' });

    // Early checks while typing, so mistakes show straight away
    const dd = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    if (digits.length >= 2 && (dd < 1 || dd > 31)) {
      return setFeedback({ kind: 'error', text: 'Day must be between 01 and 31.' });
    }
    if (digits.length >= 4 && (mm < 1 || mm > 12)) {
      return setFeedback({ kind: 'error', text: 'Month must be between 01 and 12.' });
    }
    if (digits.length < 8) {
      return setFeedback({ kind: 'hint', text: 'Keep typing: DD/MM/YYYY' });
    }

    const yyyy = Number(digits.slice(4, 8));
    const date = new Date(yyyy, mm - 1, dd);
    if (date.getDate() !== dd || date.getMonth() !== mm - 1) {
      const lastDay = new Date(yyyy, mm, 0).getDate();
      return setFeedback({ kind: 'error', text: `That month only has ${lastDay} days.` });
    }
    if (date < today) {
      return setFeedback({ kind: 'error', text: 'That date has already passed.', suggestion: nearestOpen(today) });
    }

    const status = dayStatus[keyOf(date)];
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    if (status === 'open') return choose(date);

    const suggestion = nearestOpen(date);
    const who = doctorName ? `Dr. ${doctorName.replace(/^Dr\.?\s*/i, '')}` : 'This doctor';
    setFeedback({
      kind: 'error',
      text: status === 'full'
        ? `All sessions on ${niceDay(date)} are full.`
        : `${who} has no session on ${niceDay(date)}.`,
      suggestion,
    });
  };

  const clearTyped = () => {
    setTyped('');
    setFeedback({ kind: 'idle' });
  };

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const canPrev = month > firstMonth;
  const canNext = month < lastMonth;
  const selectedKey = selectedDate ? keyOf(selectedDate) : null;
  const openThisMonth = cells.filter(d => d && dayStatus[keyOf(d)] === 'open').length;

  return (
    <View>
      {/* Typed date */}
      <Text style={styles.label}>Type a date</Text>
      <View
        style={[
          styles.inputRow,
          feedback.kind === 'error' && styles.inputRowError,
          feedback.kind === 'ok' && styles.inputRowOk,
        ]}
      >
        <CalendarDays size={18} color={feedback.kind === 'error' ? '#ef4444' : '#94a3b8'} />
        <TextInput
          style={styles.input}
          value={typed}
          onChangeText={handleTyped}
          placeholder="DD/MM/YYYY"
          placeholderTextColor="#cbd5e1"
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="done"
          accessibilityLabel="Appointment date, day month year"
        />
        {typed.length > 0 && (
          <TouchableOpacity onPress={clearTyped} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Clear date">
            <X size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>
      {feedback.kind !== 'idle' && (
        <View style={styles.feedbackRow}>
          <Text
            style={[
              styles.feedback,
              feedback.kind === 'error' && { color: '#dc2626' },
              feedback.kind === 'ok' && { color: '#059669' },
            ]}
          >
            {feedback.kind === 'ok' ? `✓ ${feedback.text}` : feedback.text}
          </Text>
          {feedback.kind === 'error' && feedback.suggestion && (
            <TouchableOpacity
              style={styles.suggestBtn}
              onPress={() => choose(feedback.suggestion!)}
              accessibilityRole="button"
            >
              <Text style={styles.suggestText}>Nearest open day: {niceDay(feedback.suggestion)}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={[styles.label, { marginTop: 16 }]}>Or pick from the calendar</Text>
      <View style={styles.card}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            disabled={!canPrev}
            style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={20} color={canPrev ? '#0f172a' : '#cbd5e1'} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.monthTitle}>
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.monthSub}>
              {openThisMonth === 0 ? 'No open sessions this month' : `${openThisMonth} open day${openThisMonth === 1 ? '' : 's'}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            disabled={!canNext}
            style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
            accessibilityLabel="Next month"
          >
            <ChevronRight size={20} color={canNext ? '#0f172a' : '#cbd5e1'} />
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          {WEEKDAYS.map(w => <Text key={w} style={styles.weekday}>{w}</Text>)}
        </View>

        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={styles.cell} />;
            const key = keyOf(day);
            const status = dayStatus[key];
            const isSelected = key === selectedKey;
            const isToday = key === keyOf(today);
            const open = status === 'open';
            return (
              <View key={key} style={styles.cell}>
                <TouchableOpacity
                  disabled={!open}
                  onPress={() => choose(day)}
                  style={[
                    styles.dayBtn,
                    open && styles.dayOpen,
                    status === 'full' && styles.dayFull,
                    isToday && !isSelected && styles.dayToday,
                    isSelected && styles.daySelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: !open }}
                  accessibilityLabel={`${day.toDateString()}${open ? ', sessions available' : status === 'full' ? ', full' : ', no session'}`}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      open && styles.dayNumOpen,
                      status === 'full' && styles.dayNumFull,
                      isSelected && styles.textSelected,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  {status && (
                    <View style={[styles.dot, { backgroundColor: isSelected ? '#fff' : open ? CYAN : '#f87171' }]} />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: CYAN }]} /><Text style={styles.legendText}>Sessions available</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#f87171' }]} /><Text style={styles.legendText}>Full</Text></View>
          <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#e2e8f0' }]} /><Text style={styles.legendText}>No session</Text></View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputRowError: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  inputRowOk: { borderColor: '#6ee7b7' },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, fontWeight: '600', color: '#0f172a', letterSpacing: 1 },
  feedbackRow: { marginTop: 6, gap: 6 },
  feedback: { fontSize: 12, color: '#64748b' },
  suggestBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestText: { fontSize: 12, fontWeight: '700', color: '#0e7490' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  navBtnDisabled: { backgroundColor: 'transparent' },
  monthTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  monthSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94a3b8', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  dayBtn: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  dayOpen: { backgroundColor: '#ecfeff', borderColor: '#a5f3fc' },
  dayFull: { backgroundColor: '#fef2f2' },
  dayToday: { borderColor: '#94a3b8' },
  daySelected: { backgroundColor: CYAN, borderColor: CYAN },
  dayNum: { fontSize: 14, fontWeight: '500', color: '#cbd5e1' },
  dayNumOpen: { color: '#0f172a', fontWeight: '700' },
  dayNumFull: { color: '#f87171', fontWeight: '600', textDecorationLine: 'line-through' },
  textSelected: { color: '#fff' },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingHorizontal: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: '#64748b' },
});
