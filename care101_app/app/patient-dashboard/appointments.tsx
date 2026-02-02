import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import PatientBottomNavBar from '../../components/PatientBottomNavBar';

const DUMMY_DOCTORS = [
    { id: '1', name: 'Dr. Sarah Smith', specialty: 'Cardiologist', hospital: 'City Hospital', rating: 4.8 },
    { id: '2', name: 'Dr. James Doe', specialty: 'Neurologist', hospital: 'General Hospital', rating: 4.9 },
    { id: '3', name: 'Dr. Emily White', specialty: 'Pediatrician', hospital: 'Sunrise Clinic', rating: 4.7 },
    { id: '4', name: 'Dr. Michael Brown', specialty: 'Dermatologist', hospital: 'Skin Care Center', rating: 4.6 },
];

export default function AppointmentBookingScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    const categories = ['All', 'Cardiologist', 'Neurologist', 'Pediatrician', 'Dermatologist'];

    const filteredDoctors = DUMMY_DOCTORS.filter(doc =>
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialty.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Book Appointment</Text>
                    <Text style={styles.subtitle}>Find the right doctor for you</Text>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search doctor, specialty..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor="#94a3b8"
                    />
                </View>

                {/* Categories */}
                <View style={styles.categoryContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                                onPress={() => setSelectedCategory(cat)}
                            >
                                <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextActive]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Doctor List */}
                <FlatList
                    data={selectedCategory === 'All' ? filteredDoctors : filteredDoctors.filter(d => d.specialty === selectedCategory)}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.doctorList}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.doctorCard}>
                            <View style={styles.doctorImagePlaceholder}>
                                <Ionicons name="person" size={24} color="#fff" />
                            </View>
                            <View style={styles.doctorInfo}>
                                <Text style={styles.doctorName}>{item.name}</Text>
                                <Text style={styles.doctorSpecialty}>{item.specialty}</Text>
                                <Text style={styles.doctorHospital}>{item.hospital}</Text>
                                <View style={styles.ratingContainer}>
                                    <Ionicons name="star" size={14} color="#f59e0b" />
                                    <Text style={styles.ratingText}>{item.rating}</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.bookButton}>
                                <Text style={styles.bookButtonText}>Book</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    )}
                />
            </SafeAreaView>
            <PatientBottomNavBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { flex: 1, marginBottom: 80 },
    header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
    subtitle: { fontSize: 16, color: '#64748b', marginTop: 4 },

    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginTop: 10,
        paddingHorizontal: 12,
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, height: '100%', fontSize: 16, color: '#0f172a' },

    categoryContainer: { marginTop: 20 },
    categoryList: { paddingHorizontal: 20, paddingRight: 40 },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#fff',
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    categoryChipActive: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    categoryText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
    categoryTextActive: { color: '#fff', fontWeight: '600' },

    doctorList: { padding: 20 },
    doctorCard: {
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
    doctorImagePlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    doctorInfo: { flex: 1 },
    doctorName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    doctorSpecialty: { fontSize: 14, color: '#06b6d4', marginBottom: 2 },
    doctorHospital: { fontSize: 12, color: '#64748b', marginBottom: 4 },
    ratingContainer: { flexDirection: 'row', alignItems: 'center' },
    ratingText: { fontSize: 12, color: '#64748b', marginLeft: 4, fontWeight: '600' },

    bookButton: {
        backgroundColor: '#0f172a',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    bookButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
