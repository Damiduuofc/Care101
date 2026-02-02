import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function RoleSelectionScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;

    const logoSource = require('../../assets/logo1.png');

    const handleRoleSelect = (role: 'doctor' | 'patient') => {
        if (role === 'doctor') {
            router.push('/signup/doctor/step1');
        } else {
            router.push('/signup/patient/step1');
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <LinearGradient
                colors={['#0f172a', '#0891b2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.background}
            >
                <SafeAreaView style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.container}>
                        <View style={styles.logoContainer}>
                            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
                            <Text style={styles.title}>Welcome to Care 101</Text>
                            <Text style={styles.subtitle}>Choose your account type to get started</Text>
                        </View>

                        <View style={styles.cardsContainer}>
                            {/* Doctor Card */}
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => handleRoleSelect('doctor')}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#ffffff', '#f1f5f9']}
                                    style={styles.cardGradient}
                                >
                                    <View style={styles.iconContainer}>
                                        <Ionicons name="medkit" size={32} color="#0891b2" />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={styles.cardTitle}>I am a Doctor</Text>
                                        <Text style={styles.cardDescription}>
                                            Manage appointments, view patient records, and grow your practice.
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
                                </LinearGradient>
                            </TouchableOpacity>

                            {/* Patient Card */}
                            <TouchableOpacity
                                style={styles.card}
                                onPress={() => handleRoleSelect('patient')}
                                activeOpacity={0.9}
                            >
                                <LinearGradient
                                    colors={['#ffffff', '#f1f5f9']}
                                    style={styles.cardGradient}
                                >
                                    <View style={[styles.iconContainer, { backgroundColor: '#e0f2fe' }]}>
                                        <Ionicons name="person" size={32} color="#0284c7" />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={styles.cardTitle}>I am a Patient</Text>
                                        <Text style={styles.cardDescription}>
                                            Book appointments, access medical history, and consult with doctors.
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color="#94a3b8" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.loginLinkContainer}
                            onPress={() => router.push('/login')}
                        >
                            <Text style={styles.loginText}>Already have an account? </Text>
                            <Text style={styles.loginLink}>Log In</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    background: { flex: 1 },
    container: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: 40 },
    logo: { width: 120, height: 120, marginBottom: 20 },
    title: { fontSize: 28, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#e2e8f0', textAlign: 'center', maxWidth: 300 },

    cardsContainer: { width: '100%', maxWidth: 500, interval: 16 },
    card: {
        marginBottom: 16,
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        overflow: 'hidden'
    },
    cardGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ecfeff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16
    },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    cardDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },

    loginLinkContainer: { flexDirection: 'row', marginTop: 32 },
    loginText: { color: '#e2e8f0', fontSize: 15 },
    loginLink: { color: '#fff', fontWeight: '700', fontSize: 15, textDecorationLine: 'underline' }
});
