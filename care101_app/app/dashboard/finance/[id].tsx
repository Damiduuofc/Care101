import { SkeletonList } from '../../../components/Skeleton';
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Modal, TextInput,
  Platform, KeyboardAvoidingView, FlatList, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Plus, Calendar, X, Trash2 } from 'lucide-react-native';
import BottomNavBar from '@/components/BottomNavBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/finance`;

export default function HospitalDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [hospital, setHospital] = useState<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form Inputs
  const [patients, setPatients] = useState('');
  const [income, setIncome] = useState('');

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      console.log(`Fetching details for ID: ${id}`);
      const token = await SecureStore.getItemAsync('token');

      const res = await fetch(`${API_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 2. READ RAW TEXT FIRST
      const text = await res.text();
      console.log("SERVER STATUS:", res.status);
      console.log("RAW RESPONSE:", text); // 🚨 READ THIS IN CONSOLE

      if (res.ok) {
        const data = JSON.parse(text);
        setHospital(data);
      } else {
        console.error("Server Error:", text);
      }
    } catch (error) {
      console.error("Network Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      await fetch(`${API_URL}/${id}/add-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'channeling',
          date: date.toISOString(),
          patients,
          income
        })
      });
      setModalVisible(false);
      setPatients(''); setIncome('');
      fetchDetails();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      await fetch(`${API_URL}/${id}/record/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDetails();
    } catch (error) {
      console.error(error);
    }
  };

  // Channeling records only — surgical finance is no longer tracked
  const records = hospital?.records?.filter((r: any) => r.type === 'channeling') || [];

  const renderCard = ({ item }: any) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.dateBadge}>
          <Calendar size={14} color="#64748b" />
          <Text style={styles.dateText}>{new Date(item.date).toDateString()}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteRecord(item._id)} accessibilityRole="button" accessibilityLabel="Delete">
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <View style={styles.recordRow}>
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>Patients</Text>
          <Text style={styles.statValue}>{item.patients}</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>Income</Text>
          <Text style={styles.statValueBlue}>{(item.income || 0).toLocaleString()} LKR</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back"><ArrowLeft size={24} color="#0f172a" /></TouchableOpacity>
        <Text style={styles.hospitalTitle}>{hospital?.name || "Loading..."}</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.mainAddButton} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.mainAddButtonText}>Add Session</Text>
        </TouchableOpacity>

        {loading ? <SkeletonList rows={5} style={{ paddingHorizontal: 0 }} /> : (
          <FlatList
            data={records}
            keyExtractor={(item: any) => item._id}
            renderItem={renderCard}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={<Text style={styles.emptyText}>No records found.</Text>}
          />
        )}
      </View>

      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Session</Text>
            <TextInput style={styles.input} placeholder="Patients" keyboardType="numeric" value={patients} onChangeText={setPatients} />
            <TextInput style={styles.input} placeholder="Income" keyboardType="numeric" value={income} onChangeText={setIncome} />

            {/* Date Picker Trigger */}
            <TouchableOpacity style={styles.dateInputWrapper} onPress={() => setShowDatePicker(true)}>
              <Text>{date.toDateString()}</Text>
              <Calendar size={20} color="#64748b" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if (d) setDate(d); }}
              />
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddRecord}><Text style={{ color: '#fff' }}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <BottomNavBar />
    </SafeAreaView>
  );
}

// Paste your exact styles here...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', gap: 16 },
  hospitalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  content: { flex: 1, padding: 20 },
  mainAddButton: { backgroundColor: '#06B6D4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 8, marginBottom: 24 },
  mainAddButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  listContainer: { paddingBottom: 20 },
  emptyText: { color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  recordCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dateText: { fontSize: 12, color: '#64748b', marginLeft: 6 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between' },
  recordStat: { flex: 1 },
  statLabel: { fontSize: 11, color: '#64748b', marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  statValueBlue: { fontSize: 16, fontWeight: '700', color: '#06B6D4' },
  verticalDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 },
  dateInputWrapper: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 8, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#06B6D4', alignItems: 'center' },
});