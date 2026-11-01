import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, ChevronRight, X, Building2, FileText, CreditCard, ClipboardList } from 'lucide-react-native';
import BottomNavBar from '@/components/BottomNavBar';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const COLORS = {
  primary: '#06B6D4',
  primaryDark: '#0891b2',
  light: '#ecfeff',
  text: '#0f172a',
  subtext: '#64748b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  surface: '#f8fafc',
};

const getInitials = (name: string = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

// "SUWASEWANA HOSPITAL" -> "Suwasewana Hospital"
const toTitleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function RecordsScreen() {
  const router = useRouter();

  // Data State
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');

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
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredRecords = records.filter((r: any) =>
    r.name?.toLowerCase().includes(query) ||
    (r.nic && r.nic.toLowerCase().includes(query)) ||
    (r.patientId && r.patientId.toLowerCase().includes(query))
  );

  const renderRecordItem = ({ item }: any) => {
    const entryCount = item.entries?.length ?? 0;
    const updated = formatDate(item.updatedAt || item.createdAt);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/dashboard/records/${item._id}` as any)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {!!item.patientId && (
              <View style={styles.idChip}>
                <Text style={styles.idChipText}>{item.patientId}</Text>
              </View>
            )}
          </View>

          {!!item.hospital && (
            <View style={styles.metaRow}>
              <Building2 size={13} color={COLORS.muted} />
              <Text style={styles.metaText} numberOfLines={1}>{toTitleCase(item.hospital)}</Text>
            </View>
          )}

          <View style={styles.footerRow}>
            <View style={styles.pill}>
              <FileText size={12} color={COLORS.primaryDark} />
              <Text style={styles.pillText}>{entryCount} {entryCount === 1 ? 'entry' : 'entries'}</Text>
            </View>
            {!!item.surgeryCardImage && (
              <View style={styles.pill}>
                <CreditCard size={12} color={COLORS.primaryDark} />
                <Text style={styles.pillText}>Card</Text>
              </View>
            )}
            {!!updated && <Text style={styles.dateText}>{updated}</Text>}
          </View>
        </View>

        <ChevronRight size={18} color="#cbd5e1" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Surgery Records</Text>
        {!loading && (
          <Text style={styles.headerSubtitle}>
            {records.length} {records.length === 1 ? 'patient' : 'patients'}
          </Text>
        )}

        <View style={styles.searchBar}>
          <Search size={18} color={COLORS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, patient ID or NIC"
            placeholderTextColor={COLORS.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10}>
              <X size={18} color={COLORS.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} /> : (
        <FlatList
          data={filteredRecords}
          keyExtractor={(item: any) => item._id}
          renderItem={renderRecordItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <ClipboardList size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No records yet'}</Text>
              <Text style={styles.emptyText}>
                {query ? `Nothing matches "${searchQuery.trim()}".` : 'Tap + to create your first surgery record.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => router.push('/dashboard/records/create')}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 14, color: COLORS.subtext, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    marginTop: 14,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },

  // Leave room for the FAB and bottom nav so the last card is never covered
  listContent: { padding: 16, paddingBottom: 180, gap: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2f6',
    shadowColor: COLORS.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primaryDark },

  cardBody: { flex: 1, marginRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: COLORS.text },
  idChip: { backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  idChipText: { fontSize: 11, fontWeight: '700', color: COLORS.subtext, letterSpacing: 0.3 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { flexShrink: 1, fontSize: 13, color: COLORS.subtext },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.light,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pillText: { fontSize: 11, fontWeight: '600', color: COLORS.primaryDark },
  dateText: { marginLeft: 'auto', fontSize: 12, color: COLORS.muted },

  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 14, color: COLORS.subtext, textAlign: 'center', marginTop: 4 },

  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
});
