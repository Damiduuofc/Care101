import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Calendar, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PatientsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [channelingStatus, setChannelingStatus] = useState('On Time');
  
  // State for the temporary selection before confirmation
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchStats();
    }, [])
  );

  const fetchStats = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/doctor/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setChannelingStatus(data.channelingStatus || 'On Time');
        setSelectedStatus(data.channelingStatus || 'On Time');
      }
    } catch (error) {
      console.error('Fetch Stats Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUpdate = async () => {
    if (!selectedStatus) return;

    setIsUpdating(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const response = await fetch(`${API_URL}/doctor/delay-status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: selectedStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setChannelingStatus(data.status);
        Alert.alert('Success', `Status confirmed: ${data.status}`);
      } else {
        Alert.alert('Error', 'Failed to update status');
      }
    } catch (err) {
      console.error('Delay update error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#06B6D4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/dashboard')}
          >
            <ArrowLeft size={22} color="#0f172a" />
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>Clinic Status</Text>
            <Text style={styles.subtitle}>Update your availability</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Current: {channelingStatus}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* STATUS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Status</Text>
          <Text style={styles.sectionDesc}>
            Choose a delay status and click confirm to notify patients.
          </Text>

          <View style={styles.delayGrid}>
            {[
              { id: 'on-time', label: 'On Time', value: 'On Time', color: '#06B6D4', bg: '#d1fae5' },
              { id: '10-min', label: 'Late by 10 mins', value: 'Delayed 10 mins', color: '#f59e0b', bg: '#fef3c7' },
              { id: '20-min', label: 'Late by 20 mins', value: 'Delayed 20 mins', color: '#f97316', bg: '#ffedd5' },
              { id: '1-hr', label: 'Late by 1 hour', value: 'Delayed 1 hour', color: '#ef4444', bg: '#fee2e2' },
            ].map((delay) => (
              <TouchableOpacity
                key={delay.id}
                activeOpacity={0.8}
                style={[
                  styles.delayCard,
                  selectedStatus === delay.value && styles.activeCard
                ]}
                onPress={() => setSelectedStatus(delay.value)}
              >
                <View style={[styles.delayIconBox, { backgroundColor: delay.bg }]}>
                  <Calendar size={22} color={delay.color} />
                </View>
                <Text style={[
                  styles.delayText,
                  selectedStatus === delay.value && styles.activeText
                ]}>
                  {delay.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* CONFIRM BUTTON (Only shows if selected differs from current) */}
        {selectedStatus !== channelingStatus && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirmUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <CheckCircle2 size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.confirmButtonText}>Confirm Status Change</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  statusBadge: {
    marginTop: 8,
    backgroundColor: '#ecfeff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start'
  },
  statusText: { color: '#06B6D4', fontWeight: '600', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 20, marginBottom: 20 },
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  sectionDesc: { fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 20 },
  delayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  delayCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    elevation: 2
  },
  activeCard: { borderColor: '#06B6D4', backgroundColor: '#ecfeff' },
  delayIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  delayText: { fontSize: 14, color: '#475569', textAlign: 'center', fontWeight: '500' },
  activeText: { color: '#0f172a', fontWeight: '700' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
  },
  confirmButton: {
    backgroundColor: '#06B6D4',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});