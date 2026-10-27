import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, FileText, ChevronRight, CheckCircle2, Clock, Radio } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/context/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type Session = {
  currentQueueNumber: number;
  sessionStarted: boolean;
  sessionEndedToday: boolean;
  isArrived: boolean;
  allocatedRoom: string | null;
};

type QueueState = 'serving' | 'next' | 'done' | 'waiting';

const EMPTY_SESSION: Session = {
  currentQueueNumber: 0,
  sessionStarted: false,
  sessionEndedToday: false,
  isArrived: false,
  allocatedRoom: null,
};

const idOf = (value: any) => String(value?._id || value || '');

export default function TodayPatientsScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const doctorId = String(user?._id || user?.id || '');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [live, setLive] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [session, setSession] = useState<Session>(EMPTY_SESSION);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTodayAppointments = useCallback(async () => {
    try {
      const storedToken = token || await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/doctor/today-appointments`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
        if (data.session) setSession({ ...EMPTY_SESSION, ...data.session });
      }
    } catch (error) {
      console.error('Fetch Today Appointments Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Several appointment events can arrive together (e.g. "complete" + "next"), so refetch once.
  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(fetchTodayAppointments, 400);
  }, [fetchTodayAppointments]);

  // Load on focus and keep the list live while the screen is visible.
  useFocusEffect(
    useCallback(() => {
      fetchTodayAppointments();
      if (!token || !doctorId) return;

      let socketUrl = API_URL || '';
      try {
        socketUrl = new URL(socketUrl).origin;
      } catch (e) {
        console.error('Invalid API URL for socket:', e);
      }

      const socket: Socket = io(socketUrl, {
        auth: { token },
        extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        setLive(true);
        socket.emit('joinDoctorRoom', doctorId);
      });
      socket.on('disconnect', () => setLive(false));

      // Queue position / session changes made by the nurse
      const applySession = (payload: any) => {
        if (!payload || idOf(payload.doctorId ?? payload._id) !== doctorId) return;
        setSession(prev => ({
          ...prev,
          currentQueueNumber: Number(payload.currentServingNumber ?? payload.currentToken ?? payload.currentQueueNumber ?? prev.currentQueueNumber),
          ...(payload.sessionStarted !== undefined && { sessionStarted: Boolean(payload.sessionStarted) }),
          ...(payload.sessionEndedToday !== undefined && { sessionEndedToday: Boolean(payload.sessionEndedToday) }),
          ...(payload.isArrived !== undefined && { isArrived: Boolean(payload.isArrived) }),
          ...(payload.allocatedRoom !== undefined && { allocatedRoom: payload.allocatedRoom || null }),
        }));
      };
      socket.on('queueUpdated', applySession);
      socket.on('doctorStatusUpdated', (doc: any) => applySession({ ...doc, doctorId: doc?._id }));

      // Arrivals, completions, new paid bookings
      socket.on('appointmentUpdated', (appt: any) => {
        if (idOf(appt?.doctorId) === doctorId) scheduleRefetch();
      });

      return () => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        socket.disconnect();
        setLive(false);
      };
    }, [token, doctorId, fetchTodayAppointments, scheduleRefetch])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTodayAppointments();
  };

  // Work out who is in the room, who is next and who is finished.
  const { stateById, nextToken, doneCount } = useMemo(() => {
    const states: Record<string, QueueState> = {};
    const current = session.currentQueueNumber;
    let next: number | null = null;
    let done = 0;

    for (const appt of appointments) {
      const q = Number(appt.queueNumber);
      if (appt.status === 'completed') {
        states[appt._id] = 'done';
        done++;
      } else if (session.sessionStarted && q === current) {
        states[appt._id] = 'serving';
      } else {
        states[appt._id] = 'waiting';
      }
    }

    if (!session.sessionEndedToday) {
      const upcoming = appointments
        .filter(a => states[a._id] === 'waiting' && (!session.sessionStarted || Number(a.queueNumber) > current))
        .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber))[0];
      if (upcoming) {
        states[upcoming._id] = 'next';
        next = Number(upcoming.queueNumber);
      }
    }

    return { stateById: states, nextToken: next, doneCount: done };
  }, [appointments, session]);

  const servingPatient = appointments.find(a => stateById[a._id] === 'serving')?.patientId;

  const renderSessionBanner = () => {
    let title: string;
    let detail: string;
    let tone: object = styles.bannerIdle;

    if (session.sessionEndedToday) {
      title = 'Session ended';
      detail = `${doneCount} of ${appointments.length} patients seen`;
    } else if (session.sessionStarted) {
      tone = styles.bannerActive;
      title = `Now serving #${session.currentQueueNumber || '-'}`;
      detail = servingPatient?.fullName
        ? `${servingPatient.fullName}${nextToken ? ` • Next: #${nextToken}` : ' • Last patient'}`
        : nextToken ? `Next: #${nextToken}` : 'No more patients waiting';
    } else {
      title = 'Session not started';
      detail = session.isArrived
        ? 'The nurse will start the queue shortly'
        : 'Mark your arrival with the nurse to begin';
    }

    return (
      <View style={[styles.banner, tone]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, session.sessionStarted && !session.sessionEndedToday && styles.bannerTitleActive]}>
            {title}
          </Text>
          <Text style={[styles.bannerDetail, session.sessionStarted && !session.sessionEndedToday && styles.bannerDetailActive]}>
            {detail}
          </Text>
        </View>
        <View style={styles.bannerStats}>
          <Text style={[styles.bannerCount, session.sessionStarted && !session.sessionEndedToday && styles.bannerTitleActive]}>
            {doneCount}/{appointments.length}
          </Text>
          <Text style={[styles.bannerCountLabel, session.sessionStarted && !session.sessionEndedToday && styles.bannerDetailActive]}>
            done
          </Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: any) => {
    const patient = item.patientId || {};
    const state = stateById[item._id];

    return (
      <TouchableOpacity
        style={[
          styles.card,
          state === 'serving' && styles.cardServing,
          state === 'next' && styles.cardNext,
          state === 'done' && styles.cardDone,
        ]}
        activeOpacity={0.8}
        onPress={() => router.push(`/dashboard/patients/${patient._id}` as any)}
      >
        <View style={[styles.tokenBox, state === 'serving' && styles.tokenBoxServing]}>
          <Text style={[styles.tokenLabel, state === 'serving' && styles.tokenTextServing]}>TOKEN</Text>
          <Text style={[styles.tokenNumber, state === 'serving' && styles.tokenTextServing]}>{item.queueNumber ?? '-'}</Text>
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, state === 'done' && styles.nameDone]}>{patient.fullName || 'Patient'}</Text>
          <Text style={styles.meta}>ID: {patient.patientId || 'N/A'}</Text>
          <View style={styles.badgeRow}>
            {state === 'serving' && (
              <View style={[styles.badge, styles.badgeServing]}>
                <Radio size={12} color="#ffffff" />
                <Text style={[styles.badgeText, { color: '#ffffff' }]}>In consultation</Text>
              </View>
            )}
            {state === 'next' && (
              <View style={[styles.badge, styles.badgeNext]}>
                <Clock size={12} color="#b45309" />
                <Text style={[styles.badgeText, { color: '#b45309' }]}>Up next</Text>
              </View>
            )}
            {state === 'done' && (
              <View style={[styles.badge, styles.badgeDone]}>
                <CheckCircle2 size={12} color="#64748b" />
                <Text style={[styles.badgeText, { color: '#64748b' }]}>Done</Text>
              </View>
            )}
            {state !== 'done' && (
              item.arrived ? (
                <View style={[styles.badge, styles.badgeArrived]}>
                  <CheckCircle2 size={12} color="#10b981" />
                  <Text style={[styles.badgeText, { color: '#10b981' }]}>Arrived</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeAway]}>
                  <Text style={[styles.badgeText, { color: '#94a3b8' }]}>Not arrived</Text>
                </View>
              )
            )}
          </View>
        </View>

        <View style={styles.recordsButton}>
          <FileText size={16} color="#06B6D4" />
          <Text style={styles.recordsButtonText}>Records</Text>
          <ChevronRight size={16} color="#06B6D4" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>

        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={22} color="#0f172a" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Today's Patients</Text>
            <Text style={styles.subtitle}>Tap a patient to view medical records</Text>
          </View>

          <View style={[styles.liveDot, live ? styles.liveOn : styles.liveOff]}>
            <View style={[styles.liveDotInner, { backgroundColor: live ? '#10b981' : '#94a3b8' }]} />
            <Text style={[styles.liveText, { color: live ? '#10b981' : '#94a3b8' }]}>{live ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {loading ? (
          <ActivityIndicator size="large" color="#06B6D4" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item: any) => item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={appointments.length > 0 ? renderSessionBanner : null}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#06B6D4']} tintColor="#06B6D4" />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No appointments today</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    gap: 14
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 2 },
  liveDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  liveOn: { backgroundColor: '#d1fae5' },
  liveOff: { backgroundColor: '#f1f5f9' },
  liveDotInner: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 20, marginBottom: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    gap: 12
  },
  bannerActive: { backgroundColor: '#0891b2' },
  bannerIdle: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  bannerTitleActive: { color: '#ffffff' },
  bannerDetail: { fontSize: 13, color: '#64748b', marginTop: 3 },
  bannerDetailActive: { color: '#cffafe' },
  bannerStats: { alignItems: 'center' },
  bannerCount: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  bannerCountLabel: { fontSize: 11, color: '#64748b' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 14,
    gap: 14,
    elevation: 2
  },
  cardServing: { borderColor: '#06B6D4', borderWidth: 2, backgroundColor: '#f0fdff' },
  cardNext: { borderColor: '#fcd34d' },
  cardDone: { opacity: 0.55, elevation: 0 },
  tokenBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tokenBoxServing: { backgroundColor: '#06B6D4' },
  tokenTextServing: { color: '#ffffff' },
  tokenLabel: { fontSize: 9, fontWeight: '700', color: '#06B6D4' },
  tokenNumber: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  nameDone: { textDecorationLine: 'line-through', color: '#64748b' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeServing: { backgroundColor: '#06B6D4' },
  badgeNext: { backgroundColor: '#fef3c7' },
  badgeDone: { backgroundColor: '#f1f5f9' },
  badgeArrived: { backgroundColor: '#d1fae5' },
  badgeAway: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  recordsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfeff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12
  },
  recordsButtonText: { fontSize: 13, fontWeight: '700', color: '#06B6D4' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 15, color: '#94a3b8' },
});
