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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PatientBottomNavBar from '../../components/PatientBottomNavBar';
import { FileText, Download, Filter } from 'lucide-react-native';
import { useAuth } from '@/context/auth';

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

    useEffect(() => {
        fetchRecords();
    }, []);

    useEffect(() => {
        applyFilter();
    }, [selectedFilter, records]);

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
        if (selectedFilter === 'all') {
            setFilteredRecords(records);
        } else {
            setFilteredRecords(records.filter(record => record.type === selectedFilter));
        }
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
                        <View style={styles.recordCard}>
                            <View style={[
                                styles.iconBox,
                                { backgroundColor: `${getRecordColor(item.type)}15` }
                            ]}>
                                <Text style={styles.iconEmoji}>{getRecordIcon(item.type)}</Text>
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.recordTitle}>{item.title}</Text>
                                <Text style={styles.recordDetail}>
                                    {item.type.replace('_', ' ').toUpperCase()} • {item.doctorName}
                                </Text>
                                <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
                                {item.description && (
                                    <Text style={styles.recordDescription} numberOfLines={2}>
                                        {item.description}
                                    </Text>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.downloadButton}
                                onPress={() => Alert.alert('Download', 'Download functionality coming soon')}
                            >
                                <Download size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },

    filterContainer: {
        maxHeight: 60,
        paddingHorizontal: 20,
        marginBottom: 10,
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
    recordCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    iconEmoji: {
        fontSize: 24,
    },
    info: { flex: 1 },
    recordTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
    recordDetail: { fontSize: 13, color: '#64748b', marginBottom: 2 },
    recordDate: { fontSize: 12, color: '#94a3b8' },
    recordDescription: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 4,
        fontStyle: 'italic'
    },

    downloadButton: {
        padding: 8,
    },

    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { color: '#94a3b8', marginTop: 10, fontSize: 14 },
});
