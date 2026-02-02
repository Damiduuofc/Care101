import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PatientBottomNavBar from '../../components/PatientBottomNavBar';
import { FileText, Download } from 'lucide-react-native';

const DUMMY_RECORDS = [
    { id: '1', title: 'Blood Test Results', date: 'Oct 15, 2023', type: 'Lab Report', doctor: 'Dr. Sarah Smith' },
    { id: '2', title: 'Cardiology Consultation', date: 'Sep 22, 2023', type: 'Prescription', doctor: 'Dr. Sarah Smith' },
    { id: '3', title: 'X-Ray Report', date: 'Aug 10, 2023', type: 'Radiology', doctor: 'Dr. James Doe' },
    { id: '4', title: 'Annual Checkup', date: 'Jan 12, 2023', type: 'General', doctor: 'Dr. Emily White' },
];

export default function MedicalRecordsScreen() {
    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.title}>Medical Records</Text>
                    <Text style={styles.subtitle}>Access your medical history</Text>
                </View>

                <FlatList
                    data={DUMMY_RECORDS}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <View style={styles.recordCard}>
                            <View style={styles.iconBox}>
                                <FileText size={24} color="#06b6d4" />
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.recordTitle}>{item.title}</Text>
                                <Text style={styles.recordDetail}>{item.type} • {item.doctor}</Text>
                                <Text style={styles.recordDate}>{item.date}</Text>
                            </View>
                            <TouchableOpacity style={styles.downloadButton}>
                                <Download size={20} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No records found</Text>
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
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },

    listContainer: { paddingHorizontal: 20 },
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
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    info: { flex: 1 },
    recordTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
    recordDetail: { fontSize: 13, color: '#64748b', marginBottom: 2 },
    recordDate: { fontSize: 12, color: '#94a3b8' },

    downloadButton: {
        padding: 8,
    },

    emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
    emptyText: { color: '#94a3b8', marginTop: 10 },
});
