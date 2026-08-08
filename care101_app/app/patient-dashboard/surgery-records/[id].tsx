import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
    ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/surgery-records`;

export default function PatientRecordDetailsScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams();

    const [record, setRecord] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [imageExpanded, setImageExpanded] = useState(false);

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

    if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#0d9488" />;
    if (!record) return null;

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{record.name}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Card 1: Patient Details */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Patient Details</Text>
                    <View style={styles.divider} />
                    <View style={styles.rowContainer}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Doctor</Text>
                            <Text style={styles.value}>{record.doctorName || "Unknown"}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Hospital</Text>
                            <Text style={styles.value}>{record.hospital || "N/A"}</Text>
                        </View>
                    </View>
                    <View style={[styles.rowContainer, { marginTop: 12 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Patient ID</Text>
                            <Text style={styles.value}>{record.patientId || "N/A"}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.label}>NIC</Text>
                            <Text style={styles.value}>{record.nic || "N/A"}</Text>
                        </View>
                    </View>
                </View>

                {/* Card 2: Main Surgery Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Surgery Card (Original)</Text>
                    <View style={styles.divider} />
                    {record.surgeryCardImage ? (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => setImageExpanded(!imageExpanded)}
                            style={[styles.imageContainer, imageExpanded && styles.imageContainerExpanded]}
                        >
                            <Image source={{ uri: record.surgeryCardImage }} style={styles.cardImage} resizeMode="cover" />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.noImageContainer}>
                            <Text style={styles.noImageText}>No surgery card image</Text>
                        </View>
                    )}
                </View>

                {/* SECTION: PROGRESS ENTRIES (Timeline) */}
                <View style={styles.timelineHeader}>
                    <Text style={styles.sectionHeader}>Recovery Progress</Text>
                </View>

                {record.entries && record.entries.length > 0 ? (
                    record.entries.map((entry: any, index: number) => (
                        <View key={index} style={styles.entryCard}>
                            <View style={styles.entryHeader}>
                                <Calendar size={14} color="#64748b" />
                                <Text style={styles.entryDate}>{new Date(entry.date).toLocaleString()}</Text>
                            </View>

                            {entry.images && entry.images.length > 0 && (
                                <Image source={{ uri: entry.images[0] }} style={styles.entryImage} />
                            )}

                            {entry.notes ? (
                                <Text style={styles.entryNotes}>{entry.notes}</Text>
                            ) : null}
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No progress updates yet.</Text>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 16 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    content: { padding: 20, paddingBottom: 40 },

    // Cards
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
    rowContainer: { flexDirection: 'row', gap: 16 },
    label: { fontSize: 12, color: '#64748b', marginBottom: 4 },
    value: { fontSize: 16, color: '#0f172a', fontWeight: '600' },

    imageContainer: { width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f1f5f9' },
    imageContainerExpanded: { height: 400 },
    cardImage: { width: '100%', height: '100%' },
    noImageContainer: {
        width: '100%',
        height: 220,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    noImageText: { color: '#94a3b8', fontSize: 14 },

    // Timeline
    timelineHeader: { marginBottom: 12, marginTop: 10 },
    sectionHeader: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    entryCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
    entryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    entryDate: { fontSize: 12, color: '#64748b', marginLeft: 6, fontWeight: '500' },
    entryImage: { width: '100%', height: 150, borderRadius: 8, marginBottom: 8, backgroundColor: '#f1f5f9' },
    entryNotes: { fontSize: 14, color: '#334155', lineHeight: 20 },
    emptyState: { padding: 20, alignItems: 'center' },
    emptyText: { color: '#94a3b8', fontStyle: 'italic' },
});
