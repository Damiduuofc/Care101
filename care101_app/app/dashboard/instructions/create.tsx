import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Info } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

// ✅ 1. Add Fallback to prevent crash if Env is missing
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function CreateInstructionScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert("Required", "Please enter a surgery name.");
      return;
    }

    setLoading(true);
    try {
      // ✅ 2. Debugging: Print URL to Console
      const fullUrl = `${API_URL}/api/instructions`;
      console.log("🚀 Attempting to connect to:", fullUrl);

      // Check if API_URL is missing
      if (!API_URL) {
        Alert.alert("Configuration Error", "API_URL is missing in .env file");
        setLoading(false);
        return;
      }

      const token = await SecureStore.getItemAsync('token');
      
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ surgeryName: name, description: desc })
      });

      // ✅ 3. Handle Non-OK Responses
      if (res.ok) {
        const data = await res.json();
        console.log("✅ Success:", data);
        router.replace(`/dashboard/instructions/${data._id}` as any);
      } else {
        // Log Server Error Text
        const errorText = await res.text();
        console.error("❌ Server Error:", res.status, errorText);
        Alert.alert("Error", `Server returned: ${res.status}`);
      }

    } catch (error: any) {
      // ✅ 4. Catch Network Errors
      console.error("🔥 NETWORK ERROR:", error);
      Alert.alert("Connection Failed", "Could not reach the server. Check your internet or API URL.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Surgery Instructions</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Surgery Name</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter surgery name" 
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Enter description" 
            placeholderTextColor="#94a3b8"
            value={desc}
            onChangeText={setDesc}
          />
        </View>

        <View style={styles.infoBox}>
          <Info size={20} color="#2563eb" style={{marginTop: 2}} />
          <Text style={styles.infoText}>
            After creating the surgery, you'll be able to upload Pre-Operative and Post-Operative instructions including videos, audio files, and documents.
          </Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  content: { padding: 24 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 16, fontSize: 16, color: '#0f172a' },
  infoBox: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 30, gap: 12 },
  infoText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 20 },
  saveBtn: { backgroundColor: '#0891b2', paddingVertical: 18, borderRadius: 12, alignItems: 'center' }, // Fixed Color
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});