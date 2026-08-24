import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    StatusBar,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    ScrollView,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, FileText, Award, X, Download } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/context/auth';
import PatientBottomNavBar from '@/components/PatientBottomNavBar';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PatientRecordsListScreen() {
    const router = useRouter();
    const { user } = useAuth();
    
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedRecordData, setSelectedRecordData] = useState<any>(null);
    const [showViewRecordModal, setShowViewRecordModal] = useState(false);
    const [fetchingRecord, setFetchingRecord] = useState(false);

    useEffect(() => {
        fetchRecords();
    }, [user]);

    const fetchRecords = async () => {
        try {
            const token = await SecureStore.getItemAsync('token');
            const patientId = user?.patientId;
            const patientNIC = user?.nicNumber || user?.nic;

            if (!patientId && !patientNIC) {
                console.warn('No Patient ID or NIC found in user profile');
                setLoading(false);
                return;
            }

            let surgeryUrl = `${API_URL}/surgery-records/patient/my-records?`;
            if (patientId) {
                surgeryUrl += `patientId=${encodeURIComponent(patientId)}`;
            } else if (patientNIC) {
                surgeryUrl += `nic=${encodeURIComponent(patientNIC)}`;
            }

            const [surgeryRes, medicalRes] = await Promise.all([
                fetch(surgeryUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    }
                }),
                fetch(`${API_URL}/medical-records/my-records`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    }
                })
            ]);

            let surgeryData = [];
            if (surgeryRes.ok) {
                surgeryData = await surgeryRes.json();
            }

            let medicalData = [];
            if (medicalRes.ok) {
                medicalData = await medicalRes.json();
            }

            const formattedSurgery = surgeryData.map((s: any) => ({
                ...s,
                isSurgery: true
            }));

            // Filter for reports uploaded by Lab Assistant (or containing lab assistant)
            const directLabReports = medicalData
                .filter((m: any) => m.doctorName === "Lab Assistant" || m.doctorName?.toLowerCase().includes("lab assistant"))
                .map((m: any) => ({
                    ...m,
                    isSurgery: false
                }));

            const combined = [...formattedSurgery, ...directLabReports].sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.date || a.createdAt);
                const dateB = new Date(b.updatedAt || b.date || b.createdAt);
                return dateB.getTime() - dateA.getTime();
            });

            setRecords(combined);
        } catch (error) {
            console.error('Fetch Records Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
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

    const onRefresh = () => {
        setRefreshing(true);
        fetchRecords();
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

    const filteredRecords = records.filter((r: any) => {
        const query = searchQuery.toLowerCase();
        if (r.isSurgery) {
            const doctorName = (r.doctorName || r.doctorId?.name || '').toLowerCase();
            const hospital = (r.hospital || r.doctorId?.hospital || '').toLowerCase();
            return doctorName.includes(query) || hospital.includes(query);
        } else {
            const title = (r.title || '').toLowerCase();
            const doctorName = (r.doctorName || '').toLowerCase();
            return title.includes(query) || doctorName.includes(query);
        }
    });

    const getInitials = (name: string) => {
        if (!name) return 'DR';
        let cleanName = name.replace(/^(dr|dr\.)\s+/i, '').trim();
        const parts = cleanName.split(/\s+/).filter(p => p !== '');
        if (parts.length === 0) return 'DR';
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const renderRecordItem = ({ item }: any) => {
        if (item.isSurgery) {
            const doctorName = item.doctorName || item.doctorId?.name || 'Dr. Unknown';
            const slmcReg = item.doctorSlmc || item.doctorId?.slmcReg || 'N/A';
            const hospitalName = item.doctorHospital || item.hospital || item.doctorId?.hospital || 'N/A';
            const lastUpdate = formatDate(item.updatedAt || item.date || item.createdAt);

            return (
                <TouchableOpacity
                    style={styles.doctorCard}
                    onPress={() => router.push(`/patient-dashboard/records/${item._id}` as any)}
                    activeOpacity={0.7}
                >
                    <View style={styles.doctorCardMain}>
                        <View style={styles.doctorAvatarContainer}>
                            <Text style={styles.avatarText}>{getInitials(doctorName)}</Text>
                        </View>
                        <View style={styles.doctorInfo}>
                            <Text style={styles.doctorNameText}>{doctorName}</Text>
                            <Text style={styles.specializationText}>SURGERY RECORD</Text>
                            
                            <View style={styles.detailRow}>
                                <Award size={14} color="#64748b" style={styles.inlineIcon} />
                                <Text style={styles.infoText}>SLMC: {slmcReg}</Text>
                            </View>
                            
                            <Text style={styles.hospitalText}>Hospital: {hospitalName}</Text>
                            <Text style={styles.dateText}>Last Updated: {lastUpdate}</Text>
                        </View>
                        <ChevronRight size={20} color="#94a3b8" />
                    </View>
                    <View style={styles.doctorCardFooter}>
                        <View style={styles.badge}>
                            <FileText size={12} color="#0d9488" style={styles.badgeIcon} />
                            <Text style={styles.badgeText}>Medical Report</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        } else {
            const title = item.title || 'Lab Report';
            const lastUpdate = formatDate(item.updatedAt || item.date || item.createdAt);

            return (
                <TouchableOpacity
                    style={[styles.doctorCard, { borderColor: '#bae6fd' }]}
                    onPress={() => handleViewRecord(item._id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.doctorCardMain}>
                        <View style={[styles.doctorAvatarContainer, { backgroundColor: '#e0f2fe', borderColor: '#bae6fd' }]}>
                            <Text style={[styles.avatarText, { color: '#0284c7' }]}>LAB</Text>
                        </View>
                        <View style={styles.doctorInfo}>
                            <Text style={styles.doctorNameText}>{title}</Text>
                            <Text style={[styles.specializationText, { color: '#0284c7' }]}>LAB REPORT</Text>
                            
                            <View style={styles.detailRow}>
                                <Award size={14} color="#64748b" style={styles.inlineIcon} />
                                <Text style={styles.infoText}>Uploaded by: Lab Assistant</Text>
                            </View>
                            
                            <Text style={styles.hospitalText}>Hospital: Care101 Lab</Text>
                            <Text style={styles.dateText}>Date: {lastUpdate}</Text>
                        </View>
                        <ChevronRight size={20} color="#94a3b8" />
                    </View>
                    <View style={styles.doctorCardFooter}>
                        <View style={[styles.badge, { backgroundColor: '#f0f9ff' }]}>
                            <FileText size={12} color="#0284c7" style={styles.badgeIcon} />
                            <Text style={[styles.badgeText, { color: '#0284c7' }]}>View / Download</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Medical Records</Text>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Search size={20} color="#94a3b8" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by doctor or hospital..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#06b6d4" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={filteredRecords}
                        keyExtractor={(item: any) => item._id}
                        renderItem={renderRecordItem}
                        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={['#06b6d4']}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>No medical records found</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>

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

            <PatientBottomNavBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    searchInput: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        color: '#0f172a',
    },
    listContent: {
        padding: 20,
    },
    doctorCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    doctorCardMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    doctorAvatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#cffafe',
        overflow: 'hidden',
        marginRight: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#06b6d4',
    },
    doctorInfo: {
        flex: 1,
    },
    doctorNameText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 2,
    },
    specializationText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#06b6d4',
        marginBottom: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    inlineIcon: {
        marginRight: 4,
    },
    infoText: {
        fontSize: 13,
        color: '#64748b',
    },
    hospitalText: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 2,
    },
    dateText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    doctorCardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12,
        marginTop: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0fdfa',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeIcon: {
        marginRight: 4,
    },
    badgeText: {
        fontSize: 12,
        color: '#0d9488',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#94a3b8',
    },
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
    fetchingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    fetchingBox: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    fetchingText: {
        marginTop: 12,
        color: '#0f172a',
        fontSize: 15,
        fontWeight: '600',
    },
});
