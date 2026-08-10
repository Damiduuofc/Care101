import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, StatusBar, Platform,
  ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, Image as ImageIcon, ChevronRight } from 'lucide-react-native';
import BottomNavBar from '@/components/BottomNavBar';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function RecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Data State
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');

      // Fetch Records
      const resRecords = await fetch(`${API_URL}/surgery-records`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resRecords.ok) {
        const data = await resRecords.json();
        setRecords(data);
      }

    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = records.filter((r: any) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.nic && r.nic.includes(searchQuery)) ||
    (r.patientId && r.patientId.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderRecordItem = ({ item }: any) => {
    return (
      <TouchableOpacity
        style={styles.doctorCard}
        onPress={() => router.push(`/dashboard/records/${item._id}` as any)}
      >
        <View style={styles.doctorCardMain}>
          <View style={styles.doctorAvatarContainer}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorNameText}>{item.name}</Text>
            <Text style={styles.specializationText}>SURGERY RECORD</Text>
            <Text style={styles.hospitalText}>Patient ID: {item.patientId || 'N/A'} • NIC: {item.nic || 'N/A'}</Text>
            <Text style={styles.hospitalText}>Hospital: {item.hospital || 'N/A'}</Text>
            <Text style={styles.dateText}>Created: {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <ChevronRight size={20} color="#94a3b8" />
        </View>
        <View style={styles.doctorCardFooter}>
          <View style={styles.badge}>
            <ImageIcon size={14} color="#0d9488" style={styles.badgeIcon} />
            <Text style={styles.badgeText}>Surgery Card</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Surgery Records</Text>
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

      {loading ? <ActivityIndicator size="large" color="#0d9488" style={{ marginTop: 50 }} /> : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item: any) => item._id}
          renderItem={renderRecordItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No records found</Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/dashboard/records/create')}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a' },

  searchContainer: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#0f172a' },
  listContent: { padding: 20 },

  doctorCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  doctorCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doctorAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0f2fe',
    overflow: 'hidden',
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
  },
  doctorInfo: {
    flex: 1,
  },
  doctorNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  specializationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0d9488',
    marginBottom: 4,
  },
  hospitalText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  doctorCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#0d9488',
    fontWeight: '600',
  },

  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94a3b8' },

  // FAB Styles
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  },
});