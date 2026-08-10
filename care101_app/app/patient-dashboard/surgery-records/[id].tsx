import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert, StatusBar, Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Activity, Heart, FileText, CheckCircle2, X } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/surgery-records`;

export default function PatientRecordDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();

    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // --- LAB REPORTS STATE & HANDLERS ---
    const [labReports, setLabReports] = useState<any[]>([]);
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

                // Fetch patient lab reports
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

    const getEntryTitleAndNote = (notes: string) => {
        if (!notes) return { title: 'Progress Update', subtitle: '' };
        if (notes.includes(':')) {
            const parts = notes.split(':');
            return {
                title: parts[0].trim(),
                subtitle: parts.slice(1).join(':').trim()
            };
        }
        return {
            title: 'Recovery Progress',
            subtitle: notes
        };
    };

    const getProgressValueOrIcon = (notes: string) => {
        if (!notes) return { type: 'check', value: null };
        const percentMatch = notes.match(/\d+%/g);
        if (percentMatch) {
            return { type: 'percent', value: percentMatch[0] };
        }
        return { type: 'check', value: null };
    };

    const getEntryIcon = (title: string) => {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('mobility') || lowerTitle.includes('walk') || lowerTitle.includes('exercise') || lowerTitle.includes('motion')) {
            return <Activity size={24} color="#00aeef" />;
        }
        if (lowerTitle.includes('pain') || lowerTitle.includes('medication') || lowerTitle.includes('pill') || lowerTitle.includes('drug') || lowerTitle.includes('management')) {
            return <Heart size={24} color="#00aeef" />;
        }
        return <FileText size={24} color="#00aeef" />;
    };

    if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#00aeef" />;
    if (!record) return null;

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft size={24} color="#0f172a" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{record.doctorName || 'Dr. Damidu Abeysinghe'}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Card 1: Doctor Details */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Doctor Details</Text>
                    <View style={styles.divider} />
                    <View style={styles.detailRow}>
                        <Text style={styles.detailText}>Doctor Name: {record.doctorName || 'N/A'}</Text>
                        <Text style={styles.detailText}>Hospital: {record.hospital || 'N/A'}</Text>
                    </View>
                </View>

                {/* Card 2: Surgery Card (Original) */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Surgery Card (Original)</Text>
                    <View style={styles.divider} />
                    {record.surgeryCardImage ? (
                        <View style={styles.imageWrapper}>
                            <Image source={{ uri: record.surgeryCardImage }} style={styles.cardImage} resizeMode="contain" />
                        </View>
                    ) : (
                        <View style={styles.noImageContainer}>
                            <Text style={styles.noImageText}>No surgery card image available</Text>
                        </View>
                    )}
                    <View style={styles.captionContainer}>
                        <Text style={styles.captionTitle}>Surgery Reference</Text>
                        <Text style={styles.captionText}>Details of the surgical procedure and initial assessment records.</Text>
                    </View>
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
                <Text style={styles.sectionHeader}>Recovery Progress</Text>

                {record.entries && record.entries.length > 0 ? (
                    record.entries.map((entry: any, index: number) => {
                        const parsed = getEntryTitleAndNote(entry.notes);
                        const progress = getProgressValueOrIcon(entry.notes);

                        return (
                            <View key={index} style={styles.entryCard}>
                                <View style={styles.iconContainer}>
                                    {getEntryIcon(parsed.title)}
                                </View>
                                <View style={styles.entryInfo}>
                                    <Text style={styles.entryTitle}>{parsed.title}</Text>
                                    <Text style={styles.entrySubtitle}>
                                        {parsed.subtitle || `Last updated: ${new Date(entry.date).toLocaleDateString()}`}
                                    </Text>
                                </View>
                                <View style={styles.statusContainer}>
                                    {progress.type === 'percent' ? (
                                        <Text style={styles.percentText}>{progress.value}</Text>
                                    ) : (
                                        <CheckCircle2 size={24} color="#00aeef" />
                                    )}
                                </View>
                            </View>
                        );
                    })
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No progress updates yet.</Text>
                    </View>
                )}

            </ScrollView>

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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backBtn: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
    content: { padding: 20, paddingBottom: 60 },

    // Cards
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
    detailRow: { gap: 8 },
    detailText: { fontSize: 15, color: '#475569', fontWeight: '500' },

    imageWrapper: {
        width: '100%',
        height: 280,
        backgroundColor: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardImage: { width: '100%', height: '100%' },
    noImageContainer: {
        width: '100%',
        height: 150,
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed',
    },
    noImageText: { color: '#94a3b8', fontSize: 14, fontStyle: 'italic' },

    captionContainer: { marginTop: 12 },
    captionTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 4 },
    captionText: { fontSize: 14, color: '#64748b', lineHeight: 20 },

    sectionHeader: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16, marginTop: 8 },

    entryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 6,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#e0f7fa',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    entryInfo: { flex: 1 },
    entryTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    entrySubtitle: { fontSize: 13, color: '#64748b' },
    statusContainer: { marginLeft: 12, justifyContent: 'center', alignItems: 'center' },
    percentText: { fontSize: 18, fontWeight: '700', color: '#00aeef' },

    emptyState: { padding: 20, alignItems: 'center' },
    emptyText: { color: '#94a3b8', fontStyle: 'italic' },

    // Lab Reports styling
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

    // Modal styles
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
