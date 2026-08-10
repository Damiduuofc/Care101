import React, { useState, useEffect } from 'react';
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
import { ArrowLeft, User, Phone, Mail, Calendar, MapPin, AlertCircle, FileText, Plus, X } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

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

    useEffect(() => {
        fetchPatientDetails();
    }, [id]);

    const handleSubmitLabRequest = async () => {
        if (!labTitle.trim()) {
            Alert.alert("Required", "Please enter a title for the lab request.");
            return;
        }

        setSubmittingLab(true);
        try {
            const token = await SecureStore.getItemAsync('token');
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

    const fetchPatientDetails = async () => {
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

    const { patient, appointments, medicalRecords, summary } = patientData;

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

                    {/* Recent Appointments */}
                    {appointments.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Recent Appointments</Text>
                            {appointments.slice(0, 5).map((appointment: any) => (
                                <View key={appointment._id} style={styles.listItem}>
                                    <View style={styles.listItemIcon}>
                                        <Calendar size={16} color="#06b6d4" />
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <Text style={styles.listItemTitle}>{appointment.doctorName}</Text>
                                        <Text style={styles.listItemSubtitle}>
                                            {formatDate(appointment.date)} • {appointment.status}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

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
                            <TouchableOpacity 
                                style={styles.addButton}
                                onPress={() => setShowLabRequestModal(true)}
                            >
                                <Plus size={16} color="#06b6d4" />
                                <Text style={styles.addButtonText}>Request Lab</Text>
                            </TouchableOpacity>
                        </View>
                        {medicalRecords.length > 0 ? (
                            medicalRecords.slice(0, 5).map((record: any) => (
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
                    onRequestClose={() => setShowViewRecordModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContentCard}>
                            <View style={styles.modalHeaderRow}>
                                <Text style={styles.modalTitle} numberOfLines={1}>{selectedRecordData?.fileName || 'Record Details'}</Text>
                                <TouchableOpacity onPress={() => setShowViewRecordModal(false)}>
                                    <X size={24} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.recordDetailContainer}>
                                    <View style={styles.recordMetaRow}>
                                        <Text style={styles.recordMetaText}>Type: {selectedRecordData?.fileType || 'N/A'}</Text>
                                    </View>
                                    
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
                                    onPress={() => setShowViewRecordModal(false)}
                                >
                                    <Text style={styles.modalButtonCancelText}>Close</Text>
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
