import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    useWindowDimensions,
    ImageBackground,
    Image,
    Modal,
    FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";

// List of Districts (Sri Lanka)
const DISTRICTS = [
    "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha",
    "Hambantota", "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala",
    "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
    "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
];

// --- VALIDATION SCHEMA ---
const formSchema = z.object({
    mobileNumber: z.string().min(9, { message: "Valid mobile number is required." }),
    email: z.string().email({ message: "Invalid email address" }),
    district: z.string().min(1, { message: "Please select your district." }),
});

type FormValues = z.infer<typeof formSchema>;

export default function PatientSignupStep2() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;
    const [modalVisible, setModalVisible] = useState(false);

    // --- ASSETS ---
    const logoSource = require('../../../assets/logo1.png');
    const bgSource = { uri: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=2070&auto=format&fit=crop' };

    // --- FORM SETUP ---
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            mobileNumber: "",
            email: "",
            district: "",
        },
    });

    const onSubmit = (values: FormValues) => {
        // Merge previous steps data with current data
        const payload = {
            ...params,
            ...values,
        };

        router.push({
            pathname: "/signup/patient/step3",
            params: payload as any
        });
    };

    // --- REUSABLE INPUT ---
    const FormInput = ({ control, name, placeholder, icon, keyboardType = 'default' }: any) => (
        <Controller
            control={control}
            name={name}
            render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>{name.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase())}</Text>
                    <View style={[styles.inputWrapper, error && styles.inputError]}>
                        <Ionicons name={icon} size={20} color="#64748b" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={placeholder}
                            placeholderTextColor="#94a3b8"
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            keyboardType={keyboardType}
                        />
                    </View>
                    {error && <Text style={styles.errorText}>{error.message}</Text>}
                </View>
            )}
        />
    );

    const FormContent = () => (
        <View style={styles.formContentContainer}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBarBackground}>
                    <LinearGradient
                        colors={['#06b6d4', '#10b981']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressBarFill, { width: '66%' }]}
                    />
                </View>
                <Text style={styles.stepText}>Step 2 of 3</Text>
            </View>

            <View style={styles.header}>
                <Text style={styles.title}>Contact Information</Text>
                <Text style={styles.subtitle}>
                    How can we reach you?
                </Text>
            </View>

            {/* Mobile Number */}
            <FormInput
                control={form.control}
                name="mobileNumber"
                placeholder="077 123 4567"
                icon="call-outline"
                keyboardType="phone-pad"
            />

            {/* Email Address */}
            <FormInput
                control={form.control}
                name="email"
                placeholder="john@example.com"
                icon="mail-outline"
                keyboardType="email-address"
            />

            {/* District Dropdown */}
            <Controller
                control={form.control}
                name="district"
                render={({ field: { onChange, value }, fieldState: { error } }) => (
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>District</Text>
                        <TouchableOpacity
                            style={[styles.inputWrapper, error && styles.inputError]}
                            onPress={() => setModalVisible(true)}
                        >
                            <Ionicons name="location-outline" size={20} color="#64748b" style={styles.inputIcon} />
                            <Text style={[styles.input, { paddingVertical: 14, color: value ? '#0f172a' : '#94a3b8' }]}>
                                {value || "Select your district"}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color="#64748b" />
                        </TouchableOpacity>
                        {error && <Text style={styles.errorText}>{error.message}</Text>}

                        {/* Selection Modal */}
                        <Modal visible={modalVisible} animationType="slide" transparent>
                            <View style={styles.modalOverlay}>
                                <View style={styles.modalContent}>
                                    <Text style={styles.modalTitle}>Select District</Text>
                                    <FlatList
                                        data={DISTRICTS}
                                        keyExtractor={(item) => item}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={styles.modalItem}
                                                onPress={() => {
                                                    onChange(item);
                                                    setModalVisible(false);
                                                }}
                                            >
                                                <Text style={styles.modalItemText}>{item}</Text>
                                                {value === item && <Ionicons name="checkmark" size={20} color="#06b6d4" />}
                                            </TouchableOpacity>
                                        )}
                                    />
                                    <TouchableOpacity style={styles.modalCloseButton} onPress={() => setModalVisible(false)}>
                                        <Text style={styles.modalCloseText}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>
                    </View>
                )}
            />

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#64748b" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.nextButton} onPress={form.handleSubmit(onSubmit)}>
                    <LinearGradient
                        colors={['#06b6d4', '#0891b2']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                    >
                        <Text style={styles.nextButtonText}>Next Step</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );

    // --- RENDER (Mobile vs Desktop) ---
    if (!isLargeScreen) {
        return (
            <View style={{ flex: 1 }}>
                <LinearGradient
                    colors={['#0f172a', '#0891b2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.mobileBackground}
                >
                    <SafeAreaView style={{ flex: 1 }}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                            <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
                                <View style={styles.mobileLogoContainer}>
                                    <Image source={logoSource} style={styles.mobileLogo} resizeMode="contain" />
                                </View>
                                <View style={styles.mobileCard}>
                                    <FormContent />
                                </View>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </LinearGradient>
            </View>
        );
    }

    // Desktop View
    return (
        <View style={styles.containerRow}>
            <SafeAreaView style={styles.formSection} edges={['top', 'bottom']}>
                <View style={styles.desktopLogoContainer}>
                    <Image source={logoSource} style={styles.desktopLogo} resizeMode="contain" />
                    <Text style={styles.desktopBrandName}>Care 101</Text>
                </View>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.formContainer}>
                        <FormContent />
                    </View>
                </ScrollView>
            </SafeAreaView>

            <View style={styles.heroSection}>
                <ImageBackground source={bgSource} style={styles.heroBackground} imageStyle={styles.heroImage}>
                    <LinearGradient
                        colors={['rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.9)', '#0f172a']}
                        style={styles.heroGradient}
                    >
                        <View style={styles.heroContent}>
                            <View style={styles.badge}>
                                <Ionicons name="person" size={16} color="#67e8f9" style={{ marginRight: 8 }} />
                                <Text style={styles.badgeText}>Patient Portal</Text>
                            </View>
                            <Text style={styles.heroTitle}>Stay Connected.</Text>
                            <Text style={styles.heroDescription}>
                                Receive updates about your appointments and health status instantly.
                            </Text>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    // --- Mobile Specific ---
    mobileBackground: { flex: 1 },
    mobileLogoContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30, height: 160 },
    mobileLogo: { width: 120, height: 120, marginBottom: 10 },
    mobileCard: {
        flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30,
        paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
    },

    // --- Desktop Specific ---
    containerRow: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },
    desktopLogoContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingTop: 24 },
    desktopLogo: { width: 40, height: 40, marginRight: 10 },
    desktopBrandName: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
    formSection: { flex: 1, backgroundColor: '#fff' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 24 },
    formContainer: { maxWidth: 480, width: '100%', alignSelf: 'center' },

    // --- Shared Form Styles ---
    formContentContainer: { width: '100%' },
    header: { marginBottom: 24 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', lineHeight: 22 },

    // Progress Bar
    progressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, justifyContent: 'space-between' },
    progressBarBackground: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginRight: 12 },
    progressBarFill: { height: '100%', borderRadius: 3 },
    stepText: { fontSize: 12, fontWeight: '600', color: '#0891b2' },

    // Inputs
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, height: 50,
    },
    inputError: { borderColor: '#ef4444' },
    errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 16, color: '#0f172a', height: '100%' },

    // Buttons
    buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    backButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600', marginLeft: 4 },
    nextButton: { borderRadius: 8, overflow: 'hidden', shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    gradientButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 24 },
    nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 8 },

    // --- Hero Section (Desktop) ---
    heroSection: { flex: 1.2, backgroundColor: '#0f172a' },
    heroBackground: { flex: 1, width: '100%', height: '100%' },
    heroImage: { opacity: 0.6 },
    heroGradient: { flex: 1, justifyContent: 'flex-end', padding: 48 },
    heroContent: { maxWidth: 512 },
    badge: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        backgroundColor: 'rgba(6, 182, 212, 0.15)', borderWidth: 1, borderColor: 'rgba(6, 182, 212, 0.3)',
        borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 24,
    },
    badgeText: { color: '#67e8f9', fontSize: 14, fontWeight: '600' },
    heroTitle: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 16, lineHeight: 44 },
    heroDescription: { fontSize: 18, color: '#cbd5e1', lineHeight: 28, marginBottom: 32 },

    // --- Modal Styles ---
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 20, maxHeight: '80%' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#0f172a', textAlign: 'center' },
    modalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between' },
    modalItemText: { fontSize: 16, color: '#334155' },
    modalCloseButton: { marginTop: 16, alignItems: 'center', padding: 12 },
    modalCloseText: { color: '#ef4444', fontWeight: '600', fontSize: 16 },
});
