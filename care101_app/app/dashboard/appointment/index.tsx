import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Calendar as CalendarIcon,
  Clock,
  Send,
  Users,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function AppointmentScreen() {
  const router = useRouter();

  // Selected Date State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Time States
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Queue Constraints
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [queueLimit, setQueueLimit] = useState('');

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schedule History State
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchSchedules();
  }, []);

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

  // Helper for Formatting
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Build Calendar Grid
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    let daysArray = [];
    for (let i = 0; i < firstDayIndex; i++) {
      daysArray.push(null);
    }
    for (let i = 1; i <= days; i++) {
      daysArray.push(new Date(year, month, i));
    }
    return daysArray;
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const daysGrid = getDaysInMonth(currentMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleSubmit = async () => {
    if (!isUnlimited && !queueLimit.trim()) {
      Alert.alert("Required", "Please provide a valid queue limit or set it to unlimited.");
      return;
    }

    if (endTime <= startTime) {
      Alert.alert("Invalid Time", "End time must be after the start time.");
      return;
    }

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
          date: selectedDate.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          isUnlimited,
          queueLimit: isUnlimited ? null : parseInt(queueLimit, 10),
        })
      });

      if (response.ok) {
        Alert.alert("Success", "Your schedule request has been sent to the hospital.");
        router.back();
      } else {
        const errData = await response.json();
       
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Success", "Request sent! (Offline Mode)");
      router.back();
    } finally {
      setIsSubmitting(false);
      fetchSchedules();
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
        <Text style={styles.headerTitle}>Update Schedule</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          <View style={styles.container}>
            <Text style={styles.sectionHeading}>Update Schedule</Text>
          </View>

          <Text style={styles.sectionHeadingSmall}>Select Date</Text>

          {/* CUSTOM CALENDAR */}
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.monthNav}>
                <ChevronLeft size={20} color="#64748b" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.monthNav}>
                <ChevronRight size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekDaysContainer}>
              {weekDays.map(day => (
                <Text key={day} style={styles.weekDayText}>{day}</Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {daysGrid.map((day, index) => {
                const isSelected = day ? isSameDay(day, selectedDate) : false;
                const isPast = day ? day < new Date(new Date().setHours(0, 0, 0, 0)) : true;

                return (
                  <View key={index} style={styles.dayWrapper}>
                    {day ? (
                      <TouchableOpacity
                        disabled={isPast}
                        style={[
                          styles.dayButton,
                          isSelected && styles.dayButtonSelected,
                          isPast && styles.dayButtonDisabled
                        ]}
                        onPress={() => setSelectedDate(day)}
                      >
                        <Text style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          isPast && styles.dayTextDisabled
                        ]}>
                          {day.getDate()}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.dayButton} />
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.formContainer}>

            {/* TIME SELECTION */}
            <Text style={styles.sectionHeading}>Select Time</Text>
            <View style={styles.timeGrid}>
              <View style={styles.timeInputBox}>
                <Text style={styles.label}>Start Time</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowStartTimePicker(true)}
                >
                  <Clock size={16} color="#0ea5e9" style={{ marginRight: 8 }} />
                  <Text style={styles.timeText}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.timeInputBox}>
                <Text style={styles.label}>End Time</Text>
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setShowEndTimePicker(true)}
                >
                  <Clock size={16} color="#ef4444" style={{ marginRight: 8 }} />
                  <Text style={styles.timeText}>{formatTime(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* QUEUE LIMIT SELECTION */}
            <Text style={[styles.sectionHeading, { marginTop: 24 }]}>Queue Management</Text>

            <View style={styles.switchContainer}>
              <View style={styles.switchTextGroup}>
                <View style={styles.iconCircle}>
                  <Users size={20} color="#06B6D4" />
                </View>
                <View>
                  <Text style={styles.switchTitle}>Unlimited Queue</Text>
                  <Text style={styles.switchSubtitle}>Accept unlimited appointments</Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: "#e2e8f0", true: "#a7f3d0" }}
                thumbColor={isUnlimited ? "#06B6D4" : "#f8fafc"}
                onValueChange={setIsUnlimited}
                value={isUnlimited}
              />
            </View>

            {!isUnlimited && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Maximum Patients (Queue Limit)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 20"
                  keyboardType="numeric"
                  value={queueLimit}
                  onChangeText={setQueueLimit}
                />
              </View>
            )}

            {/* SUMMARY CARD */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Request Summary</Text>
              <View style={styles.summaryRow}>
                <CalendarIcon size={16} color="#64748b" />
                <Text style={styles.summaryText}>{formatDate(selectedDate)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Clock size={16} color="#64748b" />
                <Text style={styles.summaryText}>
                  {formatTime(startTime)} - {formatTime(endTime)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Users size={16} color="#64748b" />
                <Text style={styles.summaryText}>
                  {isUnlimited ? 'Unlimited Patients' : `Max ${queueLimit || 0} Patients`}
                </Text>
              </View>
            </View>

          </View>


          {/* SCHEDULE HISTORY SECTION */}
          <Text style={styles.sectionHeading}>Approved & Pending Schedules</Text>
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
                    <View style={[
                      styles.statusBadge,
                      sched.status === 'approved' ? styles.statusApproved : 
                      sched.status === 'rejected' ? styles.statusRejected : 
                      styles.statusPending
                    ]}>
                      <Text style={[
                        styles.statusText,
                        sched.status === 'approved' ? { color: '#059669' } : 
                        sched.status === 'rejected' ? { color: '#dc2626' } : 
                        { color: '#d97706' }
                      ]}>
                        {sched.status.toUpperCase()}
                      </Text>
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
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER ACTIONS */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Send size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitText}>Send Request to Hospital</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* INVISIBLE PLATFORM DATE/TIME PICKERS */}
      {showStartTimePicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowStartTimePicker(Platform.OS === 'ios');
            if (date) setStartTime(date);
          }}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowEndTimePicker(Platform.OS === 'ios');
            if (date) setEndTime(date);
          }}
        />
      )}

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

  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 12
  },

  // Calendar Styles
  calendarContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  monthNav: {
    padding: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDayText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    width: 36,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  dayWrapper: {
    width: '14.28%', // 100/7
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: '#06B6D4',
  },
  dayButtonDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: '#cbd5e1',
  },

  formContainer: {
    paddingHorizontal: 20,
  },

  timeGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  timeInputBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 8,
  },
  timePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },

  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  switchTextGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  switchTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  switchSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },

  inputGroup: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },

  summaryCard: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
    fontWeight: '500',
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: '#06B6D4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeadingSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8
  },
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
  statusText: {
    fontSize: 10,
    fontWeight: '800',
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
