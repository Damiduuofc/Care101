import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, Send, ArrowLeft, Trash2, Minus, Plus } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import HourTimeline, { TimelineSlot, HourRange } from '../../../components/HourTimeline';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const DAYS_AHEAD = 60;
const CYAN = '#06B6D4';

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const hourLabel = (h: number) => {
  const period = h >= 12 && h < 24 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
};

export default function AppointmentScreen() {
  const router = useRouter();

  // Date strip: today + next DAYS_AHEAD days
  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Timeline
  const [slots, setSlots] = useState<TimelineSlot[]>([]);
  const [department, setDepartment] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [range, setRange] = useState<HourRange>(null);

  // Queue
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [queueLimit, setQueueLimit] = useState('20');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schedule History
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    if (selectedDate) fetchAvailability(selectedDate);
  }, [selectedDate]);

  const fetchSchedules = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/schedule-requests/my-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error("Fetch Schedules Error:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchAvailability = async (date: Date) => {
    setLoadingSlots(true);
    setRange(null);
    setSlots([]);
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/schedule-requests/availability?date=${toDateKey(date)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSlots(data.timeline || []);
        setDepartment(data.department || '');
      } else {
        Alert.alert("Error", "Could not load free hours for this day.");
      }
    } catch (error) {
      console.error("Fetch Availability Error:", error);
      Alert.alert("Error", "Could not connect to server.");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleCancelRequest = (schedId: string, isApproved: boolean) => {
    Alert.alert(
      isApproved ? "Cancel Approved Schedule" : "Cancel Schedule Request",
      isApproved 
        ? "Are you sure you want to cancel this approved schedule? Any booked appointments will be cancelled and room/nurse resources will be released."
        : "Are you sure you want to cancel this pending schedule request?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              const response = await fetch(`${API_URL}/schedule-requests/${schedId}/status`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'cancelled' })
              });
              if (response.ok) {
                Alert.alert("Success", "Schedule has been cancelled.");
                fetchSchedules();
              } else {
                const errData = await response.json();
                Alert.alert("Error", errData.msg || "Failed to cancel schedule.");
              }
            } catch (err) {
              console.error("Cancel Error:", err);
              Alert.alert("Error", "Could not connect to server.");
            }
          }
        }
      ]
    );
  };

  const handleDeleteRequest = (schedId: string) => {
    Alert.alert(
      "Delete Schedule",
      "Are you sure you want to permanently delete this schedule from your history?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('token');
              const response = await fetch(`${API_URL}/schedule-requests/${schedId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              if (response.ok) {
                Alert.alert("Success", "Schedule deleted.");
                fetchSchedules();
              } else {
                const errData = await response.json();
                Alert.alert("Error", errData.msg || "Failed to delete schedule.");
              }
            } catch (err) {
              console.error("Delete Error:", err);
              Alert.alert("Error", "Could not connect to server.");
            }
          }
        }
      ]
    );
  };

  const queueNumber = parseInt(queueLimit, 10);
  const queueValid = isUnlimited || (Number.isFinite(queueNumber) && queueNumber >= 1);
  const rangeValid =
    !!range && slots.filter(s => s.hour >= range.start && s.hour <= range.end).every(s => s.isAvailable);
  const canSend = !!selectedDate && rangeValid && queueValid && !isSubmitting;
  const freeCount = slots.filter(s => s.isAvailable).length;

  const sendLabel = !selectedDate
    ? 'Choose a date'
    : !range
      ? 'Choose your hours'
      : !queueValid
        ? 'Set patient limit'
        : 'Send request';

  const changeQueue = (delta: number) => {
    const next = Math.max(1, (Number.isFinite(queueNumber) ? queueNumber : 0) + delta);
    setQueueLimit(String(next));
  };

  const handleSubmit = async () => {
    if (!canSend || !selectedDate || !range) return;

    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const d = selectedDate.getDate();
    const startTime = new Date(y, m, d, range.start, 0, 0, 0);
    const endTime = new Date(y, m, d, range.end + 1, 0, 0, 0);

    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/schedule-requests/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          // Noon keeps the calendar day stable across time zones
          date: new Date(y, m, d, 12).toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isUnlimited,
          queueLimit: isUnlimited ? null : queueNumber,
        })
      });

      if (response.ok) {
        Alert.alert("Request sent", "The hospital will confirm your session soon.");
        setRange(null);
        fetchSchedules();
        fetchAvailability(selectedDate);
      } else {
        const errData = await response.json().catch(() => ({}));
        Alert.alert("Not sent", errData.msg || "Please try again.");
        fetchAvailability(selectedDate);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Not sent", "Could not connect to server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Sessions</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* 1. DATE */}
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepTitle}>Date</Text>
            <Text style={styles.stepMeta}>
              {(selectedDate || dates[0]).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
            {dates.map((day) => {
              const isSelected = !!selectedDate && toDateKey(day) === toDateKey(selectedDate);
              return (
                <TouchableOpacity
                  key={toDateKey(day)}
                  style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                  onPress={() => setSelectedDate(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={day.toDateString()}
                >
                  <Text style={[styles.dateChipDay, isSelected && styles.dateChipTextSelected]}>
                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateChipNum, isSelected && styles.dateChipTextSelected]}>
                    {day.getDate()}
                  </Text>
                  {day.getDate() === 1 && (
                    <Text style={[styles.dateChipMonth, isSelected && styles.dateChipTextSelected]}>
                      {day.toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 2. HOURS */}
          {selectedDate && (
            <>
              <View style={styles.stepHeader}>
                <Text style={styles.stepNumber}>2</Text>
                <Text style={styles.stepTitle}>Hours</Text>
                {!!department && !range && (
                  <View style={styles.deptBadge}>
                    <Text style={styles.deptBadgeText}>{department}</Text>
                  </View>
                )}
                {range && (
                  <TouchableOpacity onPress={() => setRange(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.hint}>
                {range ? 'Tap another free hour to change the end.' : 'Tap a start hour, then an end hour.'}
              </Text>

              <View style={styles.card}>
                {loadingSlots ? (
                  <ActivityIndicator color={CYAN} style={{ marginVertical: 32 }} />
                ) : slots.length > 0 && freeCount === 0 ? (
                  <View style={styles.emptyDay}>
                    <Text style={styles.emptyDayTitle}>No free hours</Text>
                    <Text style={styles.emptyDayText}>Please choose another date.</Text>
                  </View>
                ) : (
                  <HourTimeline slots={slots} range={range} onChange={setRange} />
                )}
              </View>

              {/* From / To — filled from the timeline */}
              <View style={styles.timeRow}>
                <View style={[styles.timeField, range && styles.timeFieldFilled]}>
                  <Text style={styles.timeFieldLabel}>From</Text>
                  <Text style={[styles.timeFieldValue, !range && styles.timeFieldEmpty]}>
                    {range ? hourLabel(range.start) : '--:--'}
                  </Text>
                </View>
                <View style={[styles.timeField, range && styles.timeFieldFilled]}>
                  <Text style={styles.timeFieldLabel}>To</Text>
                  <Text style={[styles.timeFieldValue, !range && styles.timeFieldEmpty]}>
                    {range ? hourLabel(range.end + 1) : '--:--'}
                  </Text>
                </View>
              </View>

              {/* 3. QUEUE */}
              <View style={styles.stepHeader}>
                <Text style={styles.stepNumber}>3</Text>
                <Text style={styles.stepTitle}>Patients</Text>
              </View>
              <View style={styles.segment}>
                {[
                  { label: 'Set a limit', value: false },
                  { label: 'Unlimited', value: true },
                ].map(opt => {
                  const active = isUnlimited === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                      onPress={() => setIsUnlimited(opt.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!isUnlimited && (
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => changeQueue(-1)}
                    accessibilityLabel="Fewer patients"
                  >
                    <Minus size={20} color="#0f172a" />
                  </TouchableOpacity>
                  <View style={styles.stepperValueBox}>
                    <TextInput
                      style={styles.stepperInput}
                      keyboardType="number-pad"
                      value={queueLimit}
                      onChangeText={t => setQueueLimit(t.replace(/[^0-9]/g, ''))}
                      maxLength={3}
                      accessibilityLabel="Maximum patients"
                    />
                    <Text style={styles.stepperUnit}>max patients</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => changeQueue(1)}
                    accessibilityLabel="More patients"
                  >
                    <Plus size={20} color="#0f172a" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* SCHEDULE HISTORY SECTION */}
          <Text style={styles.sectionHeading}>My sessions</Text>
          <View style={styles.historyContainer}>
            {loadingHistory ? (
              <ActivityIndicator color="#06B6D4" style={{ marginVertical: 20 }} />
            ) : schedules.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryText}>No requests found</Text>
              </View>
            ) : (
              schedules.map((sched) => (
                <View key={sched._id} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <Text style={styles.historyDate}>{new Date(sched.date).toDateString()}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[
                        styles.statusBadge,
                        sched.status === 'approved' ? styles.statusApproved : 
                        sched.status === 'rejected' ? styles.statusRejected : 
                        sched.status === 'cancelled' ? styles.statusCancelled :
                        styles.statusPending
                      ]}>
                        <Text style={[
                          styles.statusText,
                          sched.status === 'approved' ? { color: '#059669' } : 
                          sched.status === 'rejected' ? { color: '#dc2626' } : 
                          sched.status === 'cancelled' ? { color: '#d97706' } :
                          { color: '#b45309' }
                        ]}>
                          {sched.status.toUpperCase()}
                        </Text>
                      </View>
                      {(sched.status === 'rejected' || sched.status === 'cancelled') && (
                        <TouchableOpacity 
                          onPress={() => handleDeleteRequest(sched._id)}
                          style={styles.deleteIconBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View style={styles.historyCardBody}>
                    <View style={styles.historyRow}>
                      <Clock size={14} color="#64748b" />
                      <Text style={styles.historyTime}>
                        {new Date(sched.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                        {new Date(sched.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    {sched.status === 'approved' && (
                      <View style={styles.allocationBox}>
                        <Text style={styles.allocationText}>Room: {sched.allocatedRoom || 'TBD'}</Text>
                        <Text style={styles.allocationText}>Nurse: {sched.allocatedNurse || 'TBD'}</Text>
                      </View>
                    )}
                    {(sched.status === 'approved' || sched.status === 'pending') && (
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => handleCancelRequest(sched._id, sched.status === 'approved')}
                        >
                          <Text style={styles.cancelBtnText}>
                            {sched.status === 'approved' ? 'Cancel Approved Slot' : 'Cancel Request'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER ACTION */}
      <View style={styles.footer}>
        {range && selectedDate && (
          <Text style={styles.footerSummary}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {'  ·  '}
            {hourLabel(range.start)} – {hourLabel(range.end + 1)}
            {'  ·  '}
            {isUnlimited ? 'Unlimited' : `${queueValid ? queueNumber : '?'} patients`}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.submitButton, !canSend && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSend }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              {canSend && <Send size={18} color="#fff" style={{ marginRight: 8 }} />}
              <Text style={[styles.submitText, !canSend && styles.submitTextDisabled]}>{sendLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  scrollContent: { paddingBottom: 40 },

  // Steps
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    overflow: 'hidden',
    marginRight: 10,
  },
  stepTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  stepMeta: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  deptBadge: { backgroundColor: '#ecfeff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  deptBadgeText: { fontSize: 12, fontWeight: '700', color: '#0e7490' },
  hint: { marginHorizontal: 20, marginTop: -4, marginBottom: 12, fontSize: 13, color: '#64748b' },
  clearText: { fontSize: 14, fontWeight: '600', color: CYAN },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginHorizontal: 20,
    marginTop: 36,
    marginBottom: 12
  },

  // Date strip
  dateStrip: { paddingHorizontal: 20, gap: 8 },
  dateChip: {
    width: 56,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  dateChipSelected: { backgroundColor: CYAN, borderColor: CYAN },
  dateChipDay: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  dateChipNum: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  dateChipMonth: { fontSize: 10, fontWeight: '700', color: '#64748b', marginTop: 2 },
  dateChipTextSelected: { color: '#fff' },

  // Timeline card
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyDay: { alignItems: 'center', paddingVertical: 28 },
  emptyDayTitle: { fontSize: 16, fontWeight: '700', color: '#dc2626' },
  emptyDayText: { fontSize: 13, color: '#64748b', marginTop: 4 },

  // From / To
  timeRow: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 12 },
  timeField: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timeFieldFilled: { borderColor: CYAN, backgroundColor: '#ecfeff' },
  timeFieldLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  timeFieldValue: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  timeFieldEmpty: { color: '#cbd5e1' },

  // Queue
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: '#0f172a' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueBox: { flex: 1, alignItems: 'center' },
  stepperInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    minWidth: 60,
    padding: 0,
  },
  stepperUnit: { fontSize: 12, color: '#64748b', marginTop: 2 },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  footerSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 10,
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: CYAN,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { backgroundColor: '#e2e8f0' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  submitTextDisabled: { color: '#94a3b8' },

  historyContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPending: { backgroundColor: '#fef3c7' },
  statusApproved: { backgroundColor: '#d1fae5' },
  statusRejected: { backgroundColor: '#fee2e2' },
  statusCancelled: { backgroundColor: '#ffedd5' },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  deleteIconBtn: {
    padding: 4,
  },
  historyCardBody: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTime: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  allocationBox: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  allocationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#06B6D4',
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff1f2',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#e11d48',
  },
  emptyHistory: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyHistoryText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
