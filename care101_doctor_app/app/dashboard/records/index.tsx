import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, CreditCard, Image as ImageIcon, ChevronRight } from 'lucide-react-native';
import BottomNavBar from '@/components/BottomNavBar'; 

// Interface for type safety (UI skeleton)
interface Record {
  id: string;
  name: string;
  nic: string;
  hospital: string;
  createdAt: string;
  cardCount: number;
  imageCount: number;
}

export default function RecordsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // State is initialized empty as requested (No demo data)
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<Record[]>([]); 

  const renderRecordItem = ({ item }: { item: Record }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/dashboard/records/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.patientName}>{item.name}</Text>
        <ChevronRight size={20} color="#cbd5e1" />
      </View>
      
      <View style={styles.cardContent}>
        <Text style={styles.detailText}>NIC: {item.nic || 'N/A'}</Text>
        <Text style={styles.detailText}>Hospital: {item.hospital || 'N/A'}</Text>
        <Text style={styles.dateText}>Created: {item.createdAt}</Text>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.badge}>
          <CreditCard size={14} color="#10b981" style={styles.badgeIcon} />
          <Text style={styles.badgeText}>{item.cardCount} card</Text>
        </View>
        <View style={styles.badge}>
          <ImageIcon size={14} color="#3b82f6" style={styles.badgeIcon} />
          <Text style={styles.badgeText}>{item.imageCount} images</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Surgery Records</Text>
        <Text style={styles.headerSubtitle}>Smart Care, Starts Here</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={20} color="#94a3b8" />
          <TextInput 
            style={styles.searchInput}
            placeholder="Search by patient name or NIC..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderRecordItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No records found</Text>
            <Text style={styles.emptySubText}>
              Create surgery records for your patients and track their pre-operative and post-operative progress
            </Text>
          </View>
        }
      />

      <TouchableOpacity 
        style={[styles.fab, { bottom: Platform.OS === 'ios' ? insets.bottom + 90 : 100 }]}
        onPress={() => router.push('/dashboard/records/create')}
        activeOpacity={0.8}
      >
        <Plus size={32} color="#fff" />
      </TouchableOpacity>

      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, backgroundColor: '#fff' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  
  searchContainer: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#0f172a' },

  listContent: { padding: 20 },
  
  // Card Styles
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  patientName: { fontSize: 18, fontWeight: '700', color: '#0f172a', letterSpacing: 0.5 },
  cardContent: { marginBottom: 12 },
  detailText: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center' },
  badgeIcon: { marginRight: 4 },
  badgeText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  emptySubText: { fontSize: 14, color: '#cbd5e1', textAlign: 'center', lineHeight: 20 },

  // FAB
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
});