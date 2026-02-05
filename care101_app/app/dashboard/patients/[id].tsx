import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, User, Phone, Mail, Calendar, MapPin, AlertCircle, FileText } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

export default function PatientDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [patientData, setPatientData] = useState<any>(null);

    useEffect(() => {
        fetchPatientDetails();
    }, [id]);

    const fetchPatientDetails = async () => {
        try {
            setLoading(true);
            const token = await SecureStore.getItemAsync('token');

            const response = await fetch(`${API_URL}/patient/${id}/medical-history`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPatientData(data);
            } else {
                Alert.alert('Error', 'Failed to fetch patient details');
            }
        } catch (error) {
            console.error('Fetch Patient Error:', error);
            Alert.alert('Error', 'Connection failed');
        } finally {
            setLoading(false);
        }
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

    if (!patientData) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.errorText}>Patient not found</Text>
            </View>
        );
    }

    const { patient, appointments, medicalRecords, summary } = patientData;

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Patient Details</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Patient Info Card */}
                    <View style={styles.card}>
                        <View style={styles.avatarLarge}>
                            <User size={48} color="#06b6d4" />
                        </View>
                        <Text style={styles.patientName}>{patient.fullName}</Text>
                        <Text style={styles.patientUsername}>@{patient.username}</Text>

                        <View style={styles.infoGrid}>
                            <View style={styles.infoItem}>
                                <Calendar size={16} color="#64748b" />
                                <Text style={styles.infoLabel}>Age</Text>
                                <Text style={styles.infoValue}>{calculateAge(patient.dateOfBirth)} years</Text>
                            </View>
                            <View style={styles.infoItem}>
                                <User size={16} color="#64748b" />
                                <Text style={styles.infoLabel}>Gender</Text>
                                <Text style={styles.infoValue}>{patient.gender || 'N/A'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Contact Information */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contact Information</Text>
                        <View style={styles.card}>
                            <View style={styles.contactRow}>
                                <Phone size={20} color="#06b6d4" />
                                <View style={styles.contactInfo}>
                                    <Text style={styles.contactLabel}>Mobile</Text>
                                    <Text style={styles.contactValue}>{patient.mobileNumber || 'N/A'}</Text>
                                </View>
                            </View>
                            <View style={styles.contactRow}>
                                <Mail size={20} color="#06b6d4" />
                                <View style={styles.contactInfo}>
                                    <Text style={styles.contactLabel}>Email</Text>
                                    <Text style={styles.contactValue}>{patient.email}</Text>
                                </View>
                            </View>
                            <View style={styles.contactRow}>
                                <MapPin size={20} color="#06b6d4" />
                                <View style={styles.contactInfo}>
                                    <Text style={styles.contactLabel}>NIC</Text>
                                    <Text style={styles.contactValue}>{patient.nic}</Text>
                                </View>
                            </View>
                            {patient.emergencyContact && (
                                <View style={styles.contactRow}>
                                    <AlertCircle size={20} color="#ef4444" />
                                    <View style={styles.contactInfo}>
                                        <Text style={styles.contactLabel}>Emergency Contact</Text>
                                        <Text style={styles.contactValue}>{patient.emergencyContact}</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Medical Information */}
                    {(patient.medicalConditions?.length > 0 || patient.allergies?.length > 0) && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Medical Information</Text>
                            <View style={styles.card}>
                                {patient.medicalConditions?.length > 0 && (
                                    <View style={styles.medicalRow}>
                                        <Text style={styles.medicalLabel}>Conditions</Text>
                                        <View style={styles.tagContainer}>
                                            {patient.medicalConditions.map((condition: string, index: number) => (
                                                <View key={index} style={styles.tag}>
                                                    <Text style={styles.tagText}>{condition}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                                {patient.allergies?.length > 0 && (
                                    <View style={styles.medicalRow}>
                                        <Text style={styles.medicalLabel}>Allergies</Text>
                                        <View style={styles.tagContainer}>
                                            {patient.allergies.map((allergy: string, index: number) => (
                                                <View key={index} style={[styles.tag, styles.tagDanger]}>
                                                    <Text style={[styles.tagText, styles.tagTextDanger]}>{allergy}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Summary Stats */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Summary</Text>
                        <View style={styles.statsGrid}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{summary.totalAppointments}</Text>
                                <Text style={styles.statLabel}>Appointments</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{summary.totalRecords}</Text>
                                <Text style={styles.statLabel}>Records</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{summary.totalSurgeries}</Text>
                                <Text style={styles.statLabel}>Surgeries</Text>
                            </View>
                        </View>
                    </View>

                    {/* Recent Appointments */}
                    {appointments.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Recent Appointments</Text>
                            {appointments.slice(0, 5).map((appointment: any) => (
                                <View key={appointment._id} style={styles.listItem}>
                                    <View style={styles.listItemIcon}>
                                        <Calendar size={16} color="#06b6d4" />
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <Text style={styles.listItemTitle}>{appointment.doctorName}</Text>
                                        <Text style={styles.listItemSubtitle}>
                                            {formatDate(appointment.date)} • {appointment.status}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Recent Records */}
                    {medicalRecords.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Recent Medical Records</Text>
                            {medicalRecords.slice(0, 5).map((record: any) => (
                                <View key={record._id} style={styles.listItem}>
                                    <View style={styles.listItemIcon}>
                                        <FileText size={16} color="#8b5cf6" />
                                    </View>
                                    <View style={styles.listItemContent}>
                                        <Text style={styles.listItemTitle}>{record.title}</Text>
                                        <Text style={styles.listItemSubtitle}>
                                            {record.type} • {formatDate(record.date)}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
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
    title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },

    scrollContent: { padding: 20 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: 16,
    },

    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    patientName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 4,
    },
    patientUsername: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 20,
    },

    infoGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    infoItem: {
        flex: 1,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginTop: 2,
    },

    section: { marginBottom: 24 },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 12,
    },

    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    contactInfo: {
        marginLeft: 12,
        flex: 1,
    },
    contactLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 2,
    },
    contactValue: {
        fontSize: 16,
        color: '#0f172a',
        fontWeight: '500',
    },

    medicalRow: {
        marginBottom: 16,
    },
    medicalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 8,
    },
    tagContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: '#ecfeff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    tagDanger: {
        backgroundColor: '#fee2e2',
    },
    tagText: {
        fontSize: 13,
        color: '#06b6d4',
        fontWeight: '500',
    },
    tagTextDanger: {
        color: '#ef4444',
    },

    statsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#06b6d4',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
    },

    listItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    listItemIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    listItemContent: {
        flex: 1,
    },
    listItemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 2,
    },
    listItemSubtitle: {
        fontSize: 12,
        color: '#64748b',
    },

    errorText: {
        fontSize: 16,
        color: '#64748b',
    },
});
