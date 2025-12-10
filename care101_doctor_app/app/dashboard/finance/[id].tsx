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

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/finance`;

export default function HospitalDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 
  const [loading, setLoading] = useState(true);
  const [hospital, setHospital] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'channeling' | 'surgical'>('channeling');
  const [modalVisible, setModalVisible] = useState(false);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form Inputs
  const [patients, setPatients] = useState('');
  const [income, setIncome] = useState('');
  const [bht, setBht] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHospital(await res.json());
    } catch (error) {
      console.error(error);
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
          type: activeTab,
          date: date.toISOString(),
          patients: activeTab === 'channeling' ? patients : undefined,
          income: activeTab === 'channeling' ? income : undefined,
          bht: activeTab === 'surgical' ? bht : undefined,
          amount: activeTab === 'surgical' ? amount : undefined
        })
      });
      setModalVisible(false);
      setPatients(''); setIncome(''); setBht(''); setAmount('');
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

  // Filter Data for List
  const records = hospital?.records?.filter((r: any) => r.type === activeTab) || [];

  const renderCard = ({ item }: any) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.dateBadge}>
          <Calendar size={14} color="#64748b" />
          <Text style={styles.dateText}>{new Date(item.date).toDateString()}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteRecord(item._id)}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <View style={styles.recordRow}>
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>{activeTab === 'channeling' ? 'Patients' : 'BHT'}</Text>
          <Text style={styles.statValue}>{activeTab === 'channeling' ? item.patients : item.bht}</Text>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>{activeTab === 'channeling' ? 'Income' : 'Amount'}</Text>
          <Text style={styles.statValueBlue}>{(item.income || item.amount).toLocaleString()} LKR</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color="#0f172a" /></TouchableOpacity>
        <Text style={styles.hospitalTitle}>{hospital?.name || "Loading..."}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'channeling' && styles.tabButtonActive]} onPress={() => setActiveTab('channeling')}>
            <Text style={[styles.tabText, activeTab === 'channeling' && styles.tabTextActive]}>Channeling</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'surgical' && styles.tabButtonActive]} onPress={() => setActiveTab('surgical')}>
            <Text style={[styles.tabText, activeTab === 'surgical' && styles.tabTextActive]}>Surgical</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.mainAddButton} onPress={() => setModalVisible(true)}>
          <Plus size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.mainAddButtonText}>Add {activeTab === 'channeling' ? 'Session' : 'Record'}</Text>
        </TouchableOpacity>

        {loading ? <ActivityIndicator color="#12a9acff" /> : (
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
            <Text style={styles.modalTitle}>Add Record</Text>
            {/* Inputs based on activeTab */}
            {activeTab === 'channeling' ? (
                <>
                    <TextInput style={styles.input} placeholder="Patients" keyboardType="numeric" value={patients} onChangeText={setPatients} />
                    <TextInput style={styles.input} placeholder="Income" keyboardType="numeric" value={income} onChangeText={setIncome} />
                </>
            ) : (
                <>
                    <TextInput style={styles.input} placeholder="BHT Number" value={bht} onChangeText={setBht} />
                    <TextInput style={styles.input} placeholder="Amount" keyboardType="numeric" value={amount} onChangeText={setAmount} />
                </>
            )}
            
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
                    onChange={(e, d) => { setShowDatePicker(Platform.OS === 'ios'); if(d) setDate(d); }} 
                />
            )}

            <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddRecord}><Text style={{color:'#fff'}}>Save</Text></TouchableOpacity>
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
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 4, marginBottom: 24 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabButtonActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1e3a8a' },
  mainAddButton: { backgroundColor: '#12a9acff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 8, marginBottom: 24 },
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
  statValueBlue: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  verticalDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 16 },
  dateInputWrapper: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 8, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#12a9acff', alignItems: 'center' },
});