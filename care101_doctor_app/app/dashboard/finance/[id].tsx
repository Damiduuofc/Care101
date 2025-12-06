// app/dashboard/finance/[id].tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  ArrowLeft, 
  MoreHorizontal, 
  Plus, 
  Calendar, 
  X,
  Users,
  FileText,
  Trash2
} from 'lucide-react-native';
import BottomNavBar from '@/components/BottomNavBar'; 
import { SafeAreaView } from 'react-native-safe-area-context';
// --- TYPES ---
type ChannelingRecord = {
  id: string;
  date: Date;
  patients: string;
  income: string;
};

type SurgicalRecord = {
  id: string;
  bht: string;
  date: Date;
  amount: string;
};

export default function HospitalDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); 

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'channeling' | 'surgical'>('channeling');
  const [modalVisible, setModalVisible] = useState(false);

  // Data Lists
  const [channelingData, setChannelingData] = useState<ChannelingRecord[]>([]);
  const [surgicalData, setSurgicalData] = useState<SurgicalRecord[]>([]);

  // Form States (Channeling)
  const [cDate, setCDate] = useState(new Date());
  const [cPatients, setCPatients] = useState('');
  const [cIncome, setCIncome] = useState('');

  // Form States (Surgical)
  const [sBht, setSBht] = useState('');
  const [sDate, setSDate] = useState(new Date());
  const [sAmount, setSAmount] = useState('');

  // Date Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);

  // --- MOCK DATA ---
  const hospitalName = "Asiri Surgical"; 
  const whtEnabled = true;

  // --- ACTIONS ---

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      if (activeTab === 'channeling') setCDate(selectedDate);
      else setSDate(selectedDate);
      
      if (Platform.OS === 'android') setShowDatePicker(false);
    }
  };

  const handleAddRecord = () => {
    if (activeTab === 'channeling') {
      if (!cPatients || !cIncome) return;
      const newRecord: ChannelingRecord = {
        id: Date.now().toString(),
        date: cDate,
        patients: cPatients,
        income: cIncome,
      };
      setChannelingData([newRecord, ...channelingData]);
      setCPatients('');
      setCIncome('');
      setCDate(new Date());
    } else {
      if (!sBht || !sAmount) return;
      const newRecord: SurgicalRecord = {
        id: Date.now().toString(),
        bht: sBht,
        date: sDate,
        amount: sAmount,
      };
      setSurgicalData([newRecord, ...surgicalData]);
      setSBht('');
      setSAmount('');
      setSDate(new Date());
    }
    setModalVisible(false);
  };

  const handleDeleteRecord = (recordId: string) => {
    if (activeTab === 'channeling') {
      setChannelingData(channelingData.filter(item => item.id !== recordId));
    } else {
      setSurgicalData(surgicalData.filter(item => item.id !== recordId));
    }
  };

  // --- RENDERERS ---

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'channeling' && styles.tabButtonActive]}
        onPress={() => setActiveTab('channeling')}
      >
        <Text style={[styles.tabText, activeTab === 'channeling' && styles.tabTextActive]}>
          Channeling  .
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tabButton, activeTab === 'surgical' && styles.tabButtonActive]}
        onPress={() => setActiveTab('surgical')}
      >
        <Text style={[styles.tabText, activeTab === 'surgical' && styles.tabTextActive]}>
          Surgical .              
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Data Cards
  const renderChannelingCard = ({ item }: { item: ChannelingRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.dateBadge}>
          <Calendar size={14} color="#64748b" />
          <Text style={styles.dateText}>{item.date.toDateString()}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteRecord(item.id)}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.recordRow}>
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>Patients</Text>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <Users size={14} color="#2563eb" style={{marginRight:4}} />
            <Text style={styles.statValue}>{item.patients}</Text>
          </View>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>Income</Text>
          <Text style={styles.statValueBlue}>
            {item.income ? parseInt(item.income).toLocaleString() : '0'} LKR
          </Text>
        </View>
      </View>
    </View>
  );

  const renderSurgicalCard = ({ item }: { item: SurgicalRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.dateBadge}>
          <Calendar size={14} color="#64748b" />
          <Text style={styles.dateText}>{item.date.toDateString()}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteRecord(item.id)}>
          <Trash2 size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.recordRow}>
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>BHT Number</Text>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <FileText size={14} color="#2563eb" style={{marginRight:4}} />
            <Text style={styles.statValue}>{item.bht}</Text>
          </View>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.recordStat}>
          <Text style={styles.statLabel}>Amount</Text>
          <Text style={styles.statValueBlue}>
            {item.amount ? parseInt(item.amount).toLocaleString() : '0'} LKR
          </Text>
        </View>
      </View>
    </View>
  );

  // Modal
  const renderModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={modalVisible}
      onRequestClose={() => setModalVisible(false)}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeTab === 'channeling' ? 'Add Channeling Session' : 'Add Surgical Finance'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <X size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* DATE PICKER */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              {activeTab === 'channeling' ? 'Date *' : 'Date of Surgery *'}
            </Text>
            <TouchableOpacity 
              style={styles.dateInputWrapper}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.inputNoBorder}>
                {activeTab === 'channeling' ? cDate.toDateString() : sDate.toDateString()}
              </Text>
              <Calendar size={20} color="#64748b" />
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={activeTab === 'channeling' ? cDate : sDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            )}
          </View>

          {activeTab === 'channeling' ? (
            /* --- CHANNELING FORM --- */
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Number of Patients *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter number of patients"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={cPatients}
                  onChangeText={setCPatients}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Total Income (LKR) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter total income"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={cIncome}
                  onChangeText={setCIncome}
                />
              </View>
            </>
          ) : (
            /* --- SURGICAL FORM --- */
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Patient BHT Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter BHT number"
                  placeholderTextColor="#94a3b8"
                  value={sBht}
                  onChangeText={setSBht}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Total Amount (LKR) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter total amount"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                  value={sAmount}
                  onChangeText={setSAmount}
                />
              </View>
            </>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity 
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={handleAddRecord}
            >
              <Text style={styles.saveBtnText}>
                {activeTab === 'channeling' ? 'Add Session' : 'Add Record'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* --- HEADER --- */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.hospitalTitle}>{hospitalName}</Text>
            {whtEnabled && <Text style={styles.whtStatus}>WHT Enabled (5%)</Text>}
          </View>
        </View>
        <TouchableOpacity>
          <MoreHorizontal size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        
        {/* --- TABS --- */}
        {renderTabs()}

        {/* --- MAIN ACTION BUTTON --- */}
        <TouchableOpacity 
          style={styles.mainAddButton}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.mainAddButtonText}>
            {activeTab === 'channeling' ? 'Add Channeling Record' : 'Add Surgical Record'}
          </Text>
        </TouchableOpacity>

        {/* --- DYNAMIC LIST AREA --- */}
        <View style={styles.listArea}>
          <Text style={styles.sectionHeader}>
            {activeTab === 'channeling' ? 'Channeling History' : 'Surgical Records'}
          </Text>
          
          {/* FIX: We render separate FlatLists conditionally. 
            This prevents Type Mismatch errors and Virtualization issues.
          */}
          {activeTab === 'channeling' ? (
            <FlatList
              data={channelingData}
              keyExtractor={(item) => item.id}
              renderItem={renderChannelingCard}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No channeling records yet.    </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={surgicalData}
              keyExtractor={(item) => item.id}
              renderItem={renderSurgicalCard}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No surgical records yet.     </Text>
                </View>
              }
            />
          )}
        </View>
      </View>

      {renderModal()}
<BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginRight: 16 },
  hospitalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  whtStatus: { fontSize: 12, color: '#10b981', fontWeight: '500' },
  content: { flex: 1, padding: 20 },
  
  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 8, padding: 4, marginBottom: 24 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  tabButtonActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#1e3a8a' },

  // Add Button
  mainAddButton: { backgroundColor: '#12a9acff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 8, marginBottom: 24, shadowColor: '#1e40af', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  mainAddButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // List Area
  listArea: { flex: 1 },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  listContainer: { paddingBottom: 20 },
  emptyState: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontStyle: 'italic' },

  // Record Cards
  recordCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  dateText: { fontSize: 12, color: '#64748b', marginLeft: 6, fontWeight: '500' },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between' },
  recordStat: { flex: 1 },
  statLabel: { fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  statValueBlue: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  verticalDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#0f172a' },
  
  // Date Picker Button Style
  dateInputWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12 },
  inputNoBorder: { fontSize: 16, color: '#0f172a' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: '#12a9acff', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});