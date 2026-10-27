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
    User,
    AlertTriangle,
    CalendarClock
} from 'lucide-react-native';
import { useAuth } from '@/context/auth';
import { useStripe } from '@stripe/stripe-react-native';
import { payBill, waitForModalDismiss } from '@/services/billPayment';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const formatTime = (value: string | Date) =>
    new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDay = (value: string | Date) =>
    new Date(value).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Reads { msg } from an error response, whatever the server sent
const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}));
    return data.msg || data.message || fallback;
};

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
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [checkedAvailability, setCheckedAvailability] = useState<any>(null);
    const [visitType, setVisitType] = useState('Consultation');
    const [reason, setReason] = useState('');

    const [searchQuery, setSearchQuery] = useState('');
    const [deptSearchQuery, setDeptSearchQuery] = useState('');

    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [doctorSchedules, setDoctorSchedules] = useState<any[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);

    // Fees come from the server (per doctor); the server also charges this amount itself
    const fees = selectedSession?.availability?.fees || selectedDoctor?.fees || null;
    const totalFee: number | null = fees?.total ?? null;

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
        setSelectedDate(null); // Reset date and session selection when doctor changes
        setSelectedSession(null);
    }, [selectedDoctor, token]);

    // DERIVED: Available dates from approved schedules (deduplicated by day)
    const availableDates = useMemo(() => {
        if (!selectedDoctor || !doctorSchedules.length) return [];
        
        const seen = new Set<string>();
        const uniqueDates: Date[] = [];
        
        for (const sch of doctorSchedules) {
            const dateObj = new Date(sch.date);
            const dateStr = dateObj.toDateString();
            if (!seen.has(dateStr)) {
                seen.add(dateStr);
                uniqueDates.push(dateObj);
            }
        }
        
        return uniqueDates.sort((a, b) => a.getTime() - b.getTime());
    }, [doctorSchedules, selectedDoctor]);

    // All sessions on the selected day (a doctor can have more than one)
    const sessionsForDay = useMemo(() => {
        if (!selectedDate) return [];
        return doctorSchedules
            .filter(sch => new Date(sch.date).toDateString() === selectedDate.toDateString())
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [selectedDate, doctorSchedules]);

    const isDayFull = useCallback((date: Date) => {
        const sessions = doctorSchedules.filter(sch => new Date(sch.date).toDateString() === date.toDateString());
        return sessions.length > 0 && sessions.every(sch => sch.availability?.isFull);
    }, [doctorSchedules]);

    const selectDate = (date: Date) => {
        setSelectedDate(date);
        const open = doctorSchedules
            .filter(sch => new Date(sch.date).toDateString() === date.toDateString() && !sch.availability?.isFull)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        // Pick the session automatically when there is only one open
        setSelectedSession(open.length === 1 ? open[0] : null);
    };

    const missingDetail = !selectedDoctor
        ? 'Choose a doctor'
        : !selectedSession
            ? 'Choose a date and session'
            : !reason.trim()
                ? 'Enter a reason for your visit'
                : null;

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

    const handleConfirmPress = async () => {
        if (missingDetail) return;
        setSubmitting(true);
        try {
            const response = await fetch(`${API_URL}/appointments/check-booking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    doctorId: selectedDoctor._id,
                    scheduleId: selectedSession._id
                })
            });

            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                setCheckedAvailability(data.availability || null);
                setShowPaymentModal(true);
            } else {
                Alert.alert('Cannot Book This Session', await readError(response, 'This session is not available.'));
            }
        } catch (error: any) {
            console.error('Error checking booking status:', error);
            Alert.alert('Connection Error', 'Could not verify booking status. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Creates the appointment. Always booked as unpaid: payment is attached to its bill afterwards,
    // so a failed booking can never leave the patient charged with no appointment.
    const createBooking = useCallback(async () => {
        const response = await fetch(`${API_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                doctorId: selectedDoctor._id,
                scheduleId: selectedSession._id,
                visitType,
                reason: reason.trim()
            })
        });

        if (!response.ok) {
            throw new Error(await readError(response, 'Booking failed. Please try again.'));
        }
        return response.json();
    }, [token, selectedDoctor, selectedSession, visitType, reason]);

    const goToDashboard = [{ text: 'OK', onPress: () => router.replace('/patient-dashboard') }];

    const handlePayLater = async () => {
        setShowPaymentModal(false);
        setSubmitting(true);
        try {
            const booking = await createBooking();
            const payBy = booking.holdExpiresAt ? formatTime(booking.holdExpiresAt) : null;
            Alert.alert(
                `Token #${booking.queueNumber} reserved`,
                `Your place with ${booking.doctorName} on ${formatDay(booking.date)} is held` +
                (payBy ? ` until ${payBy}` : '') +
                `. Pay LKR ${Number(booking.amount).toLocaleString()} in Billing or at the hospital counter before then to keep it.`,
                [
                    { text: 'Pay Now', onPress: () => router.replace('/patient-dashboard/billing') },
                    { text: 'OK', onPress: () => router.replace('/patient-dashboard/my-appointments' as any) }
                ]
            );
        } catch (error: any) {
            Alert.alert('Booking Error', error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayNow = async () => {
        if (!token) return;
        setShowPaymentModal(false);
        setSubmitting(true);
        try {
            const booking = await createBooking();
            if (!booking.billId) {
                Alert.alert(
                    'Booking Received',
                    'Your booking is saved. Please complete the payment from Billing to keep your place.',
                    [{ text: 'OK', onPress: () => router.replace('/patient-dashboard/billing') }]
                );
                return;
            }

            await waitForModalDismiss();
            const result = await payBill(token, booking.billId, { initPaymentSheet, presentPaymentSheet });

            if (result.status === 'paid') {
                Alert.alert(
                    'Payment Successful!',
                    result.queueNumber
                        ? `Your Queue Token: #${result.queueNumber}.`
                        : 'Your booking is confirmed. Your queue token is on the dashboard.',
                    goToDashboard
                );
            } else if (result.status === 'unconfirmed') {
                Alert.alert('Payment Received', result.message, goToDashboard);
            } else {
                Alert.alert(
                    result.status === 'canceled' ? 'Payment Not Completed' : 'Payment Failed',
                    `${result.status === 'failed' ? result.message + '\n\n' : ''}Token #${booking.queueNumber} is reserved` +
                    (booking.holdExpiresAt ? ` until ${formatTime(booking.holdExpiresAt)}` : '') +
                    '. Pay from Billing before then to keep your place.',
                    [{ text: 'OK', onPress: () => router.replace('/patient-dashboard/billing') }]
                );
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Booking Error', error.message || 'Something went wrong. Please try again.');
        } finally {
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
                    <TouchableOpacity
                        onPress={() => router.push('/patient-dashboard/my-appointments' as any)}
                        style={styles.myBookingsButton}
                    >
                        <CalendarClock size={16} color="#0891b2" />
                        <Text style={styles.myBookingsText}>My bookings</Text>
                    </TouchableOpacity>
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
                         <Text style={styles.placeholderTextSmall}>This doctor has no upcoming sessions open for booking.</Text>
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
                                const full = isDayFull(date);
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.dateCard,
                                            isSelected && styles.selectedDateCard,
                                            full && !isSelected && styles.fullDateCard
                                        ]}
                                        onPress={() => selectDate(date)}
                                    >
                                        <Text style={[styles.dateMonth, isSelected && styles.selectedDateText]}>
                                            {date.toLocaleString('default', { month: 'short' }).toUpperCase()}
                                        </Text>
                                        <Text style={[styles.dateNum, isSelected && styles.selectedDateText]}>
                                            {date.getDate()}
                                        </Text>
                                        <Text style={[styles.dateDay, isSelected && styles.selectedDateText]}>
                                            {full ? 'Full' : date.toLocaleString('default', { weekday: 'short' })}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* SESSIONS ON THE SELECTED DAY, WITH PLACES LEFT */}
                        {selectedDate && sessionsForDay.map(session => {
                            const availability = session.availability || {};
                            const isSelected = selectedSession?._id === session._id;
                            const full = Boolean(availability.isFull);
                            return (
                                <TouchableOpacity
                                    key={session._id}
                                    disabled={full}
                                    onPress={() => setSelectedSession(session)}
                                    style={[
                                        styles.sessionCard,
                                        isSelected && styles.selectedSessionCard,
                                        full && styles.fullSessionCard
                                    ]}
                                >
                                    <ClockIcon size={18} color={isSelected ? '#fff' : full ? '#94a3b8' : '#06b6d4'} />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={[styles.sessionTime, isSelected && styles.selectedDateText, full && { color: '#94a3b8' }]}>
                                            {formatTime(session.startTime)} – {formatTime(session.endTime)}
                                        </Text>
                                        <Text style={[styles.sessionMeta, isSelected && { color: '#cffafe' }]}>
                                            {full
                                                ? 'Session full'
                                                : `Your token ≈ #${availability.nextToken ?? '-'} • Est. ${availability.estimatedTime ? formatTime(availability.estimatedTime) : formatTime(session.startTime)}`}
                                        </Text>
                                    </View>
                                    <Text style={[styles.sessionPlaces, isSelected && styles.selectedDateText, full && { color: '#ef4444' }]}>
                                        {full
                                            ? 'FULL'
                                            : availability.remaining == null
                                                ? 'Open'
                                                : `${availability.remaining} left`}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
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
                        {['Consultation', 'Follow-up'].map(type => (
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

                <View style={styles.emergencyNotice}>
                    <AlertTriangle size={18} color="#b91c1c" />
                    <Text style={styles.emergencyText}>
                        For a medical emergency, do not book here. Go to the nearest Accident & Emergency unit or call 1990 for an ambulance.
                    </Text>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* BOTTOM ACTION BAR */}
            <View style={styles.bottomBar}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.totalLabel}>Total Fee</Text>
                    <Text style={styles.totalAmount}>
                        {totalFee != null ? `LKR ${totalFee.toLocaleString()}` : '—'}
                    </Text>
                    {missingDetail && <Text style={styles.missingHint}>{missingDetail}</Text>}
                </View>
                <TouchableOpacity
                    style={[
                        styles.bookButton,
                        (submitting || !!missingDetail) && {
                            opacity: 0.7,
                            backgroundColor: '#94a3b8'
                        }
                    ]}
                    onPress={handleConfirmPress}
                    disabled={submitting || !!missingDetail}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Text style={styles.bookButtonText}>Review Booking</Text>
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
                        <Text style={styles.modalTitle}>Review Your Booking</Text>

                        {selectedDoctor && selectedSession && (
                            <View style={styles.summaryBox}>
                                <SummaryRow label="Doctor" value={selectedDoctor.name} />
                                <SummaryRow label="Department" value={selectedDoctor.specialization || 'General'} />
                                <SummaryRow label="Date" value={formatDay(selectedSession.startTime)} />
                                <SummaryRow
                                    label="Session"
                                    value={`${formatTime(selectedSession.startTime)} – ${formatTime(selectedSession.endTime)}`}
                                />
                                <SummaryRow
                                    label="Expected token"
                                    value={`#${(checkedAvailability || selectedSession.availability)?.nextToken ?? '-'}`}
                                />
                                <SummaryRow label="Visit" value={visitType} />
                                <View style={styles.summaryDivider} />
                                {fees && (
                                    <>
                                        <SummaryRow label="Doctor fee" value={`LKR ${fees.doctorFee.toLocaleString()}`} />
                                        <SummaryRow label="Hospital fee" value={`LKR ${fees.hospitalFee.toLocaleString()}`} />
                                    </>
                                )}
                                <SummaryRow label="Total" value={totalFee != null ? `LKR ${totalFee.toLocaleString()}` : '—'} bold />
                            </View>
                        )}

                        <Text style={styles.modalSubtitle}>How would you like to pay?</Text>

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
                            onPress={handlePayLater}
                        >
                            <ClockIcon color="#475569" size={24} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={[styles.paymentOptionTitle, { color: '#0f172a' }]}>
                                    Pay Later
                                </Text>
                                <Text
                                    style={[styles.paymentOptionDesc, { color: '#64748b' }]}
                                >
                                    Your place is held for a limited time; pay in the app or at the counter
                                </Text>
                            </View>
                            <ChevronRight color="#475569" size={20} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => setShowPaymentModal(false)}
                        >
                            <Text style={styles.cancelButtonText}>Back</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const SummaryRow = ({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) => (
    <View style={styles.summaryRow}>
        <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
        <Text style={[styles.summaryValue, bold && styles.summaryBold]} numberOfLines={1}>{value}</Text>
    </View>
);

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
        width: 64,
        height: 82,
        backgroundColor: '#fff',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 10
    },
    selectedDateCard: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    fullDateCard: { backgroundColor: '#f8fafc', opacity: 0.6 },
    dateMonth: { fontSize: 11, fontWeight: '700', color: '#06b6d4', marginBottom: 2 },
    dateDay: {
        fontSize: 11,
        color: '#64748b',
        marginTop: 2,
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
    modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 14, fontWeight: '600' },
    summaryBox: {
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 14,
        marginVertical: 12,
        gap: 6
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    summaryLabel: { fontSize: 13, color: '#64748b' },
    summaryValue: { fontSize: 13, color: '#0f172a', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
    summaryBold: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
    summaryDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
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
    // Sessions
    sessionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    selectedSessionCard: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    fullSessionCard: { backgroundColor: '#f8fafc', opacity: 0.7 },
    sessionTime: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    sessionMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    sessionPlaces: { fontSize: 12, fontWeight: '800', color: '#0891b2' },
    emergencyNotice: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
        backgroundColor: '#fef2f2',
        borderColor: '#fecaca',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginTop: 16
    },
    emergencyText: { flex: 1, fontSize: 13, color: '#991b1b', lineHeight: 18 },
    missingHint: { fontSize: 11, color: '#f59e0b', fontWeight: '600', marginTop: 2 },
    myBookingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ecfeff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12
    },
    myBookingsText: { fontSize: 12, fontWeight: '700', color: '#0891b2' },
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
