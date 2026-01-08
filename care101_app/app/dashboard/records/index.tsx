import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, StatusBar, Platform,
  ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, Image as ImageIcon, ChevronRight, Lock, Crown } from 'lucide-react-native';
import BottomNavBar from '@/components/BottomNavBar'; 
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function RecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Data State
  const [records, setRecords] = useState([]);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ LOGIC: Check if limit reached (Free plan max 4)
  const isLimitReached = currentPlan === 'free' && records.length >= 4;

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      
      // 1. Fetch Records
      const resRecords = await fetch(`${API_URL}/api/surgery-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resRecords.ok) {
        const data = await resRecords.json();
        setRecords(data);
      }

      // 2. Fetch Profile (to check plan)
      const resProfile = await fetch(`${API_URL}/api/doctor/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resProfile.ok) {
        const profile = await resProfile.json();
        setCurrentPlan(profile.subscription?.plan || 'free');
      }

    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ HANDLE ADD BUTTON
  const handleAddPress = () => {
    if (isLimitReached) {
      Alert.alert(
        "Limit Reached",
        "Free plan allows only 4 records. Upgrade to Premium for unlimited access.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Upgrade Now", onPress: () => router.push('/subscription') }
        ]
      );
    } else {
      router.push('/dashboard/records/create');
    }
  };

  const filteredRecords = records.filter((r: any) => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (r.nic && r.nic.includes(searchQuery))
  );

  const renderRecordItem = ({ item }: any) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/dashboard/records/${item._id}` as any)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.patientName}>{item.name}</Text>
        <ChevronRight size={20} color="#cbd5e1" />
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.detailText}>NIC: {item.nic || 'N/A'}</Text>
        <Text style={styles.detailText}>Hospital: {item.hospital || 'N/A'}</Text>
        <Text style={styles.dateText}>Created: {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.badge}>
          <ImageIcon size={14} color="#3b82f6" style={styles.badgeIcon} />
          <Text style={styles.badgeText}>Surgery Card</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header with Premium Tag */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Surgery Records</Text>
        {currentPlan === 'premium' && (
            <View style={styles.premiumTag}>
                <Crown size={12} color="#b45309" fill="#f59e0b" />
                <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#94a3b8" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search by patient name..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color="#0d9488" style={{marginTop: 50}} /> : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item: any) => item._id}
          renderItem={renderRecordItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No records found</Text>
              {currentPlan === 'free' && (
                  <Text style={styles.emptySubText}>Free Plan: {records.length}/4 used</Text>
              )}
            </View>
          }
        />
      )}

      {/* ✅ FAB (LOCKS IF LIMIT REACHED) */}
      <TouchableOpacity 
        style={[
            styles.fab, 
            { bottom: Platform.OS === 'ios' ? insets.bottom + 90 : 100 },
            isLimitReached && styles.fabDisabled
        ]}
        onPress={handleAddPress}
        activeOpacity={0.8}
      >
        {isLimitReached ? (
            <Lock size={28} color="#94a3b8" />
        ) : (
            <Plus size={32} color="#fff" />
        )}
      </TouchableOpacity>

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  premiumTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  premiumText: { fontSize: 10, fontWeight: '800', color: '#b45309' },

  searchContainer: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#0f172a' },
  listContent: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  patientName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  cardContent: { marginBottom: 12 },
  detailText: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center' },
  badgeIcon: { marginRight: 4 },
  badgeText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94a3b8' },
  emptySubText: { fontSize: 14, color: '#64748b', marginTop: 8 },

  // FAB Styles
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: "#0d9488", shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 4 },
  fabDisabled: { backgroundColor: '#e2e8f0', elevation: 0, shadowOpacity: 0 },
});