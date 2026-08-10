import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Modal,
    Image,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PatientBottomNavBar from '../../components/PatientBottomNavBar';
import { FileText, Download, Filter, X, Search, ChevronRight, Image as ImageIcon } from 'lucide-react-native';
import { useAuth } from '@/context/auth';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

const RECORD_TYPES = [
    { id: 'all', label: 'All Records' },
    { id: 'prescriptions', label: 'Prescriptions' },
    { id: 'lab_tests', label: 'Lab Tests' },
    { id: 'reports', label: 'Reports' },
    { id: 'consultations', label: 'Consultations' },
];

export default function MedicalRecordsScreen() {
    const { token } = useAuth();
    const [records, setRecords] = useState<any[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // View Record States
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
        if (token) {
            fetchRecords();
        }
    }, [token]);

    const handleViewRecord = async (recordId: string) => {
        setFetchingRecord(true);
        try {
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

    useEffect(() => {
        applyFilter();
    }, [selectedFilter, searchQuery, records]);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/medical-records/my-records`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setRecords(data);
            } else {
                Alert.alert('Error', 'Failed to fetch medical records');
            }
        } catch (error) {
            console.error('Fetch Records Error:', error);
            Alert.alert('Error', 'Connection failed');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchRecords();
    };

    const applyFilter = () => {
        let baseRecords = records;
        if (selectedFilter !== 'all') {
            baseRecords = records.filter(record => record.type === selectedFilter);
        }
        if (searchQuery.trim() !== '') {
            baseRecords = baseRecords.filter(record => 
                record.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.doctorName?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredRecords(baseRecords);
    };

    const getRecordIcon = (type: string) => {
        const iconMap: any = {
            prescriptions: '💊',
            lab_tests: '🧪',
            reports: '📋',
            consultations: '👨‍⚕️',
        };
        return iconMap[type] || '📄';
    };

    const getRecordColor = (type: string) => {
        const colorMap: any = {
            prescriptions: '#8b5cf6',
            lab_tests: '#06b6d4',
            reports: '#f59e0b',
            consultations: '#10b981',
        };
        return colorMap[type] || '#64748b';
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Medical Records</Text>
                        <Text style={styles.subtitle}>Access your medical history</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Title or Doctor Name..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {/* Filter Tabs */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterContainer}
                    contentContainerStyle={styles.filterContent}
                >
                    {RECORD_TYPES.map((type) => (
                        <TouchableOpacity
                            key={type.id}
                            style={[
                                styles.filterTab,
                                selectedFilter === type.id && styles.filterTabActive
                            ]}
                            onPress={() => setSelectedFilter(type.id)}
                        >
                            <Text style={[
                                styles.filterTabText,
                                selectedFilter === type.id && styles.filterTabTextActive
                            ]}>
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <FlatList
                    data={filteredRecords}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#06b6d4']}
                        />
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.doctorCard}
                            onPress={() => handleViewRecord(item._id)}
                        >
                            <View style={styles.doctorCardMain}>
                                <View style={[styles.doctorAvatarContainer, { backgroundColor: `${getRecordColor(item.type)}15` }]}>
                                    <Text style={styles.avatarText}>
                                        {getRecordIcon(item.type)}
                                    </Text>
                                </View>
                                <View style={styles.doctorInfo}>
                                    <Text style={styles.doctorNameText}>{item.title || 'Unknown Record'}</Text>
                                    <Text style={[styles.specializationText, { color: getRecordColor(item.type) }]}>
                                        {item.type.replace('_', ' ').toUpperCase()}
                                    </Text>
                                    <Text style={styles.hospitalText}>Doctor: {item.doctorName || 'N/A'}</Text>
                                    <Text style={styles.dateText}>Date: {formatDate(item.date)}</Text>
                                </View>
                                <ChevronRight size={20} color="#94a3b8" />
                            </View>
                            {item.description ? (
                                <View style={styles.doctorCardFooter}>
                                    <View style={[styles.badge, { backgroundColor: `${getRecordColor(item.type)}10` }]}>
                                        <FileText size={14} color={getRecordColor(item.type)} style={styles.badgeIcon} />
                                        <Text style={[styles.badgeText, { color: getRecordColor(item.type) }]} numberOfLines={1}>
                                            {item.description}
                                        </Text>
                                    </View>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>
                                {selectedFilter === 'all'
                                    ? 'No records found'
                                    : `No ${selectedFilter.replace('_', ' ')} found`}
                            </Text>
                        </View>
                    }
                />
            </SafeAreaView>

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

            {/* Fetching overlay */}
            {fetchingRecord && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }]}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                </View>
            )}

            <PatientBottomNavBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { flex: 1, marginBottom: 80 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
        backgroundColor: '#fff',
    },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },

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
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#0f172a',
    },

    filterContainer: {
        maxHeight: 60,
        paddingHorizontal: 20,
        marginVertical: 10,
    },
    filterContent: {
        paddingVertical: 10,
        gap: 8,
    },
    filterTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
    },
    filterTabActive: {
        backgroundColor: '#06b6d4',
    },
    filterTabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    filterTabTextActive: {
        color: '#fff',
    },

    listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
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
        backgroundColor: '#f1f5f9',
        overflow: 'hidden',
        marginRight: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: '700',
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
        marginBottom: 4,
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
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        flex: 1,
    },
    badgeIcon: {
        marginRight: 4,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        flex: 1,
    },

    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 14 },
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
    modalButtonCancel: {
        backgroundColor: '#f1f5f9',
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
