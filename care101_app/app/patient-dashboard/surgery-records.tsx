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
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/context/auth';
import PatientBottomNavBar from '../../components/PatientBottomNavBar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

export default function PatientSurgeryRecordsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchSurgeryRecords();
    }, []);

    const fetchSurgeryRecords = async () => {
        try {
            setLoading(true);
            const token = await SecureStore.getItemAsync('token');

            const patientId = user?.patientId;
            const patientNIC = user?.nicNumber || user?.nic;

            let url = `${API_URL}/surgery-records/patient/my-records?`;
            if (patientId) {
                url += `patientId=${encodeURIComponent(patientId)}`;
            } else if (patientNIC) {
                url += `nic=${encodeURIComponent(patientNIC)}`;
            } else {
                console.error('No Patient ID or NIC found in user profile');
                Alert.alert('Error', 'Patient identification details not found in profile.');
                setLoading(false);
                return;
            }

            const response = await fetch(url, {
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
                const errorText = await response.text();
                Alert.alert('Error', `Failed to fetch surgery records: ${errorText}`);
            }
        } catch (error) {
            console.error('Fetch Surgery Records Error:', error);
            Alert.alert('Error', 'Connection failed.');
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
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    const filteredRecords = records.filter((r: any) =>
        r.doctorName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderRecordItem = ({ item }: any) => {
        return (
            <View style={styles.recordCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.smallTitle}>SURGERY RECORD</Text>
                    <Text style={styles.doctorNameText}>{item.doctorName || 'Dr. Unknown'}</Text>
                    <Text style={styles.subtitleText}>Hospital: {item.hospital || 'N/A'}</Text>
                    <Text style={styles.dateText}>Last Update: {formatDate(item.updatedAt || item.date || item.createdAt)}</Text>
                </View>
                <View style={styles.cardFooter}>
                    <TouchableOpacity
                        style={styles.surgeryCardBtn}
                        onPress={() => router.push(`/patient-dashboard/surgery-records/${item._id}` as any)}
                    >
                        <Text style={styles.surgeryCardBtnText}>Surgery Card</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#00aeef" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Surgery Records</Text>
                    <TouchableOpacity style={styles.searchIconHeader}>
                        <Search size={24} color="#0f172a" />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search records..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                <FlatList
                    data={filteredRecords}
                    keyExtractor={(item: any) => item._id}
                    renderItem={renderRecordItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#00aeef']}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No surgery records found</Text>
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
        paddingTop: 10,
        paddingBottom: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    title: { fontSize: 22, fontWeight: '700', color: '#0f172a', textAlign: 'center', flex: 1 },
    searchIconHeader: { position: 'absolute', right: 20 },

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
        backgroundColor: '#f1f5f9',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#0f172a',
    },

    listContent: { padding: 20 },
    recordCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        marginBottom: 10,
    },
    smallTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#00b4d8',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    doctorNameText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 6,
    },
    subtitleText: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 4,
    },
    dateText: {
        fontSize: 14,
        color: '#64748b',
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    surgeryCardBtn: {
        backgroundColor: '#00aeef',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    surgeryCardBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: '#94a3b8',
        fontSize: 16,
        fontStyle: 'italic',
    },
});