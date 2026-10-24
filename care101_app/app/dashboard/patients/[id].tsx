import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User, Phone, Mail, Calendar, MapPin, AlertCircle, FileText, Plus, X, Pencil, Trash2 } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PatientDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [patientData, setPatientData] = useState<any>(null);

    // Lab Request Modal & Form States
    const [showLabRequestModal, setShowLabRequestModal] = useState(false);
    const [labTitle, setLabTitle] = useState("");
    const [labDescription, setLabDescription] = useState("");
    const [submittingLab, setSubmittingLab] = useState(false);

    // View Record Modal States
    const [showViewRecordModal, setShowViewRecordModal] = useState(false);
    const [selectedRecordData, setSelectedRecordData] = useState<any>(null);
    const [fetchingRecord, setFetchingRecord] = useState(false);

    // Add / Edit / Delete Record States
    const [recordFormMode, setRecordFormMode] = useState<'add' | 'edit' | null>(null);
    const [editRecordId, setEditRecordId] = useState<string | null>(null);
    const [editType, setEditType] = useState("consultations");
    const [editFile, setEditFile] = useState<{ data: string; type: string; name: string } | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDiagnosis, setEditDiagnosis] = useState("");
    const [editMedications, setEditMedications] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [savingRecord, setSavingRecord] = useState(false);
    const [deletingRecord, setDeletingRecord] = useState(false);

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

    const fetchPatientDetails = useCallback(async () => {
        try {
            setLoading(true);
            const token = await SecureStore.getItemAsync('token');

            const response = await fetch(`${API_URL}/patient/${id}/medical-history`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPatientData(data);
            } else {
                Alert.alert('Error', 'Failed to fetch patient details');
            }
        } catch (error) {
            console.error('Fetch Patient Error:', error);
            Alert.alert('Error', 'Connection failed');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchPatientDetails();
    }, [fetchPatientDetails]);

    const handleSubmitLabRequest = async () => {
        if (!labTitle.trim()) {
            Alert.alert("Required", "Please enter a title for the lab request.");
            return;
        }

        setSubmittingLab(true);
        try {
            const token = await SecureStore.getItemAsync('token');
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

            const response = await fetch(`${API_URL}/lab-requests/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    patientId: id,
                    title: labTitle.trim(),
                    description: labDescription.trim(),
                    doctorId,
                    doctorName
                })
            });

            if (response.ok) {
                Alert.alert("Success", "Lab request created successfully!");
                setLabTitle("");
                setLabDescription("");
                setShowLabRequestModal(false);
                fetchPatientDetails(); // Refresh
            } else {
                const data = await response.json();
                Alert.alert("Error", data.msg || "Failed to create lab request");
            }
        } catch (error) {
            console.error("Create Lab Request Error:", error);
            Alert.alert("Error", "Connection failed");
        } finally {
            setSubmittingLab(false);
        }
    };

    const handleViewRecord = async (recordId: string) => {
        setFetchingRecord(true);
        try {
            const token = await SecureStore.getItemAsync('token');
            const response = await fetch(`${API_URL}/medical-records/download/${recordId}`, {
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



    const closeRecordModal = () => {
        setShowViewRecordModal(false);
    };

    const openAddRecord = () => {
        setEditRecordId(null);
        setEditType("consultations");
        setEditTitle("");
        setEditDiagnosis("");
        setEditMedications("");
        setEditDescription("");
        setEditFile(null);
        setRecordFormMode('add');
    };

    const openEditRecord = (record: any) => {
        setShowViewRecordModal(false);
        setEditRecordId(record._id);
        setEditType(record.type || "consultations");
        setEditTitle(record.title || "");
        setEditDiagnosis(record.diagnosis || "");
        setEditMedications(record.medications || "");
        setEditDescription(record.description || "");
        setEditFile(null);
        setRecordFormMode('edit');
    };

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const asset = result.assets[0];
            const mimeType = asset.mimeType || (asset.name?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
            const base64 = await FileSystem.readAsStringAsync(asset.uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            setEditFile({ data: `data:${mimeType};base64,${base64}`, type: mimeType, name: asset.name || 'Attachment' });
        } catch (error) {
            console.error("Pick File Error:", error);
            Alert.alert("Error", "Could not attach the file.");
        }
    };

    const handleSaveRecord = async () => {
        if (!editTitle.trim()) {
            Alert.alert("Required", "Please enter a title for the record.");
            return;
        }

        setSavingRecord(true);
        try {
            const token = await SecureStore.getItemAsync('token');
            const isAdd = recordFormMode === 'add';
            const response = await fetch(
                isAdd ? `${API_URL}/medical-records/upload` : `${API_URL}/medical-records/${editRecordId}`,
                {
                    method: isAdd ? 'POST' : 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                        ...(isAdd ? { patientId: id, date: new Date().toISOString() } : {}),
                        type: editType,
                        title: editTitle.trim(),
                        diagnosis: editDiagnosis.trim(),
                        medications: editMedications.trim(),
                        description: editDescription.trim(),
                        ...(editFile ? { fileData: editFile.data, fileType: editFile.type } : {})
                    })
                }
            );

            if (response.ok) {
                setRecordFormMode(null);
                Alert.alert("Success", isAdd ? "Medical record added." : "Medical record updated.");
                fetchPatientDetails(); // Refresh
            } else {
                const data = await response.json().catch(() => ({}));
                Alert.alert("Error", data.msg || "Failed to save record");
            }
        } catch (error) {
            console.error("Save Record Error:", error);
            Alert.alert("Error", "Connection failed");
        } finally {
            setSavingRecord(false);
        }
    };

    const confirmDeleteRecord = (record: any) => {
        Alert.alert(
            "Delete Record",
            `Are you sure you want to delete "${record?.title || 'this record'}"? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setDeletingRecord(true);
                        try {
                            const token = await SecureStore.getItemAsync('token');
                            const response = await fetch(`${API_URL}/medical-records/delete/${record._id}`, {
                                method: 'DELETE',
                                headers: {
                                    'Authorization': `Bearer ${token}`,
                                    'ngrok-skip-browser-warning': 'true'
                                }
                            });

                            if (response.ok) {
                                closeRecordModal();
                                setSelectedRecordData(null);
                                Alert.alert("Deleted", "Medical record removed.");
                                fetchPatientDetails(); // Refresh
                            } else {
                                const data = await response.json().catch(() => ({}));
                                Alert.alert("Error", data.msg || "Failed to delete record");
                            }
                        } catch (error) {
                            console.error("Delete Record Error:", error);
                            Alert.alert("Error", "Connection failed");
                        } finally {
                            setDeletingRecord(false);
                        }
                    }
                }
            ]
        );
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const calculateAge = (dateString: string) => {
        if (!dateString) return 'N/A';
        const birthDate = new Date(dateString);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    if (!patientData) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.errorText}>Patient not found</Text>
            </View>
        );
    }

    const { patient, medicalRecords, summary } = patientData;

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Patient Details</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Patient Info Card */}
                    <View style={styles.card}>
                        <View style={styles.avatarLarge}>
                            <User size={48} color="#06b6d4" />
                        </View>
                        <Text style={styles.patientName}>{patient.fullName}</Text>
                        <Text style={styles.patientUsername}>@{patient.username}</Text>

                        <View style={styles.infoGrid}>
                            <View style={styles.infoItem}>
                                <Calendar size={16} color="#64748b" />
                                <Text style={styles.infoLabel}>Age</Text>
                                <Text style={styles.infoValue}>{calculateAge(patient.dateOfBirth)} years</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <User size={16} color="#64748b" />
                                <Text style={styles.infoLabel}>Gender</Text>
                                <Text style={styles.infoValue}>{patient.gender || 'N/A'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Contact Information */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Information</Text>
                        <View style={styles.card}>
                            <View style={styles.contactRow}>
                                <Phone size={20} color="#06b6d4" />
                                <View style={styles.contactInfo}>
                                    <Text style={styles.contactLabel}>Mobile</Text>
                                    <Text style={styles.contactValue}>{patient.mobileNumber || 'N/A'}</Text>
                                </View>
                            </View>
                            <View style={styles.contactRow}>
                                <Mail size={20} color="#06b6d4" />
                                <View style={styles.contactInfo}>
                                    <Text style={styles.contactLabel}>Email</Text>
                                    <Text style={styles.contactValue}>{patient.email}</Text>
                                </View>
                            </View>
                            <View style={styles.contactRow}>
                                <MapPin size={20} color="#06b6d4" />
                                <View style={styles.contactInfo}>
                                    <Text style={styles.contactLabel}>NIC</Text>
                                    <Text style={styles.contactValue}>{patient.nic}</Text>
                                </View>
                            </View>
                            {patient.emergencyContact && (
                                <View style={styles.contactRow}>
                                    <AlertCircle size={20} color="#ef4444" />
                                    <View style={styles.contactInfo}>
                                        <Text style={styles.contactLabel}>Emergency Contact</Text>
                                        <Text style={styles.contactValue}>{patient.emergencyContact}</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Medical Information */}
                    {(patient.medicalConditions?.length > 0 || patient.allergies?.length > 0) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Medical Information</Text>
                            <View style={styles.card}>
                                {patient.medicalConditions?.length > 0 && (
                                    <View style={styles.medicalRow}>
                                        <Text style={styles.medicalLabel}>Conditions</Text>
                                        <View style={styles.tagContainer}>
                                            {patient.medicalConditions.map((condition: string, index: number) => (
                                                <View key={index} style={styles.tag}>
                                                    <Text style={styles.tagText}>{condition}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                                {patient.allergies?.length > 0 && (
                                    <View style={styles.medicalRow}>
                                        <Text style={styles.medicalLabel}>Allergies</Text>
                                        <View style={styles.tagContainer}>
                                            {patient.allergies.map((allergy: string, index: number) => (
                                                <View key={index} style={[styles.tag, styles.tagDanger]}>
                                                    <Text style={[styles.tagText, styles.tagTextDanger]}>{allergy}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Summary Stats */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Summary</Text>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{summary.totalAppointments}</Text>
                                <Text style={styles.statLabel}>Appointments</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{summary.totalRecords}</Text>
                                <Text style={styles.statLabel}>Records</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{summary.totalSurgeries}</Text>
                                <Text style={styles.statLabel}>Surgeries</Text>
                            </View>
                        </View>
                    </View>

                    {/* Pending Lab Requests */}
                    {patientData.labRequests && patientData.labRequests.filter((r: any) => r.status === 'pending').length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Pending Lab Requests</Text>
                            {patientData.labRequests.filter((r: any) => r.status === 'pending').map((req: any) => (
                                <View key={req._id} style={styles.listItem}>
                                    <View style={[styles.listItemIcon, { backgroundColor: '#fff7ed' }]}>
                                        <FileText size={16} color="#ea580c" />
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <Text style={styles.listItemTitle}>{req.title}</Text>
                                        <Text style={styles.listItemSubtitle}>
                                            Requested: {formatDate(req.createdAt)} • Status: {req.billId?.status === 'Paid' ? 'Paid (Processing)' : `Unpaid (LKR ${req.billId?.amount || 0})`}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Medical Records Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Medical Records</Text>
                        </View>
                        <View style={styles.recordActionsRow}>
                            <TouchableOpacity 
                                style={[styles.addButton, styles.recordActionButton]}
                                onPress={openAddRecord}
                            >
                                <Plus size={16} color="#06b6d4" />
                                <Text style={styles.addButtonText}>Add Record</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.addButton, styles.recordActionButton]}
                                onPress={() => setShowLabRequestModal(true)}
                            >
                                <Plus size={16} color="#06b6d4" />
                                <Text style={styles.addButtonText}>Request Lab</Text>
                            </TouchableOpacity>
                        </View>
                        {medicalRecords.length > 0 ? (
                            medicalRecords.map((record: any) => (
                                <TouchableOpacity 
                                    key={record._id} 
                                    style={styles.listItem}
                                    onPress={() => handleViewRecord(record._id)}
                                >
                                    <View style={styles.listItemIcon}>
                                        <FileText size={16} color="#8b5cf6" />
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <Text style={styles.listItemTitle}>{record.title}</Text>
                                        <Text style={styles.listItemSubtitle}>
                                            {record.type.replace('_', ' ').toUpperCase()} • {formatDate(record.date)}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.rowIconButton}
                                        onPress={() => openEditRecord(record)}
                                        hitSlop={8}
                                    >
                                        <Pencil size={16} color="#06b6d4" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.rowIconButton, { backgroundColor: '#fef2f2' }]}
                                        onPress={() => confirmDeleteRecord(record)}
                                        hitSlop={8}
                                        disabled={deletingRecord}
                                    >
                                        <Trash2 size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyText}>No medical records found.</Text>
                            </View>
                        )}
                    </View>
                </ScrollView>

                {/* View Record Modal */}
                <Modal
                    visible={showViewRecordModal}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={closeRecordModal}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContentCard}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalTitle} numberOfLines={1}>{selectedRecordData?.title || 'Record Details'}</Text>
                                <TouchableOpacity onPress={closeRecordModal}>
                                    <X size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.recordDetailContainer}>
                                    <View style={styles.recordMetaRow}>
                                        <Text style={styles.recordMetaText}>
                                            {(selectedRecordData?.type || 'record').replace('_', ' ').toUpperCase()} • {formatDate(selectedRecordData?.date)}
                                        </Text>
                                    </View>
                                    <View style={styles.recordMetaRow}>
                                        <Text style={styles.recordMetaText}>By: {selectedRecordData?.doctorName || 'N/A'}</Text>
                                    </View>

                                    {!!selectedRecordData?.diagnosis && (
                                        <>
                                            <Text style={styles.modalLabel}>Diagnosis</Text>
                                            <Text style={styles.recordDescriptionText}>{selectedRecordData.diagnosis}</Text>
                                        </>
                                    )}

                                    {!!selectedRecordData?.medications && (
                                        <>
                                            <Text style={styles.modalLabel}>Medications</Text>
                                            <Text style={styles.recordDescriptionText}>{selectedRecordData.medications}</Text>
                                        </>
                                    )}
                                    
                                    <Text style={styles.modalLabel}>Description</Text>
                                    <Text style={styles.recordDescriptionText}>
                                        {selectedRecordData?.description || 'No description provided.'}
                                    </Text>

                                    <Text style={styles.modalLabel}>Attachment</Text>
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

                            <View style={styles.modalButtonRow}>
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.recordEditButton]}
                                    onPress={() => openEditRecord(selectedRecordData)}
                                    disabled={deletingRecord}
                                >
                                    <Pencil size={16} color="#06b6d4" />
                                    <Text style={styles.recordEditButtonText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.recordDeleteButton]}
                                    onPress={() => confirmDeleteRecord(selectedRecordData)}
                                    disabled={deletingRecord}
                                >
                                    {deletingRecord ? (
                                        <ActivityIndicator size="small" color="#ef4444" />
                                    ) : (
                                        <>
                                            <Trash2 size={16} color="#ef4444" />
                                            <Text style={styles.recordDeleteButtonText}>Delete</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                            <View style={styles.modalButtonRow}>
                                {selectedRecordData?.fileData && (
                                    <TouchableOpacity 
                                        style={[styles.modalButton, { backgroundColor: '#06b6d4' }]}
                                        onPress={() => handleDownloadFile(selectedRecordData.fileData, selectedRecordData.fileName || 'Report', selectedRecordData.fileType)}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Download File</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.modalButtonCancel]}
                                    onPress={closeRecordModal}
                                >
                                    <Text style={styles.modalButtonCancelText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Add / Edit Record Modal */}
                <Modal
                    visible={recordFormMode !== null}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setRecordFormMode(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContentCard}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalTitle}>{recordFormMode === 'add' ? 'Add Medical Record' : 'Edit Medical Record'}</Text>
                                <TouchableOpacity onPress={() => setRecordFormMode(null)}>
                                    <X size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                                <Text style={styles.modalLabel}>Record Type</Text>
                                <View style={styles.typeChipRow}>
                                    {[
                                        { value: 'consultations', label: 'Consultation' },
                                        { value: 'prescriptions', label: 'Prescription' },
                                        { value: 'lab_tests', label: 'Lab Test' },
                                        { value: 'reports', label: 'Report' },
                                    ].map(opt => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[styles.typeChip, editType === opt.value && styles.typeChipActive]}
                                            onPress={() => setEditType(opt.value)}
                                        >
                                            <Text style={[styles.typeChipText, editType === opt.value && styles.typeChipTextActive]}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={styles.modalLabel}>Title *</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={editTitle}
                                    onChangeText={setEditTitle}
                                    placeholder="e.g. OPD Consultation"
                                />

                                <Text style={styles.modalLabel}>Diagnosis</Text>
                                <TextInput
                                    style={[styles.modalInput, styles.modalTextarea]}
                                    value={editDiagnosis}
                                    onChangeText={setEditDiagnosis}
                                    placeholder="Diagnosis"
                                    multiline={true}
                                />

                                <Text style={styles.modalLabel}>Medications</Text>
                                <TextInput
                                    style={[styles.modalInput, styles.modalTextarea]}
                                    value={editMedications}
                                    onChangeText={setEditMedications}
                                    placeholder="Medications"
                                    multiline={true}
                                />

                                <Text style={styles.modalLabel}>Description</Text>
                                <TextInput
                                    style={[styles.modalInput, styles.modalTextarea]}
                                    value={editDescription}
                                    onChangeText={setEditDescription}
                                    placeholder="Description / notes"
                                    multiline={true}
                                />

                                <Text style={styles.modalLabel}>Attachment (optional)</Text>
                                <TouchableOpacity style={styles.attachButton} onPress={handlePickFile}>
                                    <FileText size={16} color="#06b6d4" />
                                    <Text style={styles.attachButtonText} numberOfLines={1}>
                                        {editFile ? editFile.name : (recordFormMode === 'edit' ? 'Replace file (image / PDF)' : 'Attach file (image / PDF)')}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>

                            <View style={styles.modalButtonRow}>
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.modalButtonCancel]}
                                    onPress={() => setRecordFormMode(null)}
                                    disabled={savingRecord}
                                >
                                    <Text style={styles.modalButtonCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.modalButtonSubmit]}
                                    onPress={handleSaveRecord}
                                    disabled={savingRecord}
                                >
                                    {savingRecord ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.modalButtonSubmitText}>{recordFormMode === 'add' ? 'Add Record' : 'Save Changes'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Request Lab Modal */}
                <Modal
                    visible={showLabRequestModal}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowLabRequestModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContentCard}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalTitle}>Request Lab Report</Text>
                                <TouchableOpacity onPress={() => setShowLabRequestModal(false)}>
                                    <X size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.modalLabel}>Lab Test Title *</Text>
                            <TextInput 
                                style={styles.modalInput}
                                placeholder="e.g. Full Blood Count, Lipid Profile"
                                value={labTitle}
                                onChangeText={setLabTitle}
                            />

                            <Text style={styles.modalLabel}>Instructions / Notes (Optional)</Text>
                            <TextInput 
                                style={[styles.modalInput, styles.modalTextarea]}
                                placeholder="Add details or special requirements here..."
                                multiline={true}
                                numberOfLines={3}
                                value={labDescription}
                                onChangeText={setLabDescription}
                            />

                            <View style={styles.modalButtonRow}>
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.modalButtonCancel]}
                                    onPress={() => {
                                        setShowLabRequestModal(false);
                                        setLabTitle("");
                                        setLabDescription("");
                                    }}
                                    disabled={submittingLab}
                                >
                                    <Text style={styles.modalButtonCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.modalButtonSubmit]}
                                    onPress={handleSubmitLabRequest}
                                    disabled={submittingLab}
                                >
                                    {submittingLab ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.modalButtonSubmitText}>Submit Request</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Overlay fetching record indicator */}
                {fetchingRecord && (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
                        <ActivityIndicator size="large" color="#06b6d4" />
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: { marginRight: 12 },
    title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },

    scrollContent: { padding: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: 16,
    },

    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    patientName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 4,
    },
    patientUsername: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 20,
    },

    infoGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    infoItem: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 2,
    },

    section: { marginBottom: 24 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 12,
    },

    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    contactInfo: {
        marginLeft: 12,
        flex: 1,
    },
    contactLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 2,
    },
    contactValue: {
        fontSize: 16,
        color: '#0f172a',
        fontWeight: '500',
    },

    medicalRow: {
        marginBottom: 16,
    },
    medicalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 8,
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: '#ecfeff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    tagDanger: {
        backgroundColor: '#fee2e2',
    },
    tagText: {
        fontSize: 13,
        color: '#06b6d4',
        fontWeight: '500',
    },
    tagTextDanger: {
        color: '#ef4444',
    },

    statsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#06b6d4',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
    },

    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    listItemIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    listItemContent: {
        flex: 1,
    },
    listItemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 2,
    },
    listItemSubtitle: {
        fontSize: 12,
        color: '#64748b',
    },

    errorText: {
        fontSize: 16,
        color: '#64748b',
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfeff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 4,
    },
    addButtonText: {
        fontSize: 12,
        color: '#06b6d4',
        fontWeight: '600',
    },
    emptyCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContentCard: {
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
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 6,
        marginTop: 12,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        backgroundColor: '#f8fafc',
    },
    modalTextarea: {
        height: 80,
        textAlignVertical: 'top',
        marginBottom: 10,
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonSubmit: {
        backgroundColor: '#06b6d4',
    },
    recordActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    recordActionButton: { flex: 1, justifyContent: 'center' },
    rowIconButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    typeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fff',
    },
    typeChipActive: { borderColor: '#06b6d4', backgroundColor: '#ecfeff' },
    typeChipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
    typeChipTextActive: { color: '#0891b2', fontWeight: '700' },
    attachButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#a5f3fc',
        backgroundColor: '#f0fdff',
        borderRadius: 8,
        padding: 12,
    },
    attachButtonText: { flex: 1, color: '#0891b2', fontSize: 14, fontWeight: '600' },
    recordEditButton: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: '#ecfeff',
        borderWidth: 1,
        borderColor: '#a5f3fc',
    },
    recordEditButtonText: { color: '#06b6d4', fontSize: 14, fontWeight: '600' },
    recordDeleteButton: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fecaca',
    },
    recordDeleteButtonText: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
    modalButtonCancel: {
        backgroundColor: '#f1f5f9',
    },
    modalButtonSubmitText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    modalButtonCancelText: {
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
