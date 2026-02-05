import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
    ChevronLeft, 
    ChevronRight, 
    Search, 
    CheckCircle,
    CreditCard,
    Clock as ClockIcon,
    Stethoscope,
    Activity,
    User // Fallback icon for missing images
} from 'lucide-react-native';
import { useAuth } from '@/context/auth';
import { useStripe } from '@stripe/stripe-react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

// --- FEES CONFIGURATION ---
const HOSPITAL_FEE = 1500;
const DOCTOR_FEE = 2000;

export default function BookAppointmentScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    // Data State
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [visitType, setVisitType] = useState('Consultation');
    const [reason, setReason] = useState('');
    
    // Search States
    const [searchQuery, setSearchQuery] = useState('');     
    const [deptSearchQuery, setDeptSearchQuery] = useState(''); 

    // Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // --- COMPUTED TOTAL FEE ---
    const totalFee = selectedDoctor ? (HOSPITAL_FEE + DOCTOR_FEE) : HOSPITAL_FEE;

    // --- 1. FETCH DOCTORS ---
    useEffect(() => {
        const fetchDoctors = async () => {
            try {
                const response = await fetch(`${API_URL}/doctors/list`, {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json' 
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Loaded ${data.length} doctors`); // Debug log
                    setDoctors(data);
                }
            } catch (error) {
                console.error("Error fetching doctors", error);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchDoctors();
    }, [token]);

    // --- 2. EXTRACT & FILTER DEPARTMENTS (Robust) ---
    const departments = useMemo(() => {
        // Extract unique specializations, remove null/undefined, and trim spaces
        const uniqueDepts = new Set(
            doctors
                .map(d => d.specialization ? d.specialization.trim() : "General") // Handle missing specs
                .filter(Boolean)
        );
        
        const deptsArray = Array.from(uniqueDepts);

        // Filter based on search
        return deptsArray.filter(dept => 
            (dept as string).toLowerCase().includes(deptSearchQuery.toLowerCase())
        );
    }, [doctors, deptSearchQuery]);

    // --- 3. FILTER DOCTORS (Robust Match) ---
    const filteredDoctors = doctors.filter(doc => {
        // Safe check for department
        const docSpec = doc.specialization ? doc.specialization.trim().toLowerCase() : "general";
        const selectedSpec = selectedDepartment ? selectedDepartment.trim().toLowerCase() : "";

        const matchesDept = selectedDepartment ? docSpec === selectedSpec : false;
        
        // Safe check for name search
        const docName = doc.name ? doc.name.toLowerCase() : "";
        const matchesSearch = docName.includes(searchQuery.toLowerCase());

        return matchesDept && matchesSearch;
    });

    // --- 4. GENERATE NEXT 7 DAYS ---
    const getNext7Days = () => {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            dates.push(d);
        }
        return dates;
    };
    const availableDates = getNext7Days();

    // --- VALIDATION & BOOKING ---
    const handleConfirmPress = () => {
        if (!selectedDoctor || !selectedDate || !reason.trim()) {
            Alert.alert("Missing Details", "Please select a doctor, date, and enter a reason.");
            return;
        }
        setShowPaymentModal(true);
    };

    const processBooking = async (paymentStatus: 'paid' | 'pending') => {
        setShowPaymentModal(false);
        setSubmitting(true);

        try {
            const response = await fetch(`${API_URL}/appointments/book`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    doctorId: selectedDoctor._id,
                    doctorName: selectedDoctor.name, 
                    department: selectedDoctor.specialization,
                    date: selectedDate?.toISOString(),
                    visitType,
                    reason,
                    amount: totalFee,
                    paymentStatus
                })
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert(
                    paymentStatus === 'paid' ? "Payment Successful!" : "Booking Confirmed",
                    `Your Token: #${data.tokenNumber || 'Pending'}. \nWait time approx 20 mins.`,
                    [{ text: "OK", onPress: () => router.replace('/patient-dashboard') }]
                );
            } else {
                throw new Error(data.msg || "Booking failed");
            }

        } catch (error: any) {
            Alert.alert("Booking Error", error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayNow = async () => {
        try {
            setSubmitting(true);
            const response = await fetch(`${API_URL}/payments/create-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ amount: totalFee * 100 }) 
            });

            if (!response.ok) {
                Alert.alert("Error", "Could not initiate payment. Please try 'Pay Later'.");
                setSubmitting(false);
                return;
            }

            const { clientSecret } = await response.json();
            const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: clientSecret,
                merchantDisplayName: 'Care101 Hospital',
                defaultBillingDetails: { address: { country: 'LK' } }
            });

            if (initError) {
                Alert.alert("Stripe Error", initError.message);
                setSubmitting(false);
                return;
            }

            const { error: paymentError } = await presentPaymentSheet();

            if (paymentError) {
                Alert.alert("Payment Failed", paymentError.message);
                setSubmitting(false);
            } else {
                await processBooking('paid');
            }

        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Payment system offline. Try Pay Later.");
            setSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>New Appointment</Text>
                    <View style={{ width: 24 }} />
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* --- STEP 1: SELECT DEPARTMENT --- */}
                <Text style={styles.sectionTitle}>1. Select Department</Text>
                
                <View style={styles.searchContainer}>
                    <Search size={20} color="#94a3b8" />
                    <TextInput 
                        placeholder="Find a department (e.g. Cardiology)..."
                        style={styles.searchInput}
                        placeholderTextColor="#94a3b8"
                        value={deptSearchQuery}
                        onChangeText={setDeptSearchQuery}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator color="#06b6d4" style={{ marginBottom: 20 }} />
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptList}>
                        {departments.length > 0 ? (
                            departments.map((dept, index) => {
                                const isSelected = selectedDepartment === dept;
                                return (
                                    <TouchableOpacity 
                                        key={index} 
                                        style={[styles.deptCard, isSelected && styles.selectedDeptCard]}
                                        onPress={() => {
                                            setSelectedDepartment(dept as string);
                                            setSelectedDoctor(null); 
                                        }}
                                    >
                                        <View style={[styles.deptIconBox, isSelected && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                            <Stethoscope size={20} color={isSelected ? "#fff" : "#06b6d4"} />
                                        </View>
                                        <Text style={[styles.deptText, isSelected && styles.selectedDeptText]}>
                                            {dept as React.ReactNode}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })
                        ) : (
                            <View style={{ paddingVertical: 10 }}>
                                <Text style={styles.emptyText}>No departments found</Text>
                            </View>
                        )}
                    </ScrollView>
                )}

                {/* --- STEP 2: SELECT DOCTOR --- */}
                <Text style={styles.sectionTitle}>2. Select Specialist</Text>
                
                {!selectedDepartment ? (
                    <View style={styles.placeholderBox}>
                        <Activity size={32} color="#cbd5e1" />
                        <Text style={styles.placeholderText}>Please select a department above to see available doctors.</Text>
                    </View>
                ) : (
                    <>
                        <View style={styles.searchContainer}>
                            <Search size={20} color="#94a3b8" />
                            <TextInput 
                                placeholder={`Search ${selectedDepartment} doctor...`}
                                style={styles.searchInput}
                                placeholderTextColor="#94a3b8"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>

                        <View style={styles.doctorListContainer}>
                            <FlatList
                                horizontal
                                data={filteredDoctors}
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(item) => item._id}
                                contentContainerStyle={{ gap: 12, paddingHorizontal: 4 }}
                                ListEmptyComponent={
                                    <View style={{ width: 300, padding: 20 }}>
                                        <Text style={{ color: '#94a3b8' }}>
                                            No doctors found in {selectedDepartment}.
                                        </Text>
                                    </View>
                                }
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={[
                                            styles.doctorCard, 
                                            selectedDoctor?._id === item._id && styles.selectedDoctorCard
                                        ]}
                                        onPress={() => setSelectedDoctor(item)}
                                    >
                                        {/* ✅ ROBUST IMAGE LOADING */}
                                        {item.profileImage && item.profileImage.length > 10 ? (
                                            <Image 
                                                source={{ uri: item.profileImage }} 
                                                style={styles.doctorImage} 
                                            />
                                        ) : (
                                            <View style={[styles.doctorImage, { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }]}>
                                                <User size={30} color="#94a3b8" />
                                            </View>
                                        )}

                                        <Text style={styles.doctorName} numberOfLines={1}>
                                            {item.name || "Unknown Doctor"}
                                        </Text>
                                        
                                        <Text style={styles.doctorSpecialty} numberOfLines={1}>
                                            {item.specialization || "General"}
                                        </Text>
                                        
                                        <View style={styles.feeBadge}>
                                            <Text style={styles.feeText}>+ LKR {DOCTOR_FEE}</Text>
                                        </View>
                                        
                                        {selectedDoctor?._id === item._id && (
                                            <View style={styles.checkBadge}>
                                                <CheckCircle size={16} color="#fff" />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </>
                )}

                {/* --- STEP 3: SELECT DATE --- */}
                <Text style={styles.sectionTitle}>3. Select Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateList}>
                    {availableDates.map((date, index) => {
                        const isSelected = selectedDate?.toDateString() === date.toDateString();
                        return (
                            <TouchableOpacity 
                                key={index} 
                                style={[styles.dateCard, isSelected && styles.selectedDateCard]}
                                onPress={() => setSelectedDate(date)}
                            >
                                <Text style={[styles.dateDay, isSelected && styles.selectedDateText]}>
                                    {date.toLocaleString('default', { weekday: 'short' })}
                                </Text>
                                <Text style={[styles.dateNum, isSelected && styles.selectedDateText]}>
                                    {date.getDate()}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* --- STEP 4: DETAILS --- */}
                <Text style={styles.sectionTitle}>4. Appointment Details</Text>
                <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>Reason for visit</Text>
                    <TextInput 
                        style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
                        placeholder="e.g., High fever, chest pain..."
                        placeholderTextColor="#cbd5e1"
                        multiline
                        value={reason}
                        onChangeText={setReason}
                    />

                    <Text style={styles.inputLabel}>Visit Type</Text>
                    <View style={styles.typeRow}>
                        {['Consultation', 'Follow-up', 'Emergency'].map((type) => (
                            <TouchableOpacity 
                                key={type}
                                style={[styles.typeChip, visitType === type && styles.selectedTypeChip]}
                                onPress={() => setVisitType(type)}
                            >
                                <Text style={[styles.typeText, visitType === type && styles.selectedTypeText]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* --- BOTTOM ACTION BAR --- */}
            <View style={styles.bottomBar}>
                <View>
                    <Text style={styles.totalLabel}>
                        {selectedDoctor ? "Total Fee" : "Hospital Admission"}
                    </Text>
                    <Text style={styles.totalAmount}>LKR {totalFee}</Text>
                </View>
                <TouchableOpacity 
                    style={[
                        styles.bookButton, 
                        (submitting || !selectedDoctor) && { opacity: 0.7, backgroundColor: '#94a3b8' }
                    ]}
                    onPress={handleConfirmPress}
                    disabled={submitting || !selectedDoctor}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.bookButtonText}>Confirm Booking</Text>
                            <ChevronRight size={18} color="#fff" />
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* --- PAYMENT METHOD MODAL --- */}
            <Modal
                transparent={true}
                visible={showPaymentModal}
                animationType="slide"
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Choose Payment Method</Text>
                        <Text style={styles.modalSubtitle}>Total to pay: LKR {totalFee}</Text>

                        <TouchableOpacity 
                            style={[styles.paymentOption, { backgroundColor: '#06b6d4' }]}
                            onPress={handlePayNow}
                        >
                            <CreditCard color="#fff" size={24} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.paymentOptionTitle}>Pay Now</Text>
                                <Text style={styles.paymentOptionDesc}>Secure payment via Stripe</Text>
                            </View>
                            <ChevronRight color="#fff" size={20} style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.paymentOption, { backgroundColor: '#f1f5f9' }]}
                            onPress={() => processBooking('pending')}
                        >
                            <ClockIcon color="#475569" size={24} />
                            <View style={{ marginLeft: 12 }}>
                                <Text style={[styles.paymentOptionTitle, { color: '#0f172a' }]}>Pay Later</Text>
                                <Text style={[styles.paymentOptionDesc, { color: '#64748b' }]}>Pay cash at the hospital counter</Text>
                            </View>
                            <ChevronRight color="#475569" size={20} style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.cancelButton} 
                            onPress={() => setShowPaymentModal(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9'
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    scrollContent: { padding: 20 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 12, marginTop: 8 },
    
    // Departments
    deptList: { flexDirection: 'row', gap: 10, marginBottom: 24, paddingRight: 20 },
    deptCard: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        marginRight: 10
    },
    selectedDeptCard: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    deptIconBox: { 
        padding: 6, 
        backgroundColor: '#ecfeff', 
        borderRadius: 8 
    },
    deptText: { fontSize: 14, fontWeight: '600', color: '#475569' },
    selectedDeptText: { color: '#fff' },
    emptyText: { color: '#94a3b8', fontSize: 14, fontStyle: 'italic' },

    // Placeholder
    placeholderBox: {
        height: 120,
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: '#cbd5e1',
        padding: 20
    },
    placeholderText: {
        textAlign: 'center',
        color: '#64748b',
        marginTop: 8,
        fontSize: 14
    },

    // Search & List
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        height: 50,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#0f172a' },
    doctorListContainer: { marginBottom: 24, height: 180 },
    doctorCard: {
        width: 140,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginRight: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    selectedDoctorCard: { borderColor: '#06b6d4', backgroundColor: '#ecfeff', borderWidth: 2 },
    doctorImage: { width: 60, height: 60, borderRadius: 30, marginBottom: 8, overflow: 'hidden' }, // Ensure overflow hidden
    doctorName: { fontSize: 14, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 4 },
    doctorSpecialty: { fontSize: 12, color: '#64748b', textAlign: 'center', marginBottom: 8 },
    feeBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    feeText: { fontSize: 10, fontWeight: '600', color: '#475569' },
    checkBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#06b6d4', borderRadius: 10 },

    // Date
    dateList: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    dateCard: { width: 60, height: 70, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
    selectedDateCard: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    dateDay: { fontSize: 12, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' },
    dateNum: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    selectedDateText: { color: '#fff' },

    // Form
    formCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f1f5f9' },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
    textInput: { 
        backgroundColor: '#f8fafc', 
        borderWidth: 1, 
        borderColor: '#e2e8f0', 
        borderRadius: 12, 
        padding: 12, 
        fontSize: 14, 
        color: '#0f172a',
        marginBottom: 20 
    },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: { 
        paddingHorizontal: 16, 
        paddingVertical: 8, 
        borderRadius: 20, 
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    selectedTypeChip: { backgroundColor: '#cffafe', borderColor: '#06b6d4' },
    typeText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    selectedTypeText: { color: '#0e7490' },

    // Bottom Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 10,
    },
    totalLabel: { fontSize: 12, color: '#64748b' },
    totalAmount: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    bookButton: {
        backgroundColor: '#06b6d4',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 14,
        gap: 8,
        shadowColor: "#06b6d4",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    bookButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end', // Slide up from bottom
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
    modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    paymentOptionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
    paymentOptionDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    cancelButton: { marginTop: 12, padding: 12, alignItems: 'center' },
    cancelButtonText: { color: '#64748b', fontSize: 14, fontWeight: '600' }
});