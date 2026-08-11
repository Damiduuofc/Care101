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
    RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, FileText, Award } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/context/auth';
import PatientBottomNavBar from '@/components/PatientBottomNavBar';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

export default function PatientRecordsListScreen() {
    const router = useRouter();
    const { user } = useAuth();
    
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchRecords();
    }, [user]);

    const fetchRecords = async () => {
        try {
            const token = await SecureStore.getItemAsync('token');
            const patientId = user?.patientId;
            const patientNIC = user?.nicNumber || user?.nic;

            let url = `${API_URL}/surgery-records/patient/my-records?`;
            if (patientId) {
                url += `patientId=${encodeURIComponent(patientId)}`;
            } else if (patientNIC) {
                url += `nic=${encodeURIComponent(patientNIC)}`;
            } else {
                console.warn('No Patient ID or NIC found in user profile');
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
                console.error('Failed to fetch records:', errorText);
            }
        } catch (error) {
            console.error('Fetch Records Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
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
        const doctorName = (r.doctorName || r.doctorId?.name || '').toLowerCase();
        const hospital = (r.hospital || r.doctorId?.hospital || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return doctorName.includes(query) || hospital.includes(query);
    });

    const renderRecordItem = ({ item }: any) => {
        const doctorName = item.doctorName || item.doctorId?.name || 'Dr. Unknown';
        const slmcReg = item.doctorId?.slmcReg || 'N/A';
        const hospitalName = item.hospital || item.doctorId?.hospital || 'N/A';
        const lastUpdate = formatDate(item.updatedAt || item.date || item.createdAt);

        return (
            <TouchableOpacity
                style={styles.doctorCard}
                onPress={() => router.push(`/patient-dashboard/records/${item._id}` as any)}
                activeOpacity={0.7}
            >
                <View style={styles.doctorCardMain}>
                    <View style={styles.doctorAvatarContainer}>
                        <Text style={styles.avatarText}>👨‍⚕️</Text>
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
        fontSize: 24,
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
});
