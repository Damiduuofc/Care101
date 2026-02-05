import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, Plus, User, Phone, Calendar } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

export default function PatientsScreen() {
    const router = useRouter();
    const [patients, setPatients] = useState<any[]>([]);
    const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchPatients();
    }, []);

    useEffect(() => {
        filterPatients();
    }, [searchQuery, patients]);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const token = await SecureStore.getItemAsync('token');

            const response = await fetch(`${API_URL}/patients/all-patients`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPatients(data);
            } else {
                Alert.alert('Error', 'Failed to fetch patients');
            }
        } catch (error) {
            console.error('Fetch Patients Error:', error);
            Alert.alert('Error', 'Connection failed');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchPatients();
    };

    const filterPatients = () => {
        if (!searchQuery.trim()) {
            setFilteredPatients(patients);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = patients.filter(patient =>
                patient.fullName?.toLowerCase().includes(query) ||
                patient.username?.toLowerCase().includes(query) ||
                patient.nic?.toLowerCase().includes(query) ||
                patient.mobileNumber?.includes(query)
            );
            setFilteredPatients(filtered);
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

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Patients</Text>
                        <Text style={styles.subtitle}>Manage your patients</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => router.push('/dashboard/patients/add')}
                    >
                        <Plus size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Search size={20} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, NIC, or phone..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94a3b8"
                    />
                </View>

                {/* Patients List */}
                <FlatList
                    data={filteredPatients}
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
                            style={styles.patientCard}
                            onPress={() => router.push(`/dashboard/patients/${item._id}`)}
                        >
                            <View style={styles.avatarContainer}>
                                <User size={24} color="#06b6d4" />
                            </View>
                            <View style={styles.patientInfo}>
                                <Text style={styles.patientName}>{item.fullName}</Text>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailText}>
                                        NIC: {item.nic || 'N/A'}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Phone size={12} color="#64748b" />
                                    <Text style={styles.detailText}>
                                        {item.mobileNumber || 'N/A'}
                                    </Text>
                                </View>
                                {item.dateOfBirth && (
                                    <View style={styles.detailRow}>
                                        <Calendar size={12} color="#64748b" />
                                        <Text style={styles.detailText}>
                                            Age: {calculateAge(item.dateOfBirth)} years
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.genderBadge}>
                                <Text style={styles.genderText}>
                                    {item.gender?.charAt(0) || '?'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <User size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>
                                {searchQuery ? 'No patients found' : 'No patients yet'}
                            </Text>
                            <TouchableOpacity
                                style={styles.emptyButton}
                                onPress={() => router.push('/dashboard/patients/add')}
                            >
                                <Text style={styles.emptyButtonText}>Add Patient</Text>
                            </TouchableOpacity>
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
        paddingTop: 20,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },
    addButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#06b6d4',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#0f172a',
    },

    listContainer: { paddingHorizontal: 20, paddingBottom: 20 },
    patientCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    patientInfo: {
        flex: 1,
    },
    patientName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 4,
    },
    detailText: {
        fontSize: 13,
        color: '#64748b',
    },
    genderBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    genderText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748b',
    },

    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: '#94a3b8',
        marginTop: 10,
        fontSize: 14,
        marginBottom: 20,
    },
    emptyButton: {
        backgroundColor: '#06b6d4',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
});
