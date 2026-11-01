import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, StatusBar,
  Platform, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2, Calendar, Plus, Camera, Info, X, FileText, Building2, CreditCard, FlaskConical, Stethoscope, ChevronRight } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import LabTestPicker from '../../../components/LabTestPicker';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/surgery-records`;

const getInitials = (name: string = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';

// "SUWASEWANA HOSPITAL" -> "Suwasewana Hospital"
const toTitleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : `${formatDate(value)} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {count !== undefined && count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon: Icon, label, value, last }: { icon: any; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
      <Icon size={16} color="#94a3b8" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

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
  const [labTestIds, setLabTestIds] = useState<string[]>([]);
  const [labDescription, setLabDescription] = useState('');
  const [submittingLab, setSubmittingLab] = useState(false);

  // --- LAB REPORTS & CLINICAL RECORDS STATE & HANDLERS ---
  const [clinicalRecords, setClinicalRecords] = useState<any[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
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
    if (labTestIds.length === 0) {
      Alert.alert("Required", "Please select at least one lab test.");
      return;
    }

    setSubmittingLab(true);
    try {
      const token = await SecureStore.getItemAsync('token');
      const baseApi = process.env.EXPO_PUBLIC_API_URL;

      let patientMongooseId = record.patientMongoId || null;

      if (!patientMongooseId) {
        const searchRes = await fetch(`${baseApi}/patients/search-by-patientid/${record.patientId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          }
        });

        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.found && searchData.patient?._id) {
            patientMongooseId = searchData.patient._id;
          }
        }
      }

      if (!patientMongooseId) {
        Alert.alert("Error", "Associated patient not found in system.");
        setSubmittingLab(false);
        return;
      }

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
          testIds: labTestIds,
          description: labDescription.trim(),
          doctorId,
          doctorName
        })
      });

      if (res.ok) {
        const created = await res.json();
        Alert.alert("Success", `Lab request created. Total: LKR ${Number(created.totalAmount || 0).toLocaleString()}`);
        setLabTestIds([]);
        setLabDescription('');
        setShowLabModal(false);
        fetchRecordDetails();
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

        // Fetch patient clinical records, lab reports & lab requests
        try {
          const baseApi = process.env.EXPO_PUBLIC_API_URL;
          let patId = data.patientMongoId || null;

          if (!patId && data.patientId) {
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
                patId = searchData.patient._id;
              }
            }
          }

          if (patId) {
            const commonHeaders = {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            };

            const [recordsRes, reqsRes] = await Promise.all([
              fetch(`${baseApi}/medical-records/patient/${patId}`, { headers: commonHeaders }),
              fetch(`${baseApi}/lab-requests/patient/${patId}`, { headers: commonHeaders })
            ]);

            if (recordsRes.ok) {
              const recordsData = await recordsRes.json();
              const allRecords = Array.isArray(recordsData) ? recordsData : [];
              setLabReports(allRecords.filter((r: any) => r.type === 'lab_tests'));
              setClinicalRecords(allRecords.filter((r: any) => r.type !== 'lab_tests'));
            }

            if (reqsRes.ok) {
              const reqsData = await reqsRes.json();
              setLabRequests(Array.isArray(reqsData) ? reqsData : []);
            }
          }
        } catch (err) {
          console.error("Failed to load clinical/lab reports:", err);
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

      const text = await res.text();

      if (res.ok) {
        Alert.alert("Success", "Entry Added!");
        setModalVisible(false);
        setEntryNotes('');
        setEntryImage(null);
        fetchRecordDetails();
      } else {
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

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#06b6d4" />;
  if (!record) return null;

  const standaloneReports = labReports.filter(
    (r) => !labRequests.some((req) => String(req.recordId) === String(r._id))
  );
  const labCount = labRequests.length + standaloneReports.length;
  const entries = record.entries || [];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <ArrowLeft size={20} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.headerTitle}>Surgery Record</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} style={[styles.iconBtn, styles.deleteBtn]} hitSlop={8}>
          <Trash2 size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Patient summary */}
        <View style={styles.card}>
          <View style={styles.patientRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(record.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName} numberOfLines={1}>{record.name}</Text>
              {!!record.patientId && (
                <View style={styles.idChip}>
                  <Text style={styles.idChipText}>{record.patientId}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.infoList}>
            <InfoRow icon={Building2} label="Hospital" value={record.hospital ? toTitleCase(record.hospital) : 'N/A'} />
            <InfoRow icon={CreditCard} label="NIC" value={record.nic || 'N/A'} />
            <InfoRow icon={Calendar} label="Created" value={formatDate(record.createdAt) || 'N/A'} last />
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={() => setShowLabModal(true)}>
              <FlaskConical size={16} color="#0891b2" />
              <Text style={styles.actionBtnSecondaryText}>Request Lab</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => setModalVisible(true)}>
              <Plus size={16} color="#fff" />
              <Text style={styles.actionBtnPrimaryText}>Add Progress</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Clinical Records & Prescriptions (Nurse / Doctor OPD entries) */}
        <SectionHeader title="Clinical Records" count={clinicalRecords.length} />
        <View style={styles.card}>
          {clinicalRecords.length > 0 ? (
            clinicalRecords.map((cRec, i) => (
              <TouchableOpacity
                key={cRec._id}
                style={[styles.listRow, i === clinicalRecords.length - 1 && styles.listRowLast]}
                activeOpacity={0.6}
                onPress={() => handleViewRecord(cRec._id)}
              >
                <View style={styles.rowIcon}>
                  <Stethoscope size={18} color="#0891b2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{cRec.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {formatDate(cRec.date || cRec.createdAt)} · {cRec.doctorName || 'OPD'}
                  </Text>
                  {cRec.diagnosis ? (
                    <Text style={styles.rowDetail} numberOfLines={1}>
                      <Text style={styles.rowDetailLabel}>Diagnosis </Text>{cRec.diagnosis}
                    </Text>
                  ) : null}
                  {cRec.medications ? (
                    <Text style={styles.rowDetail} numberOfLines={1}>
                      <Text style={styles.rowDetailLabel}>Rx </Text>{cRec.medications}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight size={18} color="#cbd5e1" />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noLabText}>No clinical records or prescriptions yet.</Text>
          )}
        </View>

        {/* Lab Requests & Completed Lab Reports */}
        <SectionHeader title="Lab Requests & Reports" count={labCount} />
        <View style={styles.card}>
          {labRequests.map((req, i) => {
            const done = req.status === 'completed' && req.recordId;
            return (
              <TouchableOpacity
                key={req._id}
                style={[styles.listRow, i === labCount - 1 && styles.listRowLast]}
                activeOpacity={done ? 0.6 : 1}
                disabled={!done}
                onPress={() => handleViewRecord(req.recordId)}
              >
                <View style={styles.rowIcon}>
                  <FlaskConical size={18} color="#0891b2" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{req.title}</Text>
                  <Text style={styles.rowMeta}>{formatDate(req.createdAt)}</Text>
                  {req.description ? <Text style={styles.rowDetail} numberOfLines={2}>{req.description}</Text> : null}
                </View>
                <View style={[styles.statusPill, done ? styles.statusDone : styles.statusPending]}>
                  <Text style={[styles.statusText, { color: done ? '#059669' : '#d97706' }]}>
                    {done ? 'Report ready' : 'Pending'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
          {standaloneReports.map((report, i) => (
            <TouchableOpacity
              key={report._id}
              style={[styles.listRow, labRequests.length + i === labCount - 1 && styles.listRowLast]}
              activeOpacity={0.6}
              onPress={() => handleViewRecord(report._id)}
            >
              <View style={styles.rowIcon}>
                <FileText size={18} color="#0891b2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{report.title}</Text>
                <Text style={styles.rowMeta}>{formatDate(report.date)}</Text>
                {report.description ? <Text style={styles.rowDetail} numberOfLines={2}>{report.description}</Text> : null}
              </View>
              <ChevronRight size={18} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
          {labCount === 0 && (
            <Text style={styles.noLabText}>No lab requests or reports yet.</Text>
          )}
        </View>

        {/* Main Surgery Card */}
        {record.surgeryCardImage ? (
          <>
            <SectionHeader title="Surgery Card" />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setImageExpanded(!imageExpanded)}
              style={[styles.imageContainer, imageExpanded && styles.imageContainerExpanded]}
            >
              <Image source={{ uri: record.surgeryCardImage }} style={styles.cardImage} resizeMode="cover" />
              <View style={styles.imageHint}>
                <Text style={styles.imageHintText}>{imageExpanded ? 'Tap to collapse' : 'Tap to expand'}</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {/* Recovery progress timeline */}
        <SectionHeader title="Recovery Progress" count={entries.length} />
        {entries.length > 0 ? (
          entries.map((entry: any, index: number) => (
            <View key={index} style={styles.timelineItem}>
              <View style={styles.timelineRail}>
                <View style={styles.timelineDot} />
                {index < entries.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.entryCard}>
                <Text style={styles.entryDate}>{formatDateTime(entry.date)}</Text>
                {entry.images && entry.images.length > 0 && (
                  <Image source={{ uri: entry.images[0] }} style={styles.entryImage} />
                )}
                {entry.notes ? <Text style={styles.entryNotes}>{entry.notes}</Text> : null}
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.card, styles.emptyState]}>
            <Text style={styles.emptyText}>No progress updates yet.</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyLink}>Add the first update</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

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
              <Text style={styles.inputLabel}>Lab Tests *</Text>
              <LabTestPicker selectedIds={labTestIds} onChange={setLabTestIds} />

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
              <Text style={styles.recordModalTitle} numberOfLines={1}>{selectedRecordData?.title || selectedRecordData?.fileName || 'Record Details'}</Text>
              <TouchableOpacity onPress={() => setShowViewRecordModal(false)}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.recordDetailContainer}>
                <View style={styles.recordMetaRow}>
                  <Text style={styles.recordMetaText}>Type: {selectedRecordData?.type || selectedRecordData?.fileType || 'N/A'}</Text>
                </View>
                
                {selectedRecordData?.diagnosis ? (
                  <>
                    <Text style={styles.recordModalLabel}>Diagnosis</Text>
                    <Text style={styles.recordDescriptionText}>{selectedRecordData.diagnosis}</Text>
                  </>
                ) : null}

                {selectedRecordData?.medications ? (
                  <>
                    <Text style={styles.recordModalLabel}>Prescribed Medications</Text>
                    <Text style={styles.recordDescriptionText}>{selectedRecordData.medications}</Text>
                  </>
                ) : null}

                <Text style={styles.recordModalLabel}>Clinical Notes / Description</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { backgroundColor: '#fef2f2' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  content: { padding: 16, paddingBottom: 48 },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#eef2f6' },

  // Patient summary
  patientRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ecfeff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#0891b2' },
  patientName: { fontSize: 19, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  idChip: { alignSelf: 'flex-start', backgroundColor: '#f1f5f9', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  idChipText: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 0.3 },
  infoList: { marginTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 14, color: '#64748b', width: 72 },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a', textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 12 },
  actionBtnSecondary: { backgroundColor: '#ecfeff' },
  actionBtnSecondaryText: { fontSize: 14, fontWeight: '700', color: '#0891b2' },
  actionBtnPrimary: { backgroundColor: '#06b6d4' },
  actionBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Sections
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, marginBottom: 10, paddingHorizontal: 4 },
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: '#ecfeff', alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#0891b2' },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  listRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#ecfeff', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  rowMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  rowDetail: { fontSize: 13, color: '#475569', marginTop: 4 },
  rowDetailLabel: { fontWeight: '700', color: '#64748b' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDone: { backgroundColor: '#ecfdf5' },
  statusPending: { backgroundColor: '#fffbeb' },
  statusText: { fontSize: 11, fontWeight: '700' },

  imageContainer: { width: '100%', height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f1f5f9', marginBottom: 8 },
  imageContainerExpanded: { height: 420 },
  cardImage: { width: '100%', height: '100%' },
  imageHint: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  imageHintText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  // Timeline
  timelineItem: { flexDirection: 'row' },
  timelineRail: { width: 20, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#06b6d4', marginTop: 16, borderWidth: 2, borderColor: '#cffafe' },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#e2e8f0', marginTop: 4 },
  entryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, marginLeft: 8, borderWidth: 1, borderColor: '#eef2f6' },
  entryDate: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 6 },
  entryImage: { width: '100%', height: 160, borderRadius: 10, marginBottom: 8, backgroundColor: '#f1f5f9' },
  entryNotes: { fontSize: 14, color: '#334155', lineHeight: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { color: '#94a3b8', fontSize: 14 },
  emptyLink: { color: '#0891b2', fontSize: 14, fontWeight: '700', marginTop: 6 },

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