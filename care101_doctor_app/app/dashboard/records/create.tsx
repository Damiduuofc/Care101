import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, StatusBar,
  KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';

// Change the API_URL at the top
const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/surgery-records/create`;
export default function CreateRecordScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [nic, setNic] = useState('');
  const [hospital, setHospital] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5, // ⚠️ Reduce quality to prevent huge payload
        base64: true, // ✅ Vital: We need base64 for MongoDB
      });

      if (!result.canceled) {
        setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    } catch (error) {
      Alert.alert("Error", "Could not pick image");
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !image) {
      Alert.alert("Required", "Please provide a Patient Name and a Surgery Card Image.");
      return;
    }

    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name, nic, hospital, surgeryCardImage: image
        })
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", "Record Created!");
        router.back();
      } else {
        Alert.alert("Error", data.msg || "Failed to create record");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Network Error. Check image size.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Record</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>Patient Name *</Text>
            <TextInput style={styles.input} placeholder="Enter Name" value={name} onChangeText={setName} />
            
            <Text style={styles.label}>NIC (Optional)</Text>
            <TextInput style={styles.input} placeholder="Enter NIC" value={nic} onChangeText={setNic} />
            
            <Text style={styles.label}>Hospital</Text>
            <TextInput style={styles.input} placeholder="Enter Hospital" value={hospital} onChangeText={setHospital} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Surgery Card *</Text>
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={{alignItems: 'center'}}>
                    <Camera size={40} color="#94a3b8" />
                    <Text style={styles.uploadText}>Tap to Upload</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.createBtn, loading && styles.disabledBtn]} onPress={handleCreate} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Create Record</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Paste exact styles from your file...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  content: { padding: 20 },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 14, color: '#334155', marginBottom: 8, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 16, backgroundColor: '#fff' },
  uploadBox: { borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 12, height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', overflow: 'hidden' },
  uploadText: { marginTop: 16, fontSize: 14, color: '#475569' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  createBtn: { borderRadius: 8, paddingVertical: 16, alignItems: 'center', backgroundColor: '#2563eb' },
  disabledBtn: { backgroundColor: '#94a3b8' },
  createBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});