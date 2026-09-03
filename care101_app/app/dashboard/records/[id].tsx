import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar,
  Platform, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Calendar, Plus, Camera, Info, X, FileText } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/surgery-records`;

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

  // --- LAB REQUEST STATE ---
  const [showLabModal, setShowLabModal] = useState(false);
  const [labTitle, setLabTitle] = useState('');
  const [labDescription, setLabDescription] = useState('');
  const [submittingLab, setSubmittingLab] = useState(false);

  // --- LAB REPORTS STATE & HANDLERS ---
  const [labReports, setLabReports] = useState<any[]>([]);
  const [selectedRecordData, setSelectedRecordData] = useState<any>(null);
  const [showViewRecordModal, setShowViewRecordModal] = useState(false);
  const [fetchingRecord, setFetchingRecord] = useState(false);

  const handleDownloadFile = async (fileData: string, fileName: string, fileType: string) => {
    try {
      let base64Code = fileData;
      if (fileData.includes(';base64,')) {
        base64Code = fileData.split(';base64,')[1];
      }

      let extension = '.jpg';
      if (fileType === 'application/pdf') {
        extension = '.pdf';
      } else if (fileType === 'image/png') {
        extension = '.png';
      }

      const safeFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileUri = `${FileSystem.documentDirectory}${safeFileName}${extension}`;

      await FileSystem.writeAsStringAsync(fileUri, base64Code, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Success', `File saved to: ${fileUri}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file.');
    }
  };

  const handleViewRecord = async (recordId: string) => {
    setFetchingRecord(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const baseApi = process.env.EXPO_PUBLIC_API_URL;
      const response = await fetch(`${baseApi}/medical-records/download/${recordId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedRecordData(data);
        setShowViewRecordModal(true);
      } else {
        Alert.alert("Error", "Failed to load medical record details.");
      }
    } catch (error) {
      console.error("View Record Error:", error);
      Alert.alert("Error", "Connection failed");
    } finally {
      setFetchingRecord(false);
    }
  };

  useEffect(() => {
    fetchRecordDetails();
  }, [id]);

  const handleRequestLab = async () => {
    if (!labTitle.trim()) {
      Alert.alert("Required", "Please enter a title for the lab request.");
      return;
    }

    setSubmittingLab(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const baseApi = process.env.EXPO_PUBLIC_API_URL;

      // 1. Get patient Mongoose ID from their patientId (e.g. SHP001)
      const searchRes = await fetch(`${baseApi}/patients/search-by-patientid/${record.patientId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!searchRes.ok) {
        throw new Error("Failed to find patient matching this record");
      }

      const searchData = await searchRes.json();
      if (!searchData.found || !searchData.patient?._id) {
        Alert.alert("Error", "Associated patient not found in system.");
        setSubmittingLab(false);
        return;
      }

      const patientMongooseId = searchData.patient._id;

      const userDataStr = await SecureStore.getItemAsync('user_data');
      let doctorName = '';
      let doctorId = '';
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          doctorName = userData.name || userData.fullName || '';
          doctorId = userData.id || userData._id || '';
        } catch(e) {}
      }

      // 2. Submit Lab Request
      const res = await fetch(`${baseApi}/lab-requests/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          patientId: patientMongooseId,
          title: labTitle.trim(),
          description: labDescription.trim(),
          doctorId,
          doctorName
        })
      });

      if (res.ok) {
        Alert.alert("Success", "Lab request created successfully!");
        setLabTitle('');
        setLabDescription('');
        setShowLabModal(false);
      } else {
        const errData = await res.json();
        Alert.alert("Error", errData.msg || "Failed to create request");
      }

    } catch (error: any) {
      console.error("Request Lab Error:", error);
      Alert.alert("Error", error.message || "Connection failed");
    } finally {
      setSubmittingLab(false);
    }
  };

  const fetchRecordDetails = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const res = await fetch(`${API_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecord(data);

        // Fetch patient lab reports
        try {
          const baseApi = process.env.EXPO_PUBLIC_API_URL;
          const searchRes = await fetch(`${baseApi}/patients/search-by-patientid/${data.patientId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            }
          });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (searchData.found && searchData.patient?._id) {
              const patId = searchData.patient._id;
              const recordsRes = await fetch(`${baseApi}/medical-records/patient/${patId}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                  'ngrok-skip-browser-warning': 'true'
                }
              });
              if (recordsRes.ok) {
                const recordsData = await recordsRes.json();
                const labTests = recordsData.filter((r: any) => r.type === 'lab_tests');
                setLabReports(labTests);
              }
            }
          }
        } catch (err) {
          console.error("Failed to load lab reports:", err);
        }

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
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            const token = await SecureStore.getItemAsync('token');
            const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) router.back();
          } catch (e) { }
        }
      }
    ]);
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#0f172a" />;
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTitle}>Patient Details</Text>
            <TouchableOpacity 
              style={styles.requestLabBtn} 
              onPress={() => setShowLabModal(true)}
            >
              <Text style={styles.requestLabBtnText}>Request Lab</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.rowContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Patient ID</Text>
              <Text style={styles.value}>{record.patientId || "N/A"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Hospital</Text>
              <Text style={styles.value}>{record.hospital || "N/A"}</Text>
            </View>
          </View>
          <View style={[styles.rowContainer, { marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>NIC</Text>
              <Text style={styles.value}>{record.nic || "N/A"}</Text>
            </View>
            <View style={{ flex: 1 }} />
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

        {/* Card 3: Lab Reports */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Completed Lab Reports</Text>
          <View style={styles.divider} />
          {labReports.length > 0 ? (
            labReports.map((report) => (
              <View key={report._id} style={styles.labReportRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.labReportTitle}>{report.title}</Text>
                  <Text style={styles.labReportDate}>
                    {new Date(report.date).toLocaleDateString()}
                  </Text>
                  {report.description && (
                    <Text style={styles.labReportDesc}>{report.description}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.viewReportBtn}
                  onPress={() => handleViewRecord(report._id)}
                >
                  <Text style={styles.viewReportBtnText}>View & Download</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noLabText}>No lab reports uploaded for this patient yet.</Text>
          )}
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
              <View style={{ width: 50 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>

              {/* Image Picker Area */}
              <Text style={styles.inputLabel}>Progress Images</Text>
              <View style={styles.imagePickerBox}>
                {entryImage ? (
                  <View style={{ width: '100%', height: '100%' }}>
                    <Image source={{ uri: entryImage }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" />
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => setEntryImage(null)}>
                      <X size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Camera size={40} color="#cbd5e1" style={{ marginBottom: 10 }} />
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
                <Info size={20} color="#06B6D4" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
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

      {/* --- REQUEST LAB MODAL --- */}
      <Modal animationType="slide" transparent={true} visible={showLabModal} onRequestClose={() => setShowLabModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowLabModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Request Lab Report</Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.inputLabel}>Lab Test Title *</Text>
              <TextInput 
                style={styles.modalInput}
                placeholder="e.g. Full Blood Count, Lipid Profile"
                value={labTitle}
                onChangeText={setLabTitle}
              />

              <Text style={styles.inputLabel}>Instructions / Notes (Optional)</Text>
              <TextInput 
                style={[styles.modalInput, styles.textArea]}
                placeholder="Add details or special requirements here..."
                multiline={true}
                numberOfLines={3}
                value={labDescription}
                onChangeText={setLabDescription}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.saveBtn, submittingLab && styles.disabledBtn]}
                onPress={handleRequestLab}
                disabled={submittingLab}
              >
                {submittingLab ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Submit Request</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* View Record Modal */}
      <Modal
        visible={showViewRecordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowViewRecordModal(false)}
      >
        <View style={styles.recordModalOverlay}>
          <View style={styles.recordModalContentCard}>
            <View style={styles.recordModalHeaderRow}>
              <Text style={styles.recordModalTitle} numberOfLines={1}>{selectedRecordData?.fileName || 'Record Details'}</Text>
              <TouchableOpacity onPress={() => setShowViewRecordModal(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.recordDetailContainer}>
                <View style={styles.recordMetaRow}>
                  <Text style={styles.recordMetaText}>Type: {selectedRecordData?.fileType || 'N/A'}</Text>
                </View>
                
                <Text style={styles.recordModalLabel}>Description</Text>
                <Text style={styles.recordDescriptionText}>
                  {selectedRecordData?.description || 'No description provided.'}
                </Text>

                <Text style={styles.recordModalLabel}>Attachment</Text>
                {selectedRecordData?.fileData ? (
                  selectedRecordData.fileType?.startsWith('image/') || selectedRecordData.fileData?.startsWith('data:image/') ? (
                    <View style={{ width: '100%', height: 300, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
                      <Image 
                        source={{ uri: selectedRecordData.fileData }} 
                        style={{ width: '100%', height: '100%', resizeMode: 'contain' }} 
                      />
                    </View>
                  ) : (
                    <View style={[styles.reportImage, { justifyContent: 'center', alignItems: 'center' }]}>
                      <FileText size={48} color="#fff" />
                      <Text style={{ color: '#fff', marginTop: 8 }}>PDF Document</Text>
                    </View>
                  )
                ) : (
                  <Text style={styles.noImageText}>No file attachment available.</Text>
                )}
              </View>
            </ScrollView>
            
            <View style={styles.recordModalButtonRow}>
              {selectedRecordData?.fileData && (
                <TouchableOpacity 
                  style={[styles.recordModalButton, { backgroundColor: '#06b6d4' }]}
                  onPress={() => handleDownloadFile(selectedRecordData.fileData, selectedRecordData.fileName || 'Report', selectedRecordData.fileType)}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Download File</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.recordModalButton, styles.recordModalButtonCancel]}
                onPress={() => setShowViewRecordModal(false)}
              >
                <Text style={styles.recordModalButtonCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fetching overlay */}
      {fetchingRecord && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
          <ActivityIndicator size="large" color="#06b6d4" />
        </View>
      )}

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
  fab: { position: 'absolute', bottom: 30, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#06B6D4', alignItems: 'center', justifyContent: 'center', elevation: 6 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#f8fafc', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  cancelText: { fontSize: 16, color: '#06B6D4' },

  inputLabel: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#0f172a' },
  imagePickerBox: { height: 200, backgroundColor: '#fff', borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20, padding: 10 },
  placeholderText: { color: '#64748b', marginBottom: 10 },
  addImageBtn: { backgroundColor: '#06B6D4', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  addImageText: { color: '#fff', fontWeight: '600' },
  removeImageBtn: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 15 },

  textArea: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', padding: 15, height: 120, textAlignVertical: 'top', fontSize: 16, marginBottom: 20 },

  infoBox: { flexDirection: 'row', backgroundColor: '#eff6ff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1e3a8a', marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#1e40af', lineHeight: 18 },

  modalFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  saveBtn: { backgroundColor: '#06B6D4', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  disabledBtn: { backgroundColor: '#93c5fd', opacity: 0.8 },
  requestLabBtn: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  requestLabBtnText: {
    fontSize: 12,
    color: '#06b6d4',
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  labReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  labReportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  labReportDate: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  labReportDesc: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  viewReportBtn: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  viewReportBtnText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  noLabText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  recordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recordModalContentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  recordModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  recordModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  recordModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 12,
  },
  recordModalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  recordModalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordModalButtonCancel: {
    backgroundColor: '#f1f5f9',
  },
  recordModalButtonCancelText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  recordDetailContainer: {
    marginVertical: 8,
  },
  recordMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 8,
  },
  recordMetaText: {
    fontSize: 12,
    color: '#64748b',
  },
  recordDescriptionText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 16,
  },
  reportImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    resizeMode: 'contain',
    backgroundColor: '#000',
  },
  noImageText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: 20,
  },
});