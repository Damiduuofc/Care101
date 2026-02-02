import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    Image,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    Platform,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import {
    ChevronRight,
    Calendar,
    FileText,
    User,
    Clock,
    ShieldCheck
} from 'lucide-react-native';

import PatientBottomNavBar from '../../components/PatientBottomNavBar';
import { useAuth } from '@/context/auth';

export default function PatientDashboardScreen() {
    const router = useRouter();
    const { user, isLoading } = useAuth();
    const [loading, setLoading] = useState(false); // Set to false for now as we have no API yet

    // Session Check
    React.useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/');
        }
    }, [user, isLoading]);

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
            id: 3,
            title: 'Update Profile',
            subtitle: 'Manage your personal information',
            icon: User,
            link: '/patient-dashboard/profile',
            color: '#f59e0b',
            bg: '#fffbeb',
        },
    ];

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#06b6d4" />
            </View>
        );
    }

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
                            <Text style={styles.userName}>{user?.username || user?.fullName || "Patient"}</Text>
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

                {/* --- UPCOMING APPOINTMENT (Placeholder) --- */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Upcoming Appointment</Text>
                    <View style={styles.appointmentCard}>
                        <View style={styles.appointLeft}>
                            <View style={styles.dateBox}>
                                <Text style={styles.dateDay}>12</Text>
                                <Text style={styles.dateMonth}>OCT</Text>
                            </View>
                            <View style={styles.appointDetails}>
                                <Text style={styles.doctorName}>Dr. Sarah Smith</Text>
                                <Text style={styles.specialty}>Cardiologist</Text>
                                <View style={styles.timeRow}>
                                    <Clock size={14} color="#64748b" />
                                    <Text style={styles.timeText}>10:00 AM - 10:30 AM</Text>
                                </View>
                            </View>
                        </View>
                        <TouchableOpacity style={styles.viewButton}>
                            <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                    </View>
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

                {/* --- HEALTH TIPS / INFO --- */}
                <View style={styles.section}>
                    <View style={styles.infoCard}>
                        <ShieldCheck size={32} color="#10b981" style={{ marginBottom: 8 }} />
                        <Text style={styles.infoTitle}>Complete your profile</Text>
                        <Text style={styles.infoText}>Ensure your medical history needs are up to date for better care.</Text>
                    </View>
                </View>

            </ScrollView>

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
        paddingBottom: 100,
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
    // Appointment Card Styles
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
    // Info Card
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
});
