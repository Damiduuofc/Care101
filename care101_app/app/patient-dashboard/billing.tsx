import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
    ChevronLeft,
    CreditCard,
    Clock,
    CheckCircle,
    Receipt,
    Filter,
    Calendar
} from 'lucide-react-native';
import { useAuth } from '@/context/auth';
import { useStripe } from '@stripe/stripe-react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function BillingScreen() {
    const router = useRouter();
    const { token } = useAuth();
    const { initPaymentSheet, presentPaymentSheet } = useStripe();

    const [bills, setBills] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paying, setPaying] = useState<string | null>(null);
    const [filter, setFilter] = useState<'All' | 'Pending' | 'Paid'>('All');

    const fetchBills = async () => {
        try {
            const response = await fetch(`${API_URL}/payments/my-bills`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                setBills(data);
            }
        } catch (error) {
            console.error("Fetch Bills Error:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (token) fetchBills();
    }, [token]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchBills();
    };

    const filteredBills = useMemo(() => {
        if (filter === 'All') return bills;
        return bills.filter(bill => bill.status === filter);
    }, [bills, filter]);

    const handlePayBill = async (bill: any) => {
        try {
            setPaying(bill._id);

            // 1. Create Payment Intent on Backend
            const response = await fetch(`${API_URL}/payments/create-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount: Math.round(bill.amount * 100) }) // Amount in cents
            });

            if (!response.ok) {
                throw new Error("Failed to initialize payment");
            }

            const { clientSecret } = await response.json();

            // 2. Initialize Stripe Payment Sheet
            const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: clientSecret,
                merchantDisplayName: 'Care101 Hospital',
                defaultBillingDetails: { address: { country: 'LK' } }
            });

            if (initError) {
                Alert.alert('Initialization failed', initError.message);
                return;
            }

            // 3. Present Stripe Payment Sheet
            const { error: paymentError } = await presentPaymentSheet();

            if (paymentError) {
                if (paymentError.code !== 'Canceled') {
                    Alert.alert(`Error: ${paymentError.code}`, paymentError.message);
                }
            } else {
                // 4. On Success, notify backend
                const successResponse = await fetch(`${API_URL}/payments/pay-bill/${bill._id}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (successResponse.ok) {
                    Alert.alert('Success', 'Payment completed successfully!');
                    fetchBills(); // Refresh list
                } else {
                    Alert.alert('Partially Successful', 'Payment recorded by Stripe, but we failed to update our records. Please contact support.');
                }
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Payment Error', error.message || 'Something went wrong');
        } finally {
            setPaying(null);
        }
    };

    const renderBillItem = ({ item }: { item: any }) => {
        const isPricePending = item.amount === 0 && item.status !== 'Paid';

        return (
            <View style={styles.billCard}>
                <View style={styles.billHeader}>
                    <View style={[styles.typeBadge, { 
                        backgroundColor: item.type === 'Appointment' ? '#ecfeff' : 
                                        item.type === 'Pharmacy' ? '#f0fdf4' : 
                                        item.type === 'Lab' ? '#faf5ff' : '#fef2f2' 
                    }]}>
                        <Text style={[styles.typeText, { 
                            color: item.type === 'Appointment' ? '#0891b2' : 
                                   item.type === 'Pharmacy' ? '#16a34a' : 
                                   item.type === 'Lab' ? '#7c3aed' : '#dc2626' 
                        }]}>{item.type}</Text>
                    </View>
                    <Text style={styles.billDate}>
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                </View>

                <Text style={styles.billTitle}>{item.title}</Text>
                
                <View style={styles.billFooter}>
                    <View>
                        <Text style={styles.amountLabel}>Total Amount</Text>
                        <Text style={styles.amountValue}>
                            {isPricePending ? 'Price Pending' : `LKR ${item.amount.toLocaleString()}`}
                        </Text>
                    </View>

                    {item.status === 'Paid' ? (
                        <View style={styles.paidBadge}>
                            <CheckCircle size={14} color="#059669" />
                            <Text style={styles.paidText}>PAID</Text>
                        </View>
                    ) : isPricePending ? (
                        <View style={[styles.paidBadge, { backgroundColor: '#fff7ed' }]}>
                            <Clock size={14} color="#d97706" />
                            <Text style={[styles.paidText, { color: '#d97706' }]}>AWAITING PRICE</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            style={styles.payButton} 
                            onPress={() => handlePayBill(item)}
                            disabled={paying === item._id}
                        >
                            {paying === item._id ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <CreditCard size={14} color="#fff" />
                                    <Text style={styles.payButtonText}>Pay Now</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
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
                    <Text style={styles.headerTitle}>Payments & Bills</Text>
                    <View style={{ width: 24 }} />
                </View>

                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
                        {['All', 'Pending', 'Paid'].map((f) => (
                            <TouchableOpacity 
                                key={f} 
                                style={[styles.filterChip, filter === f && styles.activeFilterChip]}
                                onPress={() => setFilter(f as any)}
                            >
                                <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </SafeAreaView>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#06b6d4" />
                </View>
            ) : (
                <FlatList
                    data={filteredBills}
                    keyExtractor={item => item._id}
                    renderItem={renderBillItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#06b6d4']} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Receipt size={64} color="#e2e8f0" />
                            <Text style={styles.emptyTitle}>No bills found</Text>
                            <Text style={styles.emptySubtitle}>
                                {filter === 'All' ? "You don't have any bills yet." : `No ${filter.toLowerCase()} bills to show.`}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    safeArea: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    
    filterContainer: { paddingBottom: 12 },
    filterList: { paddingHorizontal: 20, gap: 10 },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    activeFilterChip: { backgroundColor: '#06b6d4', borderColor: '#06b6d4' },
    filterText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
    activeFilterText: { color: '#fff' },

    listContent: { padding: 20, paddingBottom: 40 },
    billCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#f1f5f9'
    },
    billHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    typeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    billDate: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
    billTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
    
    billFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12
    },
    amountLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2 },
    amountValue: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    
    paidBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d1fae5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6
    },
    paidText: { fontSize: 12, fontWeight: '800', color: '#059669' },
    
    payButton: {
        backgroundColor: '#06b6d4',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 8,
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    payButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        paddingHorizontal: 40
    },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 16 },
    emptySubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 8, lineHeight: 20 }
});
