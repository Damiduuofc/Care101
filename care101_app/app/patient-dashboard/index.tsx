import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    Image,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Platform,
    ActivityIndicator,
    Modal,
    Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
    ChevronRight,
    Calendar,
    FileText,
    User,
    Clock,
    ShieldCheck,
    Users,
    X,
    AlertCircle,
    CreditCard // <--- Added this for the Payment Icon
} from 'lucide-react-native';

import PatientBottomNavBar from '../../components/PatientBottomNavBar';
import { useAuth } from '@/context/auth';
import AiAssistant from '@/components/ui/AiAssistant';

// Replace with your actual API URL
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000/api'; 

export default function PatientDashboardScreen() {
    const router = useRouter();
    const { user, isLoading: authLoading, token } = useAuth(); 

    // --- STATE MANAGEMENT ---
    const [loading, setLoading] = useState(true);
    const [upcomingAppointment, setUpcomingAppointment] = useState<any>(null);
    const [queueData, setQueueData] = useState<any>(null);
    const [isQueueVisible, setQueueVisible] = useState(false);

    // Session Check
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/');
        }
    }, [user, authLoading]);

    // --- FETCH DATA ---
    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            
            // 1. Fetch Upcoming Appointment
            const response = await fetch(`${API_URL}/appointments/upcoming`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUpcomingAppointment(data.appointment || null); 
            } else {
                setUpcomingAppointment(null);
            }

        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- FETCH LIVE QUEUE DATA ---
    const fetchQueueStatus = async (appointmentId: string) => {
        try {
            const response = await fetch(`${API_URL}/queue/status/${appointmentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setQueueData(data);
                setQueueVisible(true); 
            } else {
                Alert.alert("Error", "Unable to fetch live queue status.");
            }
        } catch (error) {
            console.error("Queue Fetch Error:", error);
            Alert.alert("Error", "Connection failed.");
        }
    };

    useEffect(() => {
        if (user && token) {
            fetchDashboardData();
        }
    }, [user, token]);

    // ✅ UPDATED HELPER: Robust Name Formatter
    const getFormattedName = () => {
        if (!user) return "Patient";
        
        // 1. Get Title (Mr./Mrs.)
        const title = user.title ? `${user.title}. ` : '';
        
        // 2. Find the best available name
        const name = user.fullName || 
                     user.name || 
                     user.username || 
                     (user.email ? user.email.split('@')[0] : "Patient");
                     
        return `${title}${name}`;
    };

    // Helper to format date
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return {
            day: date.getDate(),
            month: date.toLocaleString('default', { month: 'short' }).toUpperCase()
        };
    };

    if (authLoading || loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

    const bannerImage = { uri: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80" };

    const quickActions = [
        {
            id: 1,
            title: 'Book Appointment',
            subtitle: 'Find a doctor and schedule a visit',
            icon: Calendar,
            link: '/patient-dashboard/appointments',
            color: '#06b6d4',
            bg: '#cffafe',
        },
        {
            id: 2,
            title: 'Medical Records',
            subtitle: 'View your history and prescriptions',
            icon: FileText,
            link: '/patient-dashboard/records',
            color: '#8b5cf6',
            bg: '#f5f3ff',
        },
         {
            id: 3, // ✅ Unique ID
            title: 'Payment',
            subtitle: 'Manage your billing and invoices',
            icon: CreditCard, // ✅ Changed Icon
            link: '/patient-dashboard/billing',
            color: '#ec4899', // ✅ Changed Color to Pink (Distinct from Profile)
            bg: '#fdf2f8',
        },
        {
            id: 4, // ✅ Unique ID (Must be different from 3)
            title: 'Update Profile',
            subtitle: 'Manage your personal information',
            icon: User,
            link: '/patient-dashboard/profile',
            color: '#f59e0b',
            bg: '#fffbeb',
        },
    ];

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

            <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
                <View style={styles.headerContainer}>
                    <View style={styles.profileSection}>
                        <View style={styles.avatarContainer}>
                            <User size={24} color="#06b6d4" />
                        </View>
                        <View>
                            <Text style={styles.welcomeText}>Welcome Back,</Text>
                            <Text style={styles.userName}>{getFormattedName()}</Text>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* --- HERO BANNER --- */}
                <View style={styles.heroContainer}>
                    <Image source={bannerImage} style={styles.heroImage} />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)']}
                        style={styles.heroOverlay}
                    >
                        <Text style={styles.heroTitle}>YOUR HEALTH MATTERS</Text>
                        <Text style={styles.heroSubtitle}>Manage your care journey with ease</Text>
                    </LinearGradient>
                </View>

                {/* --- UPCOMING APPOINTMENT SECTION --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Upcoming Appointment</Text>
                    
                    {upcomingAppointment ? (
                        <TouchableOpacity 
                            style={styles.appointmentCard}
                            onPress={() => fetchQueueStatus(upcomingAppointment._id || upcomingAppointment.id)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.appointLeft}>
                                <View style={styles.dateBox}>
                                    <Text style={styles.dateDay}>
                                        {formatDate(upcomingAppointment.date).day}
                                    </Text>
                                    <Text style={styles.dateMonth}>
                                        {formatDate(upcomingAppointment.date).month}
                                    </Text>
                                </View>
                                <View style={styles.appointDetails}>
                                    <Text style={styles.doctorName}>
                                        {upcomingAppointment.doctorName || "Dr. Unknown"}
                                    </Text>
                                    <Text style={styles.specialty}>
                                        {upcomingAppointment.specialty || "General"}
                                    </Text>
                                    <View style={styles.timeRow}>
                                        <Clock size={14} color="#64748b" />
                                        <Text style={styles.timeText}>
                                            {upcomingAppointment.time || "TBA"}
                                        </Text>
                                    </View>
                                    <Text style={styles.tapHint}>Tap to view queue status</Text>
                                </View>
                            </View>
                            <View style={styles.viewButton}>
                                <Text style={styles.viewButtonText}>View</Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        // Fallback if no appointment
                        <View style={styles.emptyCard}>
                            <Calendar size={24} color="#94a3b8" />
                            <Text style={styles.emptyText}>No upcoming appointments scheduled.</Text>
                            <TouchableOpacity onPress={() => router.push('/patient-dashboard/appointments')}>
                                <Text style={styles.bookNowText}>Book Now</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* --- QUICK ACTIONS SECTION --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionList}>
                        {quickActions.map((action) => (
                            <TouchableOpacity
                                key={action.id}
                                style={styles.actionCard}
                                onPress={() => router.push(action.link as any)}
                            >
                                <View style={[styles.actionIconBox, { backgroundColor: action.bg }]}>
                                    <action.icon size={24} color={action.color} />
                                </View>
                                <View style={styles.actionDetails}>
                                    <Text style={styles.actionTitle}>{action.title}</Text>
                                    <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
                                </View>
                                <ChevronRight size={20} color="#cbd5e1" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* --- INFO CARD --- */}
                <View style={styles.section}>
                    <View style={styles.infoCard}>
                        <ShieldCheck size={32} color="#10b981" style={{ marginBottom: 8 }} />
                        <Text style={styles.infoTitle}>Complete your profile</Text>
                        <Text style={styles.infoText}>Ensure your medical history needs are up to date for better care.</Text>
                    </View>
                </View>
                
                <View style={{ height: 80 }} /> 
            </ScrollView>

            {/* --- QUEUE STATUS MODAL --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isQueueVisible}
                onRequestClose={() => setQueueVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Live Queue Status</Text>
                            <TouchableOpacity onPress={() => setQueueVisible(false)}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>
                        
                        {queueData ? (
                            <>
                                <View style={styles.queueContainer}>
                                    <View style={styles.tokenBox}>
                                        <Text style={styles.tokenLabel}>Your Token</Text>
                                        <Text style={styles.tokenNumber}>
                                            {queueData.myToken || "--"}
                                        </Text>
                                    </View>

                                    <View style={[styles.tokenBox, styles.activeTokenBox]}>
                                        <Text style={styles.activeTokenLabel}>Ongoing</Text>
                                        <Text style={styles.activeTokenNumber}>
                                            {queueData.currentToken || "--"}
                                        </Text>
                                        <View style={styles.liveIndicator}>
                                            <View style={styles.liveDot} />
                                            <Text style={styles.liveText}>Live</Text>
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.queueInfo}>
                                    <Users size={16} color="#64748b" />
                                    <Text style={styles.queueInfoText}>
                                        {queueData.peopleAhead || 0} people ahead of you
                                    </Text>
                                </View>
                                <View style={styles.queueInfo}>
                                    <Clock size={16} color="#64748b" />
                                    <Text style={styles.queueInfoText}>
                                        Approx. Wait: {queueData.estimatedWait || 0} mins
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <ActivityIndicator color="#06b6d4" />
                                <Text style={{ marginTop: 10, color: '#64748b' }}>Updating status...</Text>
                            </View>
                        )}

                        <TouchableOpacity 
                            style={styles.closeButton}
                            onPress={() => setQueueVisible(false)}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* --- FLOATING AI ASSISTANT --- */}
            <View style={{ zIndex: 100 }}>
                <AiAssistant />
            </View>

            <PatientBottomNavBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    headerSafeArea: {
        backgroundColor: '#fff',
        zIndex: 10,
        paddingTop: Platform.OS === 'android' ? 10 : 0,
    },
    headerContainer: {
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        backgroundColor: '#fff',
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#cffafe',
    },
    welcomeText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
        marginBottom: 2,
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
    },
    scrollContent: {
        paddingBottom: 20,
    },
    heroContainer: {
        margin: 20,
        height: 160,
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#0f172a',
        shadowColor: '#06b6d4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    heroImage: {
        width: '100%',
        height: '100%',
        opacity: 0.8,
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        paddingTop: 40,
    },
    heroTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4,
    },
    heroSubtitle: {
        color: '#cbd5e1',
        fontSize: 14,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
    },
    actionList: {
        gap: 12,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    actionIconBox: {
        width: 48,
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    actionDetails: {
        flex: 1,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1e293b',
        marginBottom: 4,
    },
    actionSubtitle: {
        fontSize: 12,
        color: '#94a3b8',
    },
    appointmentCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    emptyCard: {
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderStyle: 'dashed'
    },
    emptyText: {
        color: '#94a3b8',
        marginVertical: 8,
        fontSize: 14
    },
    bookNowText: {
        color: '#06b6d4',
        fontWeight: '600',
        fontSize: 14
    },
    appointLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateBox: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        width: 50,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    dateDay: {
        fontSize: 18,
        fontWeight: '700',
        color: '#2563eb',
    },
    dateMonth: {
        fontSize: 12,
        fontWeight: '600',
        color: '#60a5fa',
        textTransform: 'uppercase',
    },
    appointDetails: {
        justifyContent: 'center',
    },
    doctorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        marginBottom: 4,
    },
    specialty: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 4,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 12,
        color: '#64748b',
        marginLeft: 4,
    },
    tapHint: {
        fontSize: 10,
        color: '#06b6d4',
        marginTop: 4,
        fontWeight: '500'
    },
    viewButton: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    viewButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#475569',
    },
    infoCard: {
        backgroundColor: '#ecfdf5',
        borderRadius: 16,
        padding: 20,
        alignItems: 'flex-start',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#065f46',
        marginBottom: 4,
    },
    infoText: {
        fontSize: 14,
        color: '#10b981',
        lineHeight: 20,
    },
    /* --- MODAL STYLES --- */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#fff',
        width: '90%',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5
    },
    modalHeader: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a'
    },
    queueContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
        gap: 15
    },
    tokenBox: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        borderRadius: 16,
        padding: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0'
    },
    activeTokenBox: {
        backgroundColor: '#ecfeff',
        borderColor: '#06b6d4',
        borderWidth: 2
    },
    tokenLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 5,
        textTransform: 'uppercase',
        fontWeight: '600'
    },
    tokenNumber: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1e293b'
    },
    activeTokenLabel: {
        fontSize: 12,
        color: '#0891b2',
        marginBottom: 5,
        textTransform: 'uppercase',
        fontWeight: '700'
    },
    activeTokenNumber: {
        fontSize: 36,
        fontWeight: '800',
        color: '#06b6d4'
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        backgroundColor: '#06b6d4',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#fff',
        marginRight: 4
    },
    liveText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700'
    },
    queueInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8
    },
    queueInfoText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: '500'
    },
    closeButton: {
        marginTop: 10,
        width: '100%',
        backgroundColor: '#0f172a',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center'
    },
    closeButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16
    }
});