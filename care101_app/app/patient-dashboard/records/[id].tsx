import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert, StatusBar, Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
    ArrowLeft, 
    FileText, 
    X, 
    Calendar,
    Building2,
    Award,
    Download,
    FlaskConical,
    Activity,
    ImageIcon
} from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/surgery-records`;

export default function PatientRecordDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();

    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // --- LAB REPORTS STATE & HANDLERS ---
    const [labReports, setLabReports] = useState<any[]>([]);
    const [labRequests, setLabRequests] = useState<any[]>([]);
    const [selectedRecordData, setSelectedRecordData] = useState<any>(null);
    const [showViewRecordModal, setShowViewRecordModal] = useState(false);
    const [fetchingRecord, setFetchingRecord] = useState(false);

    useEffect(() => {
        fetchRecordDetails();
    }, [id]);

    const fetchRecordDetails = async () => {
        try {
            const token = await SecureStore.getItemAsync('token');
            const res = await fetch(`${API_URL}/${id}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'ngrok-skip-browser-warning': 'true'
                }
            });
            if (res.ok) {
                const data = await res.json();
                setRecord(data);

                // Fetch patient lab reports & requests
                try {
                    const baseApi = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';
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
                            
                            const cleanDoctorName = (name: string) => {
                                if (!name) return '';
                                return name
                                    .toLowerCase()
                                    .replace(/^(dr|dr\.)\s+/i, '')
                                    .replace(/[^a-z0-9]/g, '')
                                    .trim();
                            };

                            // Fetch completed medical records (patient's own endpoint)
                            const recordsRes = await fetch(`${baseApi}/medical-records/my-records`, {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                    'ngrok-skip-browser-warning': 'true'
                                }
                            });
                            if (recordsRes.ok) {
                                const recordsData = await recordsRes.json();
                                const labTests = recordsData.filter((r: any) => {
                                    if (r.type !== 'lab_tests') return false;
                                    const rDoc = cleanDoctorName(r.doctorName);
                                    const sDoc = cleanDoctorName(data.doctorName);
                                    return rDoc === sDoc && rDoc !== '';
                                });
                                setLabReports(labTests);
                            }

                            // Fetch lab requests (pending & completed)
                            const reqsRes = await fetch(`${baseApi}/lab-requests/patient/${patId}`, {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                    'ngrok-skip-browser-warning': 'true'
                                }
                            });
                            if (reqsRes.ok) {
                                const reqsData = await reqsRes.json();
                                const docReqs = reqsData.filter((req: any) => {
                                    const reqDoc = cleanDoctorName(req.doctorName);
                                    const sDoc = cleanDoctorName(data.doctorName);
                                    return reqDoc === sDoc && reqDoc !== '';
                                });
                                setLabRequests(docReqs);
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
            Alert.alert("Error", "Failed to load record");
        } finally {
            setLoading(false);
        }
    };

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
            const baseApi = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';
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

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color="#06b6d4" />
                <Text style={styles.loadingText}>Loading record details...</Text>
            </View>
        );
    }
    
    const otherReports = labReports.filter((report: any) => 
        !labRequests.some((req: any) => req.recordId === report._id)
    );

    if (!record) return null;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
            <SafeAreaView style={styles.safeArea}>

                {/* Detail Header */}
                <View style={styles.detailHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                        <ArrowLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.title} numberOfLines={1}>{record.name || 'Surgery Record'}</Text>
                        <Text style={styles.subtitleText}>Record Details</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                    {/* Doctor Info Card */}
                    <View style={styles.infoCard}>
                        <View style={styles.infoRow}>
                            <View style={styles.iconWrapper}>
                                <Award size={20} color="#06b6d4" />
                            </View>
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Doctor Name & SLMC Number</Text>
                                <Text style={styles.infoValue}>
                                    {record.doctorName || record.doctorId?.name || 'N/A'} • {record.doctorId?.slmcReg || 'N/A'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.infoRow}>
                            <View style={[styles.iconWrapper, { backgroundColor: '#f0fdf4' }]}>
                                <Building2 size={20} color="#10b981" />
                            </View>
                            <View style={styles.infoTextContainer}>
                                <Text style={styles.infoLabel}>Hospital / Clinic</Text>
                                <Text style={styles.infoValue}>
                                    {record.doctorId?.hospital || record.hospital || 'N/A'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Surgery Card (Original) */}
                    <Text style={styles.sectionHeader}>Surgery Document</Text>
                    <View style={styles.documentCard}>
                        {record.surgeryCardImage ? (
                            <View style={styles.imagePreviewContainer}>
                                <Image source={{ uri: record.surgeryCardImage }} style={styles.previewImage} />
                            </View>
                        ) : (
                            <View style={styles.noDocumentContainer}>
                                <ImageIcon size={40} color="#94a3b8" />
                                <Text style={styles.noDocumentText}>No surgery card image available</Text>
                            </View>
                        )}
                        
                        <View style={styles.documentMeta}>
                            <Text style={styles.documentTitle}>Surgery Reference</Text>
                            <Text style={styles.documentDesc}>Details of the surgical procedure and initial assessment records.</Text>
                        </View>

                        {record.surgeryCardImage && (
                            <TouchableOpacity
                                style={styles.primaryBtn}
                                activeOpacity={0.8}
                                onPress={() => handleDownloadFile(record.surgeryCardImage, 'Surgery_Card', 'image/png')}
                            >
                                <Download size={18} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.primaryBtnText}>Download Document</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Lab Requests (Pending / Completed) */}
                    <Text style={styles.sectionHeader}>Doctor's Lab Requests</Text>
                    {labRequests.length > 0 ? (
                        labRequests.map((req) => {
                            const isCompleted = req.status === 'completed';
                            const billStatus = req.billId?.status;
                            const billAmount = req.billId?.amount;

                            return (
                                <View key={req._id} style={styles.recordDetailCard}>
                                    <View style={styles.recordDetailCardHeader}>
                                        <View style={[styles.doctorAvatarContainer, { backgroundColor: '#cffafe', borderColor: '#a5f3fc' }]}>
                                            <FlaskConical size={24} color="#06b6d4" />
                                        </View>
                                        <View style={styles.recordDetailMain}>
                                            <Text style={styles.recordDetailCardTitle}>{req.title}</Text>
                                            <View style={styles.recordMetaChips}>
                                                <View style={[styles.chip, { backgroundColor: isCompleted ? '#f0fdf4' : '#fffbeb' }]}>
                                                    <Text style={[styles.chipText, { color: isCompleted ? '#10b981' : '#f59e0b' }]}>
                                                        {isCompleted ? 'COMPLETED' : 'PENDING LAB ACTION'}
                                                    </Text>
                                                </View>
                                                {billStatus && (
                                                    <View style={[styles.chip, { backgroundColor: billStatus === 'Paid' ? '#f0fdf4' : '#fef2f2' }]}>
                                                        <Text style={[styles.chipText, { color: billStatus === 'Paid' ? '#10b981' : '#ef4444' }]}>
                                                            {billStatus === 'Paid' ? 'PAID' : `UNPAID: LKR ${billAmount}`}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View style={styles.chipDate}>
                                                    <Calendar size={12} color="#64748b" style={{ marginRight: 4 }} />
                                                    <Text style={styles.chipDateText}>{formatDate(req.createdAt)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {req.description && (
                                        <View style={styles.recordDetailCardBody}>
                                            <Text style={styles.infoFieldText}>{req.description}</Text>
                                        </View>
                                    )}

                                    {isCompleted ? (
                                        <TouchableOpacity
                                            style={styles.viewReportBtn}
                                            onPress={() => handleViewRecord(req.recordId)}
                                            activeOpacity={0.8}
                                        >
                                            <FileText size={16} color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={styles.viewReportBtnText}>View Lab Report</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={styles.pendingActionBox}>
                                            <Text style={styles.pendingActionText}>
                                                Report will be uploaded by the lab assistant once testing is completed. {billStatus === 'Pending' ? 'Please complete the payment first.' : ''}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyStateContainer}>
                            <Text style={styles.emptyStateText}>No lab requests submitted by this doctor.</Text>
                        </View>
                    )}

                    {/* Other Lab Reports (Direct Uploads / Not linked to a request) */}
                    {otherReports.length > 0 && (
                        <>
                            <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Direct Uploaded Lab Reports</Text>
                            {otherReports.map((report) => (
                                <View key={report._id} style={styles.recordDetailCard}>
                                    <View key={report._id} style={styles.recordDetailCard}>
                                        <View style={styles.recordDetailCardHeader}>
                                            <View style={[styles.doctorAvatarContainer, { backgroundColor: '#cffafe', borderColor: '#a5f3fc' }]}>
                                                <FlaskConical size={24} color="#06b6d4" />
                                            </View>
                                            <View style={styles.recordDetailMain}>
                                                <Text style={styles.recordDetailCardTitle}>{report.title}</Text>
                                                <View style={styles.recordMetaChips}>
                                                    <View style={[styles.chip, { backgroundColor: '#cffafe' }]}>
                                                        <Text style={[styles.chipText, { color: '#06b6d4' }]}>DIRECT UPLOAD</Text>
                                                    </View>
                                                    <View style={styles.chipDate}>
                                                        <Calendar size={12} color="#64748b" style={{ marginRight: 4 }} />
                                                        <Text style={styles.chipDateText}>{formatDate(report.date)}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>

                                        {report.description && (
                                            <View style={styles.recordDetailCardBody}>
                                                <Text style={styles.infoFieldText}>{report.description}</Text>
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            style={styles.viewReportBtn}
                                            onPress={() => handleViewRecord(report._id)}
                                            activeOpacity={0.8}
                                        >
                                            <FileText size={16} color="#fff" style={{ marginRight: 8 }} />
                                            <Text style={styles.viewReportBtnText}>View Attachment</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </>
                    )}

                    {/* Progress Entries (Timeline) */}
                    <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Recovery Progress</Text>
                    {record.entries && record.entries.length > 0 ? (
                        record.entries.map((entry: any, index: number) => (
                            <View key={index} style={styles.timelineCard}>
                                <View style={styles.timelineHeaderRow}>
                                    <View style={styles.timelineIconWrapper}>
                                        <Activity size={16} color="#8b5cf6" />
                                    </View>
                                    <Text style={styles.timelineDate}>
                                        {new Date(entry.date).toLocaleString('en-US', {
                                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </Text>
                                </View>

                                {entry.notes && (
                                    <Text style={styles.timelineNotes}>{entry.notes}</Text>
                                )}

                                {entry.images && entry.images.length > 0 && (
                                    <View style={styles.timelineImageContainer}>
                                        <Image source={{ uri: entry.images[0] }} style={styles.timelineImage} />
                                    </View>
                                )}
                            </View>
                        ))
                    ) : (
                        <View style={styles.emptyStateContainer}>
                            <Activity size={32} color="#94a3b8" style={{ marginBottom: 12 }} />
                            <Text style={styles.emptyStateText}>No progress updates recorded yet.</Text>
                        </View>
                    )}

                </ScrollView>

                {/* View Record Modal */}
                <Modal visible={showViewRecordModal} transparent={true} animationType="fade" onRequestClose={() => setShowViewRecordModal(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContentCard}>
                            <View style={styles.modalHeaderRow}>
                                <View style={{ flex: 1, marginRight: 16 }}>
                                    <Text style={styles.modalTitle} numberOfLines={1}>{selectedRecordData?.fileName || 'Document'}</Text>
                                    <Text style={styles.modalSubtitle}>{selectedRecordData?.fileType || 'Attachment'}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowViewRecordModal(false)} style={styles.closeBtn}>
                                    <X size={20} color="#64748b" />
                                </TouchableOpacity>
                            </View>
                            
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <View style={styles.recordDetailContainer}>
                                    {selectedRecordData?.description && (
                                        <View style={{ marginBottom: 20 }}>
                                            <Text style={styles.modalLabel}>Description</Text>
                                            <Text style={styles.recordDescriptionText}>{selectedRecordData.description}</Text>
                                        </View>
                                    )}

                                    <Text style={styles.modalLabel}>Preview</Text>
                                    {selectedRecordData?.fileData ? (
                                        selectedRecordData.fileType?.startsWith('image/') || selectedRecordData.fileData?.startsWith('data:image/') ? (
                                            <View style={styles.imagePreviewContainerModal}>
                                                <Image 
                                                    source={{ uri: selectedRecordData.fileData }} 
                                                    style={styles.previewImageModal} 
                                                />
                                            </View>
                                        ) : (
                                            <View style={styles.pdfPreviewContainer}>
                                                <FileText size={48} color="#94a3b8" />
                                                <Text style={styles.pdfPreviewText}>PDF Document</Text>
                                                <Text style={styles.pdfPreviewSubtext}>Preview not available. Please download to view.</Text>
                                            </View>
                                        )
                                    ) : (
                                        <View style={styles.pdfPreviewContainer}>
                                            <Text style={styles.noImageText}>No file attachment available.</Text>
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                            
                            <View style={styles.modalButtonRow}>
                                {selectedRecordData?.fileData && (
                                    <TouchableOpacity 
                                        style={[styles.modalButton, styles.primaryModalBtn]}
                                        onPress={() => handleDownloadFile(selectedRecordData.fileData, selectedRecordData.fileName || 'Report', selectedRecordData.fileType)}
                                    >
                                        <Download size={18} color="#fff" style={{ marginRight: 6 }} />
                                        <Text style={styles.primaryModalBtnText}>Download</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.modalButtonCancel]}
                                    onPress={() => setShowViewRecordModal(false)}
                                >
                                    <Text style={styles.modalButtonCancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Fetching overlay */}
                {fetchingRecord && (
                    <View style={styles.fetchingOverlay}>
                        <View style={styles.fetchingBox}>
                            <ActivityIndicator size="large" color="#06b6d4" />
                            <Text style={styles.fetchingText}>Opening document...</Text>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { flex: 1 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 12, color: '#64748b', fontSize: 16, fontWeight: '500' },
    
    // Header
    detailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#f8fafc',
    },
    iconButton: { padding: 8, marginLeft: -8 },
    headerTextContainer: { flex: 1, marginLeft: 8 },
    title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
    subtitleText: { fontSize: 14, color: '#64748b', marginTop: 2 },

    content: { padding: 20, paddingBottom: 40 },
    sectionHeader: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16, marginLeft: 4 },

    // Info Card (Doctor Details)
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center' },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#e0f2fe',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    infoTextContainer: { flex: 1 },
    infoLabel: { fontSize: 13, color: '#64748b', marginBottom: 2 },
    infoValue: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 16 },

    // Surgery Document Card
    documentCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
    },
    imagePreviewContainer: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    noDocumentContainer: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        marginBottom: 16,
    },
    noDocumentText: { color: '#94a3b8', fontSize: 14, marginTop: 12, fontWeight: '500' },
    documentMeta: { marginBottom: 12 },
    documentTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    documentDesc: { fontSize: 14, color: '#64748b', lineHeight: 20 },
    
    primaryBtn: {
        flexDirection: 'row',
        backgroundColor: '#06b6d4',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

    // Lab Reports Cards
    recordDetailCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
    },
    recordDetailCardHeader: { flexDirection: 'row', marginBottom: 16 },
    doctorAvatarContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
    },
    recordDetailMain: { flex: 1, justifyContent: 'center' },
    recordDetailCardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
    recordMetaChips: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    chipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    chipDate: { flexDirection: 'row', alignItems: 'center' },
    chipDateText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    
    recordDetailCardBody: { marginBottom: 16 },
    infoFieldText: { fontSize: 15, color: '#475569', lineHeight: 22 },
    
    viewReportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#06b6d4',
    },
    viewReportBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

    // Timeline / Progress Entries
    timelineCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 12,
        elevation: 2,
        borderLeftWidth: 4,
        borderLeftColor: '#8b5cf6', // distinctive color for progress
    },
    timelineHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    timelineIconWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    timelineDate: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
    timelineNotes: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 12 },
    timelineImageContainer: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    timelineImage: { width: '100%', height: '100%', resizeMode: 'cover' },

    emptyStateContainer: {
        paddingVertical: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderStyle: 'dashed',
        marginBottom: 20,
    },
    emptyStateText: { color: '#64748b', fontSize: 14, fontWeight: '500' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContentCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 16,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    modalSubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500' },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
    recordDetailContainer: { marginVertical: 4 },
    recordDescriptionText: { fontSize: 15, color: '#475569', lineHeight: 24 },
    
    imagePreviewContainerModal: {
        width: '100%',
        height: 300,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    previewImageModal: { width: '100%', height: '100%', resizeMode: 'contain' },
    pdfPreviewContainer: {
        width: '100%',
        paddingVertical: 60,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pdfPreviewText: { color: '#475569', fontSize: 16, fontWeight: '600', marginTop: 16 },
    pdfPreviewSubtext: { color: '#94a3b8', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
    noImageText: { textAlign: 'center', color: '#94a3b8', fontSize: 15, padding: 20 },
    
    modalButtonRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    modalButton: { flex: 1, flexDirection: 'row', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    primaryModalBtn: { backgroundColor: '#06b6d4' },
    primaryModalBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    modalButtonCancel: { backgroundColor: '#f1f5f9' },
    modalButtonCancelText: { color: '#475569', fontSize: 15, fontWeight: '600' },

    // Fetching Overlay
    fetchingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    fetchingBox: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    fetchingText: { marginTop: 12, fontSize: 15, fontWeight: '600', color: '#0f172a' },
    pendingActionBox: {
        backgroundColor: '#f8fafc',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
        marginTop: 8,
    },
    pendingActionText: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 18,
    },
});