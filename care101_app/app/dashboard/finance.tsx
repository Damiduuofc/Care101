import React, { useState, useCallback } from 'react';
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
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router'; 
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2, ChevronRight, CheckCircle2, X } from 'lucide-react-native';
import BottomNavBar from '../../components/BottomNavBar'; 
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function FinanceScreen() {
  const router = useRouter(); 
  const insets = useSafeAreaInsets();
  
  // Data State
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [newHospitalName, setNewHospitalName] = useState('');
  const [isWhtEnabled, setIsWhtEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      
      const resFinance = await fetch(`${API_URL}/finance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (resFinance.ok) {
        const data = await resFinance.json();
        setHospitals(data);
      }
    } catch (error) {
      console.error("Network Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHospital = async () => {
    if (!newHospitalName.trim()) {
      Alert.alert("Required", "Please enter a hospital name.");
      return;
    }
    
    setIsSubmitting(true);

    try {
      const token = await SecureStore.getItemAsync('token');
      
      const response = await fetch(`${API_URL}/api/finance/add-hospital`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          name: newHospitalName, 
          whtEnabled: isWhtEnabled 
        })
      });

      // Parse the response to get the specific error message
      const resData = await response.json();

      if (response.ok) {
        // Success: Refresh data and close modal
        await fetchData(); 
        setModalVisible(false);
        setNewHospitalName('');
        setIsWhtEnabled(false);
      } else {
        // Failure: Show the actual message from backend
        console.error("Server Error:", resData);
        Alert.alert("Error", resData.message || resData.error || "Failed to add hospital.");
      }

    } catch (error) {
      console.error("Network Error:", error);
      Alert.alert("Connection Error", "Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert("Delete Hospital", "Are you sure? This will delete all financial records for this hospital.", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", style: 'destructive', onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('token');
            await fetch(`${API_URL}/api/finance/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
          } catch (error) { console.error(error); }
        } 
      }
    ]);
  };

  const renderHospitalCard = ({ item }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.hospitalName}>{item.name}</Text>
            {item.whtEnabled && (
              <View style={styles.whtBadge}>
                <CheckCircle2 size={14} color="#10b981" />
                <Text style={styles.whtText}>WHT Enabled (-5%)</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
              style={styles.iconBtn} 
              onPress={() => handleDelete(item.id)}
            >
              <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Channeling</Text>
            <Text style={styles.statValueBlue}>{item.channelingIncome?.toLocaleString() || 0} LKR</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statLabel}>Surgical</Text>
            <Text style={styles.statValueBlue}>{item.surgicalIncome?.toLocaleString() || 0} LKR</Text>
          </View>
        </View>

        <View style={styles.totalSection}>
          <View>
            <Text style={styles.totalLabel}>Total Payable</Text>
            {item.whtEnabled && (
               <Text style={styles.taxLabel}>(After 5% Tax Deduction)</Text>
            )}
          </View>
          <Text style={styles.totalValue}>{Math.round(item.totalPayable || 0).toLocaleString()} LKR</Text>
        </View>

        <TouchableOpacity 
          style={styles.cardFooter}
          onPress={() => router.push(`/dashboard/finance/${item.id}`)}
        >
          <Text style={styles.footerLink}>View & Add Records</Text>
          <ChevronRight size={16} color="#12a9acff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Financial Dashboard</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#12a9acff" style={{marginTop: 50}} />
      ) : (
        <FlatList 
          data={hospitals}
          renderItem={renderHospitalCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Hospitals Added</Text>
              <Text style={{color: '#64748b', marginBottom: 20}}>Add a hospital to start tracking finances.</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
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

      {/* Add Hospital Modal */}
      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Hospital</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}><X size={24} color="#64748b" /></TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Hospital Name</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Enter name" 
                value={newHospitalName} 
                onChangeText={setNewHospitalName} 
              />
            </View>
            
            <View style={styles.switchContainer}>
              <View style={{flex: 1}}>
                <Text style={styles.switchLabel}>Enable WHT (5%)</Text>
                <Text style={styles.switchSubLabel}>5% will be automatically deducted from Total Payable</Text>
              </View>
              <Switch 
                trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }} 
                thumbColor={isWhtEnabled ? "#2563eb" : "#f4f4f5"} 
                onValueChange={setIsWhtEnabled} 
                value={isWhtEnabled} 
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.addBtn, isSubmitting && { opacity: 0.7 }]} 
              onPress={handleAddHospital}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.addBtnText}>Add</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  
  listContent: { paddingTop: 20, paddingBottom: 150 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  hospitalName: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
  whtBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  whtText: { fontSize: 12, color: '#10b981', marginLeft: 4, fontWeight: '500' },
  iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 },
  statsGrid: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 12 },
  statCol: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#cbd5e1', marginVertical: 4 },
  statLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  statValueBlue: { fontSize: 16, fontWeight: '700', color: '#12a9acff' },
  totalSection: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  taxLabel: { fontSize: 10, color: '#64748b', fontStyle: 'italic' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1e3a8a' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  footerLink: { color: '#12a9acff', fontWeight: '600', marginRight: 4, fontSize: 14 },
  
  fab: { position: 'absolute', right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#12a9acff', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: "#12a9acff", shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, backgroundColor: '#f8fafc' },
  switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  switchSubLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  addBtn: { paddingVertical: 16, borderRadius: 12, backgroundColor: '#12a9acff', alignItems: 'center', height: 56, justifyContent: 'center' },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#334155', marginBottom: 8 },
});