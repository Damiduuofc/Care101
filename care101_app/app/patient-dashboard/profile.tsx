import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PatientBottomNavBar from '../../components/PatientBottomNavBar';
import { useAuth } from '@/context/auth';

export default function ProfileScreen() {
    const { user, signOut } = useAuth();

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.title}>My Profile</Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Profile Header */}
                    <View style={styles.profileCard}>
                        <View style={styles.avatarContainer}>
                            <Ionicons name="person" size={40} color="#06b6d4" />
                        </View>
                        <Text style={styles.name}>{user?.username || user?.fullName || "John Doe"}</Text>
                        <Text style={styles.email}>{user?.email || "john.doe@example.com"}</Text>
                        <Text style={styles.role}>Patient</Text>

                        <TouchableOpacity style={styles.editButton}>
                            <Text style={styles.editButtonText}>Edit Profile</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Settings Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>General</Text>
                        <TouchableOpacity style={styles.settingItem}>
                            <Ionicons name="person-outline" size={22} color="#64748b" />
                            <Text style={styles.settingText}>Personal Information</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingItem}>
                            <Ionicons name="medical-outline" size={22} color="#64748b" />
                            <Text style={styles.settingText}>Medical History</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingItem}>
                            <Ionicons name="notifications-outline" size={22} color="#64748b" />
                            <Text style={styles.settingText}>Notifications</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Account</Text>
                        <TouchableOpacity style={styles.settingItem}>
                            <Ionicons name="lock-closed-outline" size={22} color="#64748b" />
                            <Text style={styles.settingText}>Security</Text>
                            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingItem} onPress={signOut}>
                            <Ionicons name="log-out-outline" size={22} color="#ef4444" />
                            <Text style={[styles.settingText, { color: '#ef4444' }]}>Log Out</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
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
    scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },

    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 4,
    },
    avatarContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#cffafe',
    },
    name: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    email: { fontSize: 14, color: '#64748b', marginBottom: 4 },
    role: {
        fontSize: 12,
        color: '#06b6d4',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 16
    },
    editButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#f1f5f9',
        borderRadius: 20,
    },
    editButtonText: { fontSize: 14, fontWeight: '600', color: '#475569' },

    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: '600', color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    settingText: { flex: 1, marginLeft: 16, fontSize: 16, color: '#334155', fontWeight: '500' },
});
