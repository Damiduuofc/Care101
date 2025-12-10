import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar, 
  Platform, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Calendar, Plus, Camera, Info, X } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker'; 

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/surgery-records`;

export default function RecordDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  
  // ✅ 1. PERMISSION HOOK (Crucial)
  const [permissionResponse, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageExpanded, setImageExpanded] = useState(false);
  
  // --- ADD ENTRY STATE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [entryNotes, setEntryNotes] = useState('');
  const [entryImage, setEntryImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRecordDetails();
  }, [id]);

  const fetchRecordDetails = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecord(data);
      } else {
        Alert.alert("Error", "Record not found");
        router.back();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

const pickEntryImage = async () => {
    // 1. Check Permissions
    if (permissionResponse?.status !== 'granted') {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Permission Required", "Please allow access to photos to upload images.");
        return;
      }
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        // ❌ REMOVE THIS (It caused the crash):
        // mediaTypes: ImagePicker.MediaType.Images, 

        // ✅ USE THIS (It works, ignore the warning for now):
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setEntryImage(base64Img);
      }
    } catch (error) {
      console.error("Image Picker Error:", error);
      Alert.alert("Error", "Could not pick image. Check logs.");
    }
  };
const handleAddEntry = async () => {
    if (!entryImage && !entryNotes) {
      Alert.alert("Empty Entry", "Please add an image or notes.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      
      // 1. Log what we are sending
      console.log("Sending Entry to:", `${API_URL}/${id}/entry`);
      
      const res = await fetch(`${API_URL}/${id}/entry`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          notes: entryNotes,
          images: entryImage ? [entryImage] : []
        })
      });

      // 2. See what the server replies
      const text = await res.text();
      console.log("SERVER RESPONSE:", text);

      if (res.ok) {
        Alert.alert("Success", "Entry Added!");
        setModalVisible(false);
        setEntryNotes('');
        setEntryImage(null);
        fetchRecordDetails(); 
      } else {
        // Show the real error message from the server
        Alert.alert("Error", `Server says: ${text}`);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Network Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete Record", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          try {
              const token = await SecureStore.getItemAsync('token');
              const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
              if (res.ok) router.back();
          } catch(e) {}
      }}
    ]);
  };

  if (loading) return <ActivityIndicator style={{marginTop: 50}} size="large" color="#0f172a" />;
  if (!record) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{record.name}</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Trash2 size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Card 1: Patient Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patient Details</Text>
          <View style={styles.divider} />
          <View style={styles.rowContainer}>
            <View style={{flex:1}}>
                <Text style={styles.label}>Hospital</Text>
                <Text style={styles.value}>{record.hospital || "N/A"}</Text>
            </View>
            <View style={{flex:1}}>
                <Text style={styles.label}>NIC</Text>
                <Text style={styles.value}>{record.nic || "N/A"}</Text>
            </View>
          </View>
        </View>

        {/* Card 2: Main Surgery Card */}
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Surgery Card (Original)</Text>
            <View style={styles.divider} />
             <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => setImageExpanded(!imageExpanded)}
              style={[styles.imageContainer, imageExpanded && styles.imageContainerExpanded]}
            >
              <Image source={{ uri: record.surgeryCardImage }} style={styles.cardImage} resizeMode="cover" />
            </TouchableOpacity>
        </View>

        {/* SECTION: PROGRESS ENTRIES (Timeline) */}
        <View style={styles.timelineHeader}>
            <Text style={styles.sectionHeader}>Recovery Progress</Text>
        </View>

        {record.entries && record.entries.length > 0 ? (
            record.entries.map((entry: any, index: number) => (
                <View key={index} style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                        <Calendar size={14} color="#64748b" />
                        <Text style={styles.entryDate}>{new Date(entry.date).toLocaleString()}</Text>
                    </View>
                    
                    {entry.images && entry.images.length > 0 && (
                        <Image source={{ uri: entry.images[0] }} style={styles.entryImage} />
                    )}
                    
                    {entry.notes ? (
                        <Text style={styles.entryNotes}>{entry.notes}</Text>
                    ) : null}
                </View>
            ))
        ) : (
            <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No progress updates yet.</Text>
            </View>
        )}

      </ScrollView>

      {/* FAB Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus size={32} color="#fff" />
      </TouchableOpacity>


      {/* --- ADD ENTRY MODAL --- */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text style={styles.modalTitle}>Add Surgery Entry</Text>
                    <View style={{width: 50}} /> 
                </View>

                <ScrollView contentContainerStyle={{padding: 20}}>
                    
                    {/* Image Picker Area */}
                    <Text style={styles.inputLabel}>Progress Images</Text>
                    <View style={styles.imagePickerBox}>
                        {entryImage ? (
                            <View style={{width:'100%', height: '100%'}}>
                                <Image source={{ uri: entryImage }} style={{width:'100%', height: '100%', borderRadius: 8}} resizeMode="cover" />
                                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setEntryImage(null)}>
                                    <X size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{alignItems:'center'}}>
                                <Camera size={40} color="#cbd5e1" style={{marginBottom: 10}} />
                                <Text style={styles.placeholderText}>No Images Added</Text>
                                <TouchableOpacity style={styles.addImageBtn} onPress={pickEntryImage}>
                                    <Text style={styles.addImageText}>Add Image</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Notes Area */}
                    <Text style={styles.inputLabel}>Notes</Text>
                    <TextInput 
                        style={styles.textArea} 
                        multiline 
                        numberOfLines={4} 
                        placeholder="Type notes here..." 
                        value={entryNotes}
                        onChangeText={setEntryNotes}
                    />

                    {/* Info Box */}
                    <View style={styles.infoBox}>
                        <Info size={20} color="#2563eb" style={{marginRight: 10}} />
                        <View style={{flex: 1}}>
                            <Text style={styles.infoTitle}>Treatment Progression</Text>
                            <Text style={styles.infoDesc}>
                                Document the patient's recovery progress by adding progress images and notes.
                            </Text>
                        </View>
                    </View>

                </ScrollView>

                {/* Save Button */}
                <View style={styles.modalFooter}>
                    <TouchableOpacity 
                        style={[styles.saveBtn, submitting && styles.disabledBtn]} 
                        onPress={handleAddEntry}
                        disabled={submitting}
                    >
                        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </TouchableOpacity>
                </View>

            </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  deleteBtn: { padding: 8, backgroundColor: '#fee2e2', borderRadius: 8 },
  content: { padding: 20, paddingBottom: 100 },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  rowContainer: { flexDirection: 'row', gap: 16 },
  label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  value: { fontSize: 16, color: '#0f172a', fontWeight: '600' },
  
  imageContainer: { width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  imageContainerExpanded: { height: 400 },
  cardImage: { width: '100%', height: '100%' },

  // Timeline
  timelineHeader: { marginBottom: 12, marginTop: 10 },
  sectionHeader: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  entryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  entryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  entryDate: { fontSize: 12, color: '#64748b', marginLeft: 6, fontWeight: '500' },
  entryImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 8, backgroundColor: '#f1f5f9' },
  entryNotes: { fontSize: 14, color: '#334155', lineHeight: 20 },
  emptyState: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#94a3b8', fontStyle: 'italic' },

  // FAB
  fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', elevation: 6 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  cancelText: { fontSize: 16, color: '#2563eb' },
  
  inputLabel: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#0f172a' },
  imagePickerBox: { height: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20, padding: 10 },
  placeholderText: { color: '#64748b', marginBottom: 10 },
  addImageBtn: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  addImageText: { color: '#fff', fontWeight: '600' },
  removeImageBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 15 },

  textArea: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 15, height: 120, textAlignVertical: 'top', fontSize: 16, marginBottom: 20 },

  infoBox: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1e3a8a', marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#1e40af', lineHeight: 18 },

  modalFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  saveBtn: { backgroundColor: '#2563eb', paddingVertical: 16, borderRadius: 12, alignItems: 'center' }, 
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' }, 
  disabledBtn: { backgroundColor: '#93c5fd', opacity: 0.8 },
});