import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ChevronRight } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import BottomNavBar from '../../../components/BottomNavBar';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// ✅ 1. Define the Interface (Tells TypeScript what data looks like)
interface Instruction {
  _id: string;
  surgeryName: string;
  description?: string;
}

export default function InstructionsList() {
  const router = useRouter();
  
  // ✅ 2. Use the Interface in useState
  const [list, setList] = useState<Instruction[]>([]); 
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  const fetchAll = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/instructions`, { 
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setList(data);
      }
    } catch(e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAdd = () => {
    router.push('/dashboard/instructions/create');
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#f8fafc'}}>
      <View style={styles.header}>
        <Text style={styles.title}>My Instructions</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0891b2" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: 100 }}
          // ✅ 3. Typed 'item' prevents the "surgeryName is error"
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card} 
              onPress={() => router.push(`/dashboard/instructions/${item._id}`)}
            >
              {/* Fallback text in case database has old blank data */}
              <Text style={styles.cardTitle}>
                {item.surgeryName || "Untitled Surgery"}
              </Text>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{textAlign:'center', marginTop: 50, color:'#94a3b8'}}>
              No instructions created yet.
            </Text>
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleAdd}
        activeOpacity={0.8}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>
      
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  card: { flexDirection: 'row', justifyContent:'space-between', padding: 20, marginHorizontal: 20, marginBottom: 10, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0891b2', alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: "#0891b2", shadowOffset: {width:0, height:4}, shadowOpacity: 0.3, shadowRadius: 4 }
});