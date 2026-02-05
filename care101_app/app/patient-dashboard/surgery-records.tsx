import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    RefreshControl,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, FileText, Building2, ChevronRight, Image as ImageIcon } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/context/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

export default function PatientSurgeryRecordsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchSurgeryRecords();
    }, []);

    const fetchSurgeryRecords = async () => {
        try {
            setLoading(true);
            const token = await SecureStore.getItemAsync('token');

            // Debug: Log user data
            console.log('User data:', user);
            console.log('User nicNumber:', user?.nicNumber);
            console.log('User nic:', user?.nic);

            // Try both nicNumber and nic for compatibility
            const patientNIC = user?.nicNumber || user?.nic;

            if (!patientNIC) {
                console.error('No NIC found in user profile');
                Alert.alert('Error', 'NIC not found in profile. Please update your profile.');
                setLoading(false);
                return;
            }

            const url = `${API_URL}/surgery-records/patient/my-records?nic=${encodeURIComponent(patientNIC)}`;
            console.log('Fetching from URL:', url);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Fetched records:', data);
                console.log('Number of records:', data.length);
                setRecords(data);
            } else {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                Alert.alert('Error', `Failed to fetch surgery records: ${errorText}`);
            }
        } catch (error) {
            console.error('Fetch Surgery Records Error:', error);
            Alert.alert('Error', 'Connection failed. Please check your internet connection.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchSurgeryRecords();
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

    const renderRecordItem = ({ item }: any) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/patient-dashboard/surgery-records/${item._id}` as any)}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.patientName}>{item.name}</Text>
                <ChevronRight size={20} color="#cbd5e1" />
            </View>

            <View style={styles.cardContent}>
                <Text style={styles.detailText}>Doctor: {item.doctorName || 'Unknown'}</Text>
                <Text style={styles.detailText}>Hospital: {item.hospital || 'N/A'}</Text>
                <Text style={styles.dateText}>Created: {formatDate(item.createdAt)}</Text>
            </View>

            <View style={styles.cardFooter}>
                <View style={styles.badge}>
                    <ImageIcon size={14} color="#3b82f6" style={styles.badgeIcon} />
                    <Text style={styles.badgeText}>Surgery Card</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#0d9488" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Surgery Records</Text>
                </View>

                <FlatList
                    data={records}
                    keyExtractor={(item: any) => item._id}
                    renderItem={renderRecordItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#0d9488']}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <FileText size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No surgery records found</Text>
                            <Text style={styles.emptySubtext}>
                                Your surgery records will appear here when added by your doctor
                            </Text>
                        </View>
                    }
                />
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
    title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },

    listContent: { padding: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
    },
    patientName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    cardContent: { marginBottom: 12 },
    detailText: { fontSize: 14, color: '#64748b', marginBottom: 2 },
    dateText: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12
    },
    badge: { flexDirection: 'row', alignItems: 'center' },
    badgeIcon: { marginRight: 4 },
    badgeText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyText: {
        color: '#94a3b8',
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
    },
    emptySubtext: {
        color: '#cbd5e1',
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center',
    },
});
