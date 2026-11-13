import { SkeletonList } from '../../components/Skeleton';
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Alert,
  RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, ChevronRight } from 'lucide-react-native';
import BottomNavBar from '../../components/BottomNavBar';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const REFRESH_INTERVAL = 30000; // Auto-refresh every 30 seconds

export default function FinanceScreen() {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Added <any[]> to fix TypeScript errors
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();

      intervalRef.current = setInterval(() => {
        fetchData(true); 
      }, REFRESH_INTERVAL);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [])
  );

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const token = await SecureStore.getItemAsync('token');

      const resFinance = await fetch(`${API_URL}/finance`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (resFinance.ok) {
        const data = await resFinance.json();
        setHospitals(data);
      } else {
        const errorText = await resFinance.text();
        console.error('Finance API error:', resFinance.status, errorText);
      }
    } catch (error) {
      console.error("Network Error:", error);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Added type definition for 'id'
  const handleDelete = async (id: string) => {
    Alert.alert("Delete Hospital", "Are you sure? This will delete all financial records for this hospital.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: 'destructive', onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('token');
            await fetch(`${API_URL}/finance/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
          } catch (error) { console.error(error); }
        }
      }
    ]);
  };

  // Added type definition for 'item'
  const renderHospitalCard = ({ item }: { item: any }) => {
    
    // Channeling only — surgical finance is no longer tracked
    const safeTotal = item.channelingIncome || 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.hospitalName}>{item.name}</Text>
          </View>
          {item.name !== 'Suwasevana' && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => handleDelete(item.id)} accessibilityRole="button" accessibilityLabel="Delete">
              <Trash2 size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.totalSection}>
          <View>
            <Text style={styles.totalLabel}>Channeling Income</Text>
          </View>
          <Text style={styles.totalValue}>{Math.round(safeTotal).toLocaleString()} LKR</Text>
        </View>

        <TouchableOpacity
          style={styles.cardFooter}
          onPress={() => router.push(`/dashboard/finance/${item.id}` as any)}
        >
          <Text style={styles.footerLink}>View & Add Records</Text>
          <ChevronRight size={16} color="#06B6D4" />
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
        <SkeletonList rows={5} />
      ) : (
        <FlatList
          data={hospitals}
          renderItem={renderHospitalCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#06B6D4']}
              tintColor="#06B6D4"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Hospitals Added</Text>
              <Text style={{ color: '#64748b', marginBottom: 20 }}>Your channeling income will appear here.</Text>
            </View>
          }
        />
      )}

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
  iconBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 8 },
  totalSection: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1e3a8a' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  footerLink: { color: '#06B6D4', fontWeight: '600', marginRight: 4, fontSize: 14 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 20, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#334155', marginBottom: 8 },
});