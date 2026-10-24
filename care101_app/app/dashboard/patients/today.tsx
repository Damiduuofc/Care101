import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, FileText, ChevronRight, CheckCircle2 } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function TodayPatientsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchTodayAppointments();
    }, [])
  );

  const fetchTodayAppointments = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/doctor/today-appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setAppointments(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Fetch Today Appointments Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: any) => {
    const patient = item.patientId || {};
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => router.push(`/dashboard/patients/${patient._id}` as any)}
      >
        <View style={styles.tokenBox}>
          <Text style={styles.tokenLabel}>TOKEN</Text>
          <Text style={styles.tokenNumber}>{item.queueNumber ?? '-'}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{patient.fullName || 'Patient'}</Text>
          <Text style={styles.meta}>ID: {patient.patientId || 'N/A'}</Text>
          {item.arrived && (
            <View style={styles.arrivedBadge}>
              <CheckCircle2 size={12} color="#10b981" />
              <Text style={styles.arrivedText}>Arrived</Text>
            </View>
          )}
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

          <View>
            <Text style={styles.title}>Today's Patients</Text>
            <Text style={styles.subtitle}>Tap a patient to view medical records</Text>
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
  divider: { height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 20, marginBottom: 12 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
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
  tokenBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tokenLabel: { fontSize: 9, fontWeight: '700', color: '#06B6D4' },
  tokenNumber: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  arrivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start'
  },
  arrivedText: { fontSize: 11, fontWeight: '600', color: '#10b981' },
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
