import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Plus, Maximize2, Pencil } from 'lucide-react-native';

export default function RecordDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  // No Demo Data - UI placeholders only
  
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Surgery</Text>
        </View>
        <TouchableOpacity>
          <Trash2 size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 }]}>
        
        {/* Card 1: Patient Information */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Information</Text>
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Patient Name</Text>
            <Text style={styles.value}>Waiting for data...</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>NIC Number</Text>
            <Text style={styles.value}>-</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Hospital</Text>
            <Text style={styles.value}>-</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Created At</Text>
            <Text style={styles.value}>-</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Last Updated</Text>
            <Text style={styles.value}>-</Text>
          </View>
        </View>

        {/* Card 2: Surgery Cards */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Surgery Cards</Text>
            <TouchableOpacity style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Add New</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          
          <Text style={styles.subHeader}>Surgery Card #1</Text>
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>No Image</Text>
            <TouchableOpacity style={styles.expandIcon}>
              <Maximize2 size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.imageTimestamp}>-</Text>
        </View>

        {/* Card 3: Timeline Entry (Example UI Structure) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Surgery</Text>
            <Text style={styles.entryCount}>0 entries</Text>
          </View>
          <View style={styles.divider} />

          {/* Timeline Item Container */}
          <View style={styles.timelineItem}>
             {/* No data state */}
             <Text style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: 20 }}>
                No surgery progress records yet.
             </Text>
          </View>



        </View>

      </ScrollView>

      {/* FAB for Adding Progress */}
      <TouchableOpacity 
        style={[styles.fab, { bottom: Platform.OS === 'ios' ? insets.bottom + 20 : 30 }]}
        activeOpacity={0.8}
      >
        <Plus size={32} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },

  content: { padding: 16 },

  // Generic Card Style
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  
  // Info Rows
  infoRow: { marginBottom: 12 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  value: { fontSize: 16, color: '#0f172a', fontWeight: '500' },

  // Buttons
  smallBtn: { backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Images Area
  subHeader: { fontSize: 14, color: '#334155', fontWeight: '500', marginBottom: 8 },
  imagePlaceholder: { width: 140, height: 100, backgroundColor: '#0f172a', borderRadius: 8, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  placeholderText: { color: '#cbd5e1', fontSize: 12 },
  expandIcon: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 4 },
  imageTimestamp: { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  // Timeline
  entryCount: { fontSize: 12, color: '#94a3b8' },
  timelineItem: { marginTop: 4 },
  
  // FAB
  fab: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
});