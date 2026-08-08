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
import { ArrowLeft, Calendar, FileText, Building2, ChevronRight, Image as ImageIcon, Search } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/context/auth';

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

            // Debug: Log user data
            console.log('User data:', user);
            console.log('User nicNumber:', user?.nicNumber);
            console.log('User nic:', user?.nic);
            console.log('User patientId:', user?.patientId);

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

    const filteredRecords = records.filter((r: any) =>
        r.doctorName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderRecordItem = ({ item }: any) => {
        const docImage = item.doctorProfileImage ? { uri: item.doctorProfileImage } : null;

        return (
            <TouchableOpacity
                style={styles.doctorCard}
                onPress={() => router.push(`/patient-dashboard/surgery-records/${item._id}` as any)}
            >
                <View style={styles.doctorCardMain}>
                    <View style={styles.doctorAvatarContainer}>
                        {docImage ? (
                            <Image source={docImage} style={styles.doctorAvatar} />
                        ) : (
                            <View style={styles.doctorAvatarFallback}>
                                <Text style={styles.avatarText}>
                                    {item.doctorName ? item.doctorName.replace('Dr. ', '').substring(0, 2).toUpperCase() : 'DR'}
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.doctorInfo}>
                        <Text style={styles.doctorNameText}>{item.doctorName || 'Unknown Doctor'}</Text>
                        <Text style={styles.specializationText}>{item.doctorSpecialization || 'General Practitioner'}</Text>
                        <Text style={styles.hospitalText}>{item.hospital || 'N/A'}</Text>
                        <Text style={styles.dateText}>Date: {formatDate(item.createdAt)}</Text>
                    </View>
                    <ChevronRight size={20} color="#94a3b8" />
                </View>
                <View style={styles.doctorCardFooter}>
                    <View style={styles.badge}>
                        <ImageIcon size={14} color="#0d9488" style={styles.badgeIcon} />
                        <Text style={styles.badgeText}>Surgery Card Available</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

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

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchBar}>
                        <Search size={20} color="#94a3b8" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by Doctor Name..."
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
    },
    backButton: { marginRight: 12 },
    title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },

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

    listContent: { padding: 20 },
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
    doctorAvatar: {
        width: '100%',
        height: '100%',
    },
    doctorAvatarFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: '#e0f2fe',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0284c7',
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
        color: '#0d9488',
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
