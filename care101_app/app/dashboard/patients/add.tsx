import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, UserPlus, ArrowLeft, CheckCircle } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

export default function AddPatientScreen() {
    const router = useRouter();
    const [step, setStep] = useState<'search' | 'form'>('search');
    const [loading, setLoading] = useState(false);

    // Search state
    const [nicSearch, setNicSearch] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);

    // Form state
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        fullName: '',
        nic: '',
        mobileNumber: '',
        dateOfBirth: '',
        gender: '',
        emergencyContact: '',
        medicalConditions: '',
        allergies: '',
    });

    const searchByNIC = async () => {
        if (!nicSearch.trim()) {
            Alert.alert('Required', 'Please enter NIC number');
            return;
        }

        try {
            setLoading(true);
            const token = await SecureStore.getItemAsync('token');

            const response = await fetch(`${API_URL}/patients/search-by-nic/${nicSearch.trim()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                }
            });

            const data = await response.json();

            if (data.found) {
                setSearchResult(data.patient);
                Alert.alert(
                    'Patient Found',
                    `${data.patient.fullName} is already registered.`,
                    [
                        { text: 'View Details', onPress: () => router.push(`/dashboard/patients/${data.patient._id}`) },
                        { text: 'OK' }
                    ]
                );
            } else {
                Alert.alert(
                    'Not Found',
                    'Patient not found in database. Would you like to add them manually?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Add Manually',
                            onPress: () => {
                                setFormData({ ...formData, nic: nicSearch.trim() });
                                setStep('form');
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Search Error:', error);
            Alert.alert('Error', 'Failed to search patient');
        } finally {
            setLoading(false);
        }
    };

    const addPatientManually = async () => {
        // Validation
        if (!formData.username || !formData.email || !formData.password || !formData.fullName || !formData.nic) {
            Alert.alert('Required', 'Please fill in all required fields (marked with *)');
            return;
        }

        try {
            setLoading(true);
            const token = await SecureStore.getItemAsync('token');

            const response = await fetch(`${API_URL}/patients/add-patient`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify({
                    ...formData,
                    medicalConditions: formData.medicalConditions ? formData.medicalConditions.split(',').map(s => s.trim()) : [],
                    allergies: formData.allergies ? formData.allergies.split(',').map(s => s.trim()) : [],
                })
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert(
                    'Success',
                    'Patient added successfully!',
                    [
                        { text: 'OK', onPress: () => router.back() }
                    ]
                );
            } else {
                Alert.alert('Error', data.msg || 'Failed to add patient');
            }
        } catch (error) {
            console.error('Add Patient Error:', error);
            Alert.alert('Error', 'Failed to add patient');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="#0f172a" />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.title}>Add Patient</Text>
                        <Text style={styles.subtitle}>
                            {step === 'search' ? 'Search by NIC or add manually' : 'Enter patient details'}
                        </Text>
                    </View>
                </View>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {step === 'search' ? (
                            // STEP 1: NIC Search
                            <View style={styles.section}>
                                <View style={styles.searchCard}>
                                    <Search size={32} color="#06b6d4" style={{ marginBottom: 16 }} />
                                    <Text style={styles.cardTitle}>Search by NIC Number</Text>
                                    <Text style={styles.cardDescription}>
                                        Enter the patient's NIC number to check if they're already registered
                                    </Text>

                                    <TextInput
                                        style={styles.nicInput}
                                        placeholder="Enter NIC Number"
                                        value={nicSearch}
                                        onChangeText={setNicSearch}
                                        autoCapitalize="characters"
                                        placeholderTextColor="#94a3b8"
                                    />

                                    <TouchableOpacity
                                        style={styles.searchButton}
                                        onPress={searchByNIC}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <>
                                                <Search size={20} color="#fff" />
                                                <Text style={styles.searchButtonText}>Search Patient</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.divider}>
                                    <View style={styles.dividerLine} />
                                    <Text style={styles.dividerText}>OR</Text>
                                    <View style={styles.dividerLine} />
                                </View>

                                <TouchableOpacity
                                    style={styles.manualButton}
                                    onPress={() => setStep('form')}
                                >
                                    <UserPlus size={20} color="#06b6d4" />
                                    <Text style={styles.manualButtonText}>Add Patient Manually</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // STEP 2: Manual Entry Form
                            <View style={styles.section}>
                                <View style={styles.formCard}>
                                    <Text style={styles.formTitle}>Patient Information</Text>
                                    <Text style={styles.formSubtitle}>* Required fields</Text>

                                    {/* Username */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Username *</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., john_doe"
                                            value={formData.username}
                                            onChangeText={(text) => setFormData({ ...formData, username: text })}
                                            autoCapitalize="none"
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Email */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Email *</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., john@example.com"
                                            value={formData.email}
                                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Password */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Password *</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Minimum 6 characters"
                                            value={formData.password}
                                            onChangeText={(text) => setFormData({ ...formData, password: text })}
                                            secureTextEntry
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Full Name */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Full Name *</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., John Doe"
                                            value={formData.fullName}
                                            onChangeText={(text) => setFormData({ ...formData, fullName: text })}
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* NIC */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>NIC Number *</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., 123456789V"
                                            value={formData.nic}
                                            onChangeText={(text) => setFormData({ ...formData, nic: text })}
                                            autoCapitalize="characters"
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Mobile Number */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Mobile Number</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., +94771234567"
                                            value={formData.mobileNumber}
                                            onChangeText={(text) => setFormData({ ...formData, mobileNumber: text })}
                                            keyboardType="phone-pad"
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Date of Birth */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Date of Birth</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="YYYY-MM-DD"
                                            value={formData.dateOfBirth}
                                            onChangeText={(text) => setFormData({ ...formData, dateOfBirth: text })}
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Gender */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Gender</Text>
                                        <View style={styles.genderContainer}>
                                            {['Male', 'Female', 'Other'].map((gender) => (
                                                <TouchableOpacity
                                                    key={gender}
                                                    style={[
                                                        styles.genderButton,
                                                        formData.gender === gender && styles.genderButtonActive
                                                    ]}
                                                    onPress={() => setFormData({ ...formData, gender })}
                                                >
                                                    <Text style={[
                                                        styles.genderButtonText,
                                                        formData.gender === gender && styles.genderButtonTextActive
                                                    ]}>
                                                        {gender}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    {/* Emergency Contact */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Emergency Contact</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g., +94771234567"
                                            value={formData.emergencyContact}
                                            onChangeText={(text) => setFormData({ ...formData, emergencyContact: text })}
                                            keyboardType="phone-pad"
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Medical Conditions */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Medical Conditions</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Comma separated (e.g., Diabetes, Hypertension)"
                                            value={formData.medicalConditions}
                                            onChangeText={(text) => setFormData({ ...formData, medicalConditions: text })}
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    {/* Allergies */}
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Allergies</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Comma separated (e.g., Penicillin, Peanuts)"
                                            value={formData.allergies}
                                            onChangeText={(text) => setFormData({ ...formData, allergies: text })}
                                            placeholderTextColor="#94a3b8"
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={styles.submitButton}
                                        onPress={addPatientManually}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <>
                                                <CheckCircle size={20} color="#fff" />
                                                <Text style={styles.submitButtonText}>Add Patient</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.backToSearchButton}
                                        onPress={() => setStep('search')}
                                    >
                                        <Text style={styles.backToSearchText}>Back to Search</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
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
    backButton: {
        marginRight: 12,
    },
    headerTextContainer: {
        flex: 1,
    },
    title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
    subtitle: { fontSize: 14, color: '#64748b', marginTop: 2 },

    scrollContent: { padding: 20 },
    section: { flex: 1 },

    // Search Card
    searchCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
    },
    nicInput: {
        width: '100%',
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 16,
    },
    searchButton: {
        width: '100%',
        backgroundColor: '#06b6d4',
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // Divider
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
    },

    // Manual Button
    manualButton: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 2,
        borderColor: '#06b6d4',
        borderStyle: 'dashed',
    },
    manualButtonText: {
        color: '#06b6d4',
        fontSize: 16,
        fontWeight: '600',
    },

    // Form
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    formTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 4,
    },
    formSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#0f172a',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    genderContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    genderButtonActive: {
        backgroundColor: '#ecfeff',
        borderColor: '#06b6d4',
    },
    genderButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
    genderButtonTextActive: {
        color: '#06b6d4',
    },
    submitButton: {
        backgroundColor: '#06b6d4',
        borderRadius: 12,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    backToSearchButton: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    backToSearchText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
});
