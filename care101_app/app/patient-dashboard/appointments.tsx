import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    User
} from 'lucide-react-native';
import { useAuth } from '@/context/auth';
import { useStripe } from '@stripe/stripe-react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api';

const HOSPITAL_FEE = 1500;
const DOCTOR_FEE = 2000;

export default function BookAppointmentScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [visitType, setVisitType] = useState('Consultation');
    const [reason, setReason] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [deptSearchQuery, setDeptSearchQuery] = useState('');

    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [doctorSchedules, setDoctorSchedules] = useState<any[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);

    // FIX 1: totalFee is HOSPITAL_FEE only until a doctor is selected, then adds DOCTOR_FEE
    const totalFee = selectedDoctor ? HOSPITAL_FEE + DOCTOR_FEE : HOSPITAL_FEE;

    // Fetch approved schedules for the selected doctor
    useEffect(() => {
        if (!selectedDoctor || !token) {
            setDoctorSchedules([]);
            return;
        }

        const fetchSchedules = async () => {
            setLoadingSchedules(true);
            try {
                const response = await fetch(`${API_URL}/schedule-requests/doctor/${selectedDoctor._id}/approved`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setDoctorSchedules(data || []);
                }
            } catch (error) {
                console.error('Error fetching schedules', error);
                setDoctorSchedules([]);
            } finally {
                setLoadingSchedules(false);
            }
        };

        fetchSchedules();
        setSelectedDate(null); // Reset date selection when doctor changes
    }, [selectedDoctor, token]);

    // DERIVED: Available dates from approved schedules
    const availableDates = useMemo(() => {
        if (!selectedDoctor) return [];
        // Map schedule dates to Date objects
        return doctorSchedules.map(sch => new Date(sch.date));
    }, [doctorSchedules, selectedDoctor]);

    // NEW: Get the schedule object for the selected date
    const selectedSchedule = useMemo(() => {
        if (!selectedDate || !doctorSchedules.length) return null;
        return doctorSchedules.find(sch => 
            new Date(sch.date).toDateString() === selectedDate.toDateString()
        );
    }, [selectedDate, doctorSchedules]);

    useEffect(() => {
        if (!token) return;
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
                    setDoctors(data);
                }
            } catch (error) {
                console.error('Error fetching doctors', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDoctors();
    }, [token]);

    const departments = useMemo(() => {
        const uniqueDepts = new Set(
            doctors
                .map(d => (d.specialization ? d.specialization.trim() : 'General'))
                .filter(Boolean)
        );
        return Array.from(uniqueDepts).filter(dept =>
            dept.toLowerCase().includes(deptSearchQuery.toLowerCase())
        );
    }, [doctors, deptSearchQuery]);

    const filteredDoctors = useMemo(() => {
        return doctors.filter(doc => {
            const docSpec = (doc.specialization || 'General').trim().toLowerCase();
            const selectedSpec = (selectedDepartment || '').trim().toLowerCase();

            // If a department is selected, first filter by it.
            // If searching by name, we search across all if NO department is selected,
            // or within that department if it IS selected.
            
            const matchesDept = selectedDepartment ? (docSpec === selectedSpec) : true;
            
            const docName = (doc.name || '').toLowerCase();
            const matchesSearch = docName.includes(searchQuery.toLowerCase().trim());
            
            return matchesDept && matchesSearch;
        });
    }, [doctors, selectedDepartment, searchQuery]);

    const handleConfirmPress = () => {
        if (!selectedDoctor || !selectedDate || !reason.trim()) {
            Alert.alert(
                'Missing Details',
                'Please select a doctor, a date, and enter a reason for your visit.'
            );
            return;
        }
        setSubmitting(false);
        setShowPaymentModal(true);
    };

    const processBooking = useCallback(
        async (paymentStatus: 'paid' | 'pending') => {
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
                        paymentStatus === 'paid' ? 'Payment Successful!' : 'Booking Confirmed',
                        `Your Token: #${data.tokenNumber || 'Pending'}.\nWait time approx 20 mins.`,
                        [{ text: 'OK', onPress: () => router.replace('/patient-dashboard') }]
                    );
                } else {
                    throw new Error(data.msg || 'Booking failed');
                }
            } catch (error: any) {
                Alert.alert('Booking Error', error.message);
            } finally {
                setSubmitting(false);
            }
        },
        [token, selectedDoctor, selectedDate, visitType, reason, totalFee, router]
    );

    const handlePayNow = async () => {
        try {
            setSubmitting(true);
            setShowPaymentModal(false);

            const response = await fetch(`${API_URL}/payments/create-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount: totalFee * 100 })
            });

            if (!response.ok) {
                Alert.alert('Error', "Could not initiate payment. Please try 'Pay Later'.");
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
                Alert.alert('Stripe Error', initError.message);
                setSubmitting(false);
                return;
            }

            const { error: paymentError } = await presentPaymentSheet();

            if (paymentError) {
                Alert.alert('Payment Failed', paymentError.message);
                setSubmitting(false);
            } else {
                await processBooking('paid');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Payment system offline. Try Pay Later.');
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

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                nestedScrollEnabled
            >
                {/* STEP 1: SELECT DEPARTMENT */}
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
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.deptList}
                        nestedScrollEnabled
                    >
                        {departments.length > 0 ? (
                            departments.map((dept, index) => {
                                const isSelected = selectedDepartment === dept;
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.deptCard,
                                            isSelected && styles.selectedDeptCard
                                        ]}
                                        onPress={() => {
                                            setSelectedDepartment(dept);
                                            setSelectedDoctor(null);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <View
                                            style={[
                                                styles.deptIconBox,
                                                isSelected && {
                                                    backgroundColor: 'rgba(255,255,255,0.2)'
                                                }
                                            ]}
                                        >
                                            <Stethoscope
                                                size={20}
                                                color={isSelected ? '#fff' : '#06b6d4'}
                                            />
                                        </View>
                                        <Text
                                            style={[
                                                styles.deptText,
                                                isSelected && styles.selectedDeptText
                                            ]}
                                        >
                                            {dept}
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

                {/* STEP 2: SELECT DOCTOR */}
                <Text style={styles.sectionTitle}>2. Select Specialist</Text>

                <View style={styles.searchContainer}>
                    <Search size={20} color="#94a3b8" />
                    <TextInput
                        placeholder={selectedDepartment ? `Search ${selectedDepartment} doctor...` : "Search doctor by name..."}
                        style={styles.searchInput}
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>

                {filteredDoctors.length === 0 && !selectedDepartment ? (
                    <View style={styles.placeholderBox}>
                        <Activity size={32} color="#cbd5e1" />
                        <Text style={styles.placeholderText}>
                            Please select a department above or search by name to see available doctors.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.doctorListContainer}>
                        <FlatList
                            horizontal
                            data={filteredDoctors}
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={item => item._id}
                            ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                            contentContainerStyle={{ paddingHorizontal: 4 }}
                            nestedScrollEnabled
                            scrollEventThrottle={16}
                            ListEmptyComponent={
                                <View style={{ width: 300, padding: 20 }}>
                                    <Text style={{ color: '#94a3b8' }}>
                                        {selectedDepartment ? `No doctors found in ${selectedDepartment}.` : "No doctors found matching that name."}
                                    </Text>
                                </View>
                            }
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.doctorCard,
                                        selectedDoctor?._id === item._id &&
                                            styles.selectedDoctorCard
                                    ]}
                                    onPress={() => {
                                        setSelectedDoctor(item);
                                        // If department isn't selected, automatically select it from doctor
                                        if (!selectedDepartment || selectedDepartment !== item.specialization) {
                                            setSelectedDepartment(item.specialization || 'General');
                                        }
                                    }}
                                >
                                    {item.profileImage && item.profileImage.length > 10 ? (
                                        <Image
                                            source={{ uri: item.profileImage }}
                                            style={styles.doctorImage}
                                        />
                                    ) : (
                                        <View style={styles.doctorImageFallback}>
                                            <User size={30} color="#94a3b8" />
                                        </View>
                                    )}

                                    <Text
                                        style={styles.doctorName}
                                        numberOfLines={1}
                                    >
                                        {item.name || 'Unknown Doctor'}
                                    </Text>

                                    <Text
                                        style={styles.doctorSpecialty}
                                        numberOfLines={1}
                                    >
                                        {item.specialization || 'General'}
                                    </Text>

                                    <View style={styles.feeBadge}>
                                        <Text style={styles.feeText}>
                                            + LKR {DOCTOR_FEE}
                                        </Text>
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
                )}

                {/* STEP 3: SELECT DATE */}
                <Text style={styles.sectionTitle}>3. Select Date</Text>
                
                {loadingSchedules ? (
                    <ActivityIndicator color="#06b6d4" style={{ marginVertical: 20 }} />
                ) : !selectedDoctor ? (
                    <View style={styles.placeholderBoxSmall}>
                         <Text style={styles.placeholderTextSmall}>Please select a doctor to see their availability.</Text>
                    </View>
                ) : availableDates.length === 0 ? (
                    <View style={styles.placeholderBoxSmall}>
                         <Text style={styles.placeholderTextSmall}>No approved schedules found for this doctor.</Text>
                    </View>
                ) : (
                    <>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.dateList}
                            nestedScrollEnabled
                        >
                            {availableDates.map((date, index) => {
                                const isSelected =
                                    selectedDate?.toDateString() === date.toDateString();
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.dateCard,
                                            isSelected && styles.selectedDateCard
                                        ]}
                                        onPress={() => setSelectedDate(date)}
                                    >
                                        <Text
                                            style={[
                                                styles.dateDay,
                                                isSelected && styles.selectedDateText
                                            ]}
                                        >
                                            {date.toLocaleString('default', { weekday: 'short' })}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.dateNum,
                                                isSelected && styles.selectedDateText
                                            ]}
                                        >
                                            {date.getDate()}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* NEW: SHOW SESSION START TO END TIME */}
                        {selectedDate && selectedSchedule && (
                            <View style={styles.timeInfoBox}>
                                <ClockIcon size={18} color="#06b6d4" />
                                <Text style={styles.timeInfoText}>
                                    Session Time: {new Date(selectedSchedule.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedSchedule.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        )}
                    </>
                )}

                {/* STEP 4: DETAILS */}
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
                        {['Consultation', 'Follow-up', 'Emergency'].map(type => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.typeChip,
                                    visitType === type && styles.selectedTypeChip
                                ]}
                                onPress={() => setVisitType(type)}
                            >
                                <Text
                                    style={[
                                        styles.typeText,
                                        visitType === type && styles.selectedTypeText
                                    ]}
                                >
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* BOTTOM ACTION BAR */}
            <View style={styles.bottomBar}>
                <View>
                    <Text style={styles.totalLabel}>
                        {selectedDoctor ? 'Total Fee' : 'Hospital Admission'}
                    </Text>
                    <Text style={styles.totalAmount}>LKR {totalFee}</Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.bookButton,
                        (submitting || !selectedDoctor || !selectedDate) && {
                            opacity: 0.7,
                            backgroundColor: '#94a3b8'
                        }
                    ]}
                    onPress={handleConfirmPress}
                    disabled={submitting || !selectedDoctor || !selectedDate}
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

            {/* PAYMENT METHOD MODAL */}
            <Modal
                transparent
                visible={showPaymentModal}
                animationType="slide"
                onRequestClose={() => setShowPaymentModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Choose Payment Method</Text>
                        <Text style={styles.modalSubtitle}>
                            Total to pay: LKR {totalFee}
                        </Text>

                        <TouchableOpacity
                            style={[styles.paymentOption, { backgroundColor: '#06b6d4' }]}
                            onPress={handlePayNow}
                        >
                            <CreditCard color="#fff" size={24} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={styles.paymentOptionTitle}>Pay Now</Text>
                                <Text style={styles.paymentOptionDesc}>
                                    Secure payment via Stripe
                                </Text>
                            </View>
                            <ChevronRight color="#fff" size={20} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.paymentOption, { backgroundColor: '#f1f5f9' }]}
                            onPress={() => processBooking('pending')}
                        >
                            <ClockIcon color="#475569" size={24} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={[styles.paymentOptionTitle, { color: '#0f172a' }]}>
                                    Pay Later
                                </Text>
                                <Text
                                    style={[styles.paymentOptionDesc, { color: '#64748b' }]}
                                >
                                    Pay cash at the hospital counter
                                </Text>
                            </View>
                            <ChevronRight color="#475569" size={20} />
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
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 12,
        marginTop: 8
    },

    // Departments
    deptList: { flexDirection: 'row', marginBottom: 24, paddingRight: 20 },
    deptCard: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
        flexDirection: 'row',
        marginRight: 10
    },
    selectedDeptCard: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    deptIconBox: { padding: 6, backgroundColor: '#ecfeff', borderRadius: 8, marginRight: 8 },
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

    // Search
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

    // Doctor List
    doctorListContainer: { marginBottom: 24, height: 180 },
    doctorCard: {
        width: 140,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    selectedDoctorCard: {
        borderColor: '#06b6d4',
        backgroundColor: '#ecfeff',
        borderWidth: 2
    },
    doctorImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 8
    },
    doctorImageFallback: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 8,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
    },
    doctorName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 4
    },
    doctorSpecialty: {
        fontSize: 12,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 8
    },
    feeBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    feeText: { fontSize: 10, fontWeight: '600', color: '#475569' },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#06b6d4',
        borderRadius: 10
    },

    // Date
    dateList: { flexDirection: 'row', marginBottom: 24 },
    dateCard: {
        width: 60,
        height: 70,
        backgroundColor: '#fff',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 10
    },
    selectedDateCard: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    dateDay: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    dateNum: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    selectedDateText: { color: '#fff' },

    // Form
    formCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8
    },
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
    typeRow: { flexDirection: 'row', flexWrap: 'wrap' },
    typeChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8,
        marginBottom: 8
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 10
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
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    bookButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 8 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        marginBottom: 8
    },
    modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 24 },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12
    },
    paymentOptionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
    paymentOptionDesc: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
    cancelButton: { marginTop: 12, padding: 12, alignItems: 'center' },
    cancelButtonText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
    
    placeholderBoxSmall: {
        height: 80,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 15,
        borderStyle: 'dashed'
    },
    placeholderTextSmall: {
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 13,
        fontStyle: 'italic'
    },
    // Session Info
    timeInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfeff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#cffafe'
    },
    timeInfoText: {
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '600',
        color: '#0e7490'
    }
});