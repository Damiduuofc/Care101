import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Switch,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router'; 
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; // Updated Import
import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  X,
  BarChart3,
  Activity,
  FileText
} from 'lucide-react-native';
import BottomNavBar from '../../components/BottomNavBar'; 

// --- TYPES ---
type Hospital = {
  id: string;
  name: string;
  whtEnabled: boolean;
  channelingIncome: number;
  surgicalIncome: number;
  totalPayable: number;
};

// --- DATA ---
const INITIAL_DATA: Hospital[] = [
  {
    id: '1',
    name: 'Asiri Surgical',
    whtEnabled: true,
    channelingIncome: 15000,
    surgicalIncome: 45000,
    totalPayable: 57000, 
  }
];

export default function FinanceScreen() {
  const router = useRouter(); 
  const pathname = usePathname(); 
  const insets = useSafeAreaInsets(); // Get safe area dimensions

  const [hospitals, setHospitals] = useState<Hospital[]>(INITIAL_DATA);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [newHospitalName, setNewHospitalName] = useState('');
  const [isWhtEnabled, setIsWhtEnabled] = useState(false);

  // --- ACTIONS ---
  const handleAddHospital = () => {
    if (!newHospitalName.trim()) return;

    const newHospital: Hospital = {
      id: Date.now().toString(),
      name: newHospitalName,
      whtEnabled: isWhtEnabled,
      channelingIncome: 0,
      surgicalIncome: 0,
      totalPayable: 0,
    };

    setHospitals([...hospitals, newHospital]);
    setNewHospitalName('');
    setIsWhtEnabled(false);
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    setHospitals(hospitals.filter(h => h.id !== id));
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Building2 size={48} color="#cbd5e1" strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>No Hospitals Added</Text>
      <Text style={styles.emptySubtitle}>
        Add hospitals where you conduct channeling sessions and surgeries
      </Text>
      <TouchableOpacity 
        style={styles.mainActionButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.mainActionButtonText}>Add Your First</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHospitalCard = ({ item }: { item: Hospital }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.hospitalName}>{item.name}</Text>
          {item.whtEnabled && (
            <View style={styles.whtBadge}>
              <CheckCircle2 size={14} color="#10b981" />
              <Text style={styles.whtText}>WHT Enabled (5%)</Text>
            </View>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Pencil size={18} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Channeling</Text>
          <Text style={styles.statValueBlue}>
            {item.channelingIncome.toLocaleString()} LKR
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Surgical</Text>
          <Text style={styles.statValueBlue}>
            {item.surgicalIncome.toLocaleString()} LKR
          </Text>
        </View>
      </View>

      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Payable</Text>
        <Text style={styles.totalValue}>
          {item.totalPayable.toLocaleString()} LKR
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.cardFooter}
        onPress={() => router.push(`/dashboard/finance/${item.id}` as any)}
      >
        <Text style={styles.footerLink}>View Details   </Text>
        <ChevronRight size={16} color="#12a9acff" />
      </TouchableOpacity>
    </View>
  );

  return (
    // Only apply top safe area, let bottom be handled by content padding
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* --- PAGE HEADER --- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Tracking</Text>
        <Text style={styles.headerSubtitle}>Smart Care, Starts Here</Text>
      </View>

      {/* --- CONTENT AREA --- */}
      <View style={styles.content}>
        <FlatList
          data={hospitals}
          keyExtractor={(item) => item.id}
          renderItem={renderHospitalCard}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[styles.listContent, { paddingBottom: 150 }]}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* --- FAB --- */}
      {/* Fix: Moved FAB up dynamically based on device safe area */}
      <TouchableOpacity 
        style={[
          styles.fab, 
          { bottom: Platform.OS === 'ios' ? insets.bottom + 90 : 100 }
        ]} 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Plus size={32} color="#fff" />
      </TouchableOpacity>

      {/* --- ADD MODAL --- */}
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
              <Text style={styles.modalTitle}>Add Hospital</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hospital Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter hospital name"
                placeholderTextColor="#94a3b8"
                value={newHospitalName}
                onChangeText={setNewHospitalName}
                autoFocus={true}
              />
            </View>

            <View style={styles.switchContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Enable WHT Deduction</Text>
                <Text style={styles.switchSubLabel}>5% will be deducted from total income</Text>
              </View>
              <Switch
                trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
                thumbColor={isWhtEnabled ? "#2563eb" : "#f4f4f5"}
                onValueChange={setIsWhtEnabled}
                value={isWhtEnabled}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addBtn}
                onPress={handleAddHospital}
              >
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* --- NAV BAR --- */}
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  
  content: { flex: 1 },
  listContent: { paddingTop: 20 }, // Added top padding for aesthetics

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 40 },
  emptyIconCircle: { width: 80, height: 80, backgroundColor: '#f1f5f9', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#334155', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  mainActionButton: { backgroundColor: '#12a9acff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8, elevation: 2, shadowColor: '#12a9acff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 4 },
  mainActionButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },

  // Hospital Card
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  hospitalName: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  whtBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  whtText: { fontSize: 12, color: '#10b981', marginLeft: 4, fontWeight: '500' },
  cardActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 }, // Added background to icons for easier tapping

  // Stats
  statsGrid: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 12 },
  statCol: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#cbd5e1', marginVertical: 4 },
  statLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  statValueBlue: { fontSize: 16, fontWeight: '700', color: '#12a9acff' },
  
  // Total
  totalSection: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1e3a8a' },
  
  // Footer
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  footerLink: { color: '#12a9acff', fontWeight: '600', marginRight: 4, fontSize: 14 },

  // FAB (Position is now handled inline)
  fab: { position: 'absolute', right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#12a9acff', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 5, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.25, shadowRadius: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#0f172a', backgroundColor: '#f8fafc' },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  switchSubLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontWeight: '600', fontSize: 16 },
  addBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#12a9acff', alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});