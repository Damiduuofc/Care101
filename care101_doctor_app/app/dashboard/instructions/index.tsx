import React, { useState, useCallback } from 'react';
import { View, FlatList, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ChevronRight, Lock } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import BottomNavBar from '../../../components/BottomNavBar';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function InstructionsList() {
  const router = useRouter();
  const [list, setList] = useState([]);
  const [plan, setPlan] = useState('free');
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchAll(); }, []));

  const fetchAll = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      // 1. Fetch List
      const res = await fetch(`${API_URL}/api/instructions`, { headers: { Authorization: `Bearer ${token}` }});
      const data = await res.json();
      setList(data);
      // 2. Fetch Plan
      const resP = await fetch(`${API_URL}/api/doctor/profile`, { headers: { Authorization: `Bearer ${token}` }});
      const prof = await resP.json();
      setPlan(prof.subscription?.plan || 'free');
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  // ✅ FREE PLAN LIMIT: 1 Instruction Set
  const isLimitReached = plan === 'free' && list.length >= 1;

  const handleAdd = () => {
    if (isLimitReached) {
      Alert.alert("Limit Reached", "Free plan users can only create 1 instruction set. Upgrade for unlimited.", [
        { text: "Cancel", style: "cancel" },
        { text: "Upgrade", onPress: () => router.push('/subscription') }
      ]);
    } else {
      router.push('/dashboard/instructions/create');
    }
  };

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#f8fafc'}}>
      <View style={styles.header}><Text style={styles.title}>My Instructions</Text></View>

      {loading ? <ActivityIndicator style={{marginTop: 50}} /> : (
        <FlatList
          data={list}
          keyExtractor={(item:any) => item._id}
          renderItem={({item}) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/dashboard/instructions/${item._id}`)}>
              <Text style={styles.cardTitle}>{item.surgeryName}</Text>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{textAlign:'center', marginTop: 50, color:'#94a3b8'}}>No instructions created yet.</Text>}
        />
      )}

      <TouchableOpacity style={[styles.fab, isLimitReached && {backgroundColor: '#cbd5e1'}]} onPress={handleAdd}>
        {isLimitReached ? <Lock size={24} color="#fff" /> : <Plus size={24} color="#fff" />}
      </TouchableOpacity>
      
      <BottomNavBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  card: { flexDirection: 'row', justifyContent:'space-between', padding: 20, marginHorizontal: 20, marginBottom: 10, backgroundColor: '#fff', borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#334155' },
  fab: { position: 'absolute', bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0891b2', alignItems: 'center', justifyContent: 'center', elevation: 5 }
});