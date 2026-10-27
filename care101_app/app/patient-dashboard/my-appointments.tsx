import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    Modal,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
    ChevronLeft,
    CalendarClock,
    Clock,
    CreditCard,
    XCircle,
    Plus,
    Repeat
} from 'lucide-react-native';
import { useAuth } from '@/context/auth';
import { useStripe } from '@stripe/stripe-react-native';
import { payBill } from '@/services/billPayment';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const formatTime = (value: string | Date) =>
    new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDay = (value: string | Date) =>
    new Date(value).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}));
    return data.msg || data.message || fallback;
};

// Status shown on each booking card
const describeStatus = (appt: any) => {
    if (appt.status === 'cancelled') {
        const refund = appt.bill?.status === 'Refunded'
            ? ' • Refunded'
            : appt.bill?.status === 'Refund Due' ? ' • Refund at counter' : '';
        return { label: `Cancelled${refund}`, color: '#ef4444', bg: '#fef2f2' };
    }
    if (appt.status === 'completed') return { label: 'Completed', color: '#64748b', bg: '#f1f5f9' };
    if (appt.paymentStatus === 'paid') return { label: 'Confirmed • Paid', color: '#059669', bg: '#ecfdf5' };
    if (appt.holdExpiresAt) {
        return { label: `Unpaid • held until ${formatTime(appt.holdExpiresAt)}`, color: '#d97706', bg: '#fffbeb' };
    }
    return { label: 'Awaiting payment', color: '#d97706', bg: '#fffbeb' };
};

const isUpcoming = (appt: any) => {
    if (appt.status === 'cancelled' || appt.status === 'completed') return false;
    const end = appt.session?.endTime ? new Date(appt.session.endTime) : new Date(appt.date);
    if (!appt.session?.endTime) end.setHours(23, 59, 59, 999);
    return end.getTime() >= Date.now();
};

export default function MyAppointmentsScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
    const [busyId, setBusyId] = useState<string | null>(null);

    // Reschedule picker
    const [rescheduleFor, setRescheduleFor] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    const fetchAppointments = useCallback(async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/appointments/my-appointments`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAppointments(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Fetch My Appointments Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
            fetchAppointments();
        }, [fetchAppointments])
    );

    const visible = useMemo(() => {
        const upcoming = appointments.filter(isUpcoming)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const past = appointments.filter(a => !isUpcoming(a));
        return tab === 'upcoming' ? upcoming : past;
    }, [appointments, tab]);

    const handlePay = async (appt: any) => {
        if (!token || !appt.bill?._id) return;
        setBusyId(appt._id);
        try {
            const result = await payBill(token, appt.bill._id, { initPaymentSheet, presentPaymentSheet });
            if (result.status === 'paid') {
                Alert.alert('Payment Successful', result.queueNumber
                    ? `Your booking is confirmed. Queue token #${result.queueNumber}.`
                    : 'Your booking is confirmed.');
            } else if (result.status === 'unconfirmed') {
                Alert.alert('Payment Received', result.message);
            } else if (result.status === 'failed') {
                Alert.alert('Payment Failed', result.message);
            }
        } finally {
            setBusyId(null);
            fetchAppointments();
        }
    };

    const handleCancel = (appt: any) => {
        const paid = appt.paymentStatus === 'paid';
        Alert.alert(
            'Cancel this booking?',
            `${appt.doctorName} on ${formatDay(appt.date)}, token #${appt.queueNumber ?? '-'}.` +
            (paid ? '\n\nCard payments are refunded automatically (5–10 days). Cash payments are refunded at the reception desk.' : ''),
            [
                { text: 'Keep booking', style: 'cancel' },
                {
                    text: 'Cancel booking',
                    style: 'destructive',
                    onPress: async () => {
                        setBusyId(appt._id);
                        try {
                            const response = await fetch(`${API_URL}/appointments/cancel/${appt._id}`, {
                                method: 'PUT',
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            if (!response.ok) {
                                Alert.alert('Could Not Cancel', await readError(response, 'Please try again.'));
                                return;
                            }
                            const data = await response.json().catch(() => ({}));
                            Alert.alert(
                                'Booking Cancelled',
                                data.billStatus === 'Refunded'
                                    ? 'Your refund is on its way to your card.'
                                    : data.billStatus === 'Refund Due'
                                        ? 'Please collect your refund from the reception desk.'
                                        : 'Your booking has been cancelled.'
                            );
                        } catch {
                            Alert.alert('Connection Error', 'Could not reach the server. Please try again.');
                        } finally {
                            setBusyId(null);
                            fetchAppointments();
                        }
                    }
                }
            ]
        );
    };

    const openReschedule = async (appt: any) => {
        setRescheduleFor(appt);
        setSessions([]);
        setLoadingSessions(true);
        try {
            const doctorId = appt.doctorId?._id || appt.doctorId;
            const response = await fetch(`${API_URL}/schedule-requests/doctor/${doctorId}/approved`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const currentId = appt.scheduleId || appt.session?._id;
                setSessions((Array.isArray(data) ? data : []).filter((s: any) => s._id !== currentId));
            }
        } catch (error) {
            console.error('Fetch sessions error:', error);
        } finally {
            setLoadingSessions(false);
        }
    };

    const confirmReschedule = (session: any) => {
        const appt = rescheduleFor;
        if (!appt) return;
        Alert.alert(
            'Move booking?',
            `Move to ${formatDay(session.startTime)}, ${formatTime(session.startTime)} – ${formatTime(session.endTime)}? ` +
            'Your payment stays with the booking. You may get a new token number.',
            [
                { text: 'Back', style: 'cancel' },
                {
                    text: 'Move',
                    onPress: async () => {
                        setBusyId(appt._id);
                        setRescheduleFor(null);
                        try {
                            const response = await fetch(`${API_URL}/appointments/reschedule/${appt._id}`, {
                                method: 'PUT',
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ scheduleId: session._id })
                            });
                            if (!response.ok) {
                                Alert.alert('Could Not Reschedule', await readError(response, 'Please try again.'));
                                return;
                            }
                            const updated = await response.json();
                            Alert.alert('Booking Moved', `You are now booked for ${formatDay(updated.date)} at ${formatTime(updated.date)}, token #${updated.queueNumber}.`);
                        } catch {
                            Alert.alert('Connection Error', 'Could not reach the server. Please try again.');
                        } finally {
                            setBusyId(null);
                            fetchAppointments();
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => {
        const status = describeStatus(item);
        const busy = busyId === item._id;
        const start = item.session?.startTime || item.date;
        const canPay = item.status !== 'cancelled' && item.paymentStatus !== 'paid' && item.bill?.status === 'Pending';

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.tokenBox}>
                        <Text style={styles.tokenLabel}>TOKEN</Text>
                        <Text style={styles.tokenNumber}>{item.queueNumber ?? '-'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.doctorName}>{item.doctorName}</Text>
                        <Text style={styles.meta}>{item.department}</Text>
                        <View style={styles.timeRow}>
                            <Clock size={13} color="#64748b" />
                            <Text style={styles.meta}>
                                {formatDay(start)}
                                {item.session ? ` • ${formatTime(item.session.startTime)} – ${formatTime(item.session.endTime)}` : ''}
                            </Text>
                        </View>
                        {!!item.session?.allocatedRoom && (
                            <Text style={styles.meta}>Room {item.session.allocatedRoom}</Text>
                        )}
                    </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>

                {tab === 'upcoming' && (
                    busy ? (
                        <ActivityIndicator color="#06b6d4" style={{ marginTop: 12 }} />
                    ) : (
                        <>
                            <View style={styles.actions}>
                                {canPay && (
                                    <TouchableOpacity style={[styles.actionButton, styles.payButton]} onPress={() => handlePay(item)}>
                                        <CreditCard size={15} color="#fff" />
                                        <Text style={[styles.actionText, { color: '#fff' }]}>
                                            Pay LKR {Number(item.bill?.amount || item.amount).toLocaleString()}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                {item.canChange && (
                                    <TouchableOpacity style={styles.actionButton} onPress={() => openReschedule(item)}>
                                        <Repeat size={15} color="#0891b2" />
                                        <Text style={styles.actionText}>Reschedule</Text>
                                    </TouchableOpacity>
                                )}
                                {item.canChange && (
                                    <TouchableOpacity style={[styles.actionButton, styles.cancelAction]} onPress={() => handleCancel(item)}>
                                        <XCircle size={15} color="#ef4444" />
                                        <Text style={[styles.actionText, { color: '#ef4444' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {!item.canChange && !!item.changeBlockedReason && (
                                <Text style={styles.blockedText}>{item.changeBlockedReason}</Text>
                            )}
                        </>
                    )
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ChevronLeft size={24} color="#1e293b" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Bookings</Text>
                    <TouchableOpacity
                        onPress={() => router.push('/patient-dashboard/appointments')}
                        style={styles.newButton}
                    >
                        <Plus size={16} color="#fff" />
                        <Text style={styles.newButtonText}>Book</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.tabs}>
                    {(['upcoming', 'past'] as const).map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.tab, tab === t && styles.tabActive]}
                            onPress={() => setTab(t)}
                        >
                            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                                {t === 'upcoming' ? 'Upcoming' : 'Past & cancelled'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </SafeAreaView>

            {loading ? (
                <ActivityIndicator size="large" color="#06b6d4" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={visible}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchAppointments(); }}
                            colors={['#06b6d4']}
                            tintColor="#06b6d4"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <CalendarClock size={40} color="#cbd5e1" />
                            <Text style={styles.emptyText}>
                                {tab === 'upcoming' ? 'You have no upcoming bookings.' : 'No past bookings yet.'}
                            </Text>
                            {tab === 'upcoming' && (
                                <TouchableOpacity onPress={() => router.push('/patient-dashboard/appointments')}>
                                    <Text style={styles.emptyLink}>Book an appointment</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            )}

            {/* RESCHEDULE: pick another session of the same doctor */}
            <Modal
                transparent
                animationType="slide"
                visible={!!rescheduleFor}
                onRequestClose={() => setRescheduleFor(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Choose a new session</Text>
                        <Text style={styles.modalSubtitle}>{rescheduleFor?.doctorName}</Text>

                        {loadingSessions ? (
                            <ActivityIndicator color="#06b6d4" style={{ marginVertical: 24 }} />
                        ) : sessions.length === 0 ? (
                            <Text style={styles.emptyText}>This doctor has no other open sessions right now.</Text>
                        ) : (
                            <ScrollView style={{ maxHeight: 360 }}>
                                {sessions.map(session => {
                                    const availability = session.availability || {};
                                    const full = Boolean(availability.isFull);
                                    return (
                                        <TouchableOpacity
                                            key={session._id}
                                            disabled={full}
                                            style={[styles.sessionRow, full && { opacity: 0.5 }]}
                                            onPress={() => confirmReschedule(session)}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.sessionDay}>{formatDay(session.startTime)}</Text>
                                                <Text style={styles.meta}>
                                                    {formatTime(session.startTime)} – {formatTime(session.endTime)}
                                                </Text>
                                            </View>
                                            <Text style={[styles.sessionPlaces, full && { color: '#ef4444' }]}>
                                                {full ? 'FULL' : availability.remaining == null ? 'Open' : `${availability.remaining} left`}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}

                        <TouchableOpacity style={styles.modalClose} onPress={() => setRescheduleFor(null)}>
                            <Text style={styles.modalCloseText}>Close</Text>
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
        paddingVertical: 15
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    newButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#06b6d4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12
    },
    newButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    tabs: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
    tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9' },
    tabActive: { backgroundColor: '#0f172a' },
    tabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    tabTextActive: { color: '#fff' },
    list: { padding: 20, paddingBottom: 40, gap: 14 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        elevation: 2
    },
    cardTop: { flexDirection: 'row', gap: 14 },
    tokenBox: {
        width: 56,
        height: 56,
        borderRadius: 14,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center'
    },
    tokenLabel: { fontSize: 9, fontWeight: '700', color: '#06b6d4' },
    tokenNumber: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    doctorName: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginTop: 12 },
    statusText: { fontSize: 12, fontWeight: '700' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#ecfeff'
    },
    payButton: { backgroundColor: '#06b6d4' },
    cancelAction: { backgroundColor: '#fef2f2' },
    actionText: { fontSize: 13, fontWeight: '700', color: '#0891b2' },
    blockedText: { fontSize: 12, color: '#94a3b8', marginTop: 10 },
    empty: { alignItems: 'center', marginTop: 60, gap: 10 },
    emptyText: { fontSize: 14, color: '#94a3b8', textAlign: 'center' },
    emptyLink: { fontSize: 14, fontWeight: '700', color: '#06b6d4' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    modalSubtitle: { fontSize: 14, color: '#64748b', marginBottom: 16, marginTop: 4 },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10
    },
    sessionDay: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
    sessionPlaces: { fontSize: 12, fontWeight: '800', color: '#0891b2' },
    modalClose: { marginTop: 8, padding: 12, alignItems: 'center' },
    modalCloseText: { color: '#64748b', fontWeight: '600', fontSize: 14 }
});
