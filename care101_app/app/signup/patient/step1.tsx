import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, useWatch } from "react-hook-form";
import { z } from "zod";
import DateTimePicker from '@react-native-community/datetimepicker';

// --- VALIDATION SCHEMA ---
const formSchema = z.object({
    fullName: z.string().min(2, { message: "Full name is required." }),
    nicNumber: z.string()
        .min(10, { message: "NIC must be at least 10 characters." })
        .max(12, { message: "NIC cannot exceed 12 characters." }),
    gender: z.enum(["Male", "Female", "Other"], {
        errorMap: (issue) => {
            if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_type') {
                return { message: "Gender is required." };
            }
            return { message: "Invalid selection." };
        }
    }),
    dateOfBirth: z.date({
        required_error: "Date of birth is required.",
        invalid_type_error: "Please enter a valid date.",
    }),
});

type FormValues = z.infer<typeof formSchema>;

export default function PatientSignupStep1() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isLargeScreen = width >= 768;
    const [showDatePicker, setShowDatePicker] = useState(false);

    // --- ASSETS ---
    const logoSource = require('../../../assets/logo1.png');
    const bgSource = { uri: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=2070&auto=format&fit=crop' };

    // --- FORM SETUP ---
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            fullName: "",
            nicNumber: "",
        },
    });

    const watchedNic = useWatch({ control: form.control, name: 'nicNumber' });

    // --- AUTO-FILL LOGIC (SRI LANKAN NIC) ---
    useEffect(() => {
        if (!watchedNic) return;

        let year: number;
        let dayValue: number;
        let gender: "Male" | "Female" = "Male";

        // Old Format: 931234567V
        if (watchedNic.length === 10 && !isNaN(Number(watchedNic.substring(0, 9)))) {
            year = parseInt("19" + watchedNic.substring(0, 2));
            dayValue = parseInt(watchedNic.substring(2, 5));
        } 
        // New Format: 200012345678
        else if (watchedNic.length === 12 && !isNaN(Number(watchedNic))) {
            year = parseInt(watchedNic.substring(0, 4));
            dayValue = parseInt(watchedNic.substring(4, 7));
        } else {
            return; 
        }

        if (dayValue > 500) {
            gender = "Female";
            dayValue -= 500;
        }

        if (dayValue > 0 && dayValue <= 366) {
            const dob = new Date(year, 0); 
            dob.setDate(dayValue); 
            
            // Only update if value actually changed to prevent loops
            form.setValue('gender', gender, { shouldValidate: true });
            form.setValue('dateOfBirth', dob, { shouldValidate: true });
        }
    }, [watchedNic]);

    const onSubmit = (values: FormValues) => {
        const payload = {
            ...values,
            dateOfBirth: values.dateOfBirth.toISOString(),
        };
        router.push({
            pathname: "/signup/patient/step2",
            params: payload as any
        });
    };

    const FormContent = () => (
        <View style={styles.formContentContainer}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBarBackground}>
                    <LinearGradient
                        colors={['#06b6d4', '#10b981']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[styles.progressBarFill, { width: '33%' }]}
                    />
                </View>
                <Text style={styles.stepText}>Step 1 of 3</Text>
            </View>

            <View style={styles.header}>
                <Text style={styles.title}>Personal Details</Text>
                <Text style={styles.subtitle}>
                    Let's start with your basic information.
                    </Text>
            </View>

            {/* Full Name */}
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <Controller
                    control={form.control}
                    name="fullName"
                    render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                        <>
                            <View style={[styles.inputWrapper, error && styles.inputError]}>
                                <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="John Doe"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                />
                            </View>
                            {error && <Text style={styles.errorText}>{error.message}</Text>}
                        </>
                    )}
                />
            </View>

            {/* NIC Number */}
            <View style={styles.inputContainer}>
                <Text style={styles.label}>National ID (NIC)</Text>
                <Controller
                    control={form.control}
                    name="nicNumber"
                    render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                        <>
                            <View style={[styles.inputWrapper, error && styles.inputError]}>
                                <Ionicons name="card-outline" size={20} color="#64748b" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="National ID Number"
                                    onBlur={onBlur}
                                    onChangeText={onChange}
                                    value={value}
                                    autoCapitalize="characters"
                                />
                            </View>
                            {error && <Text style={styles.errorText}>{error.message}</Text>}
                        </>
                    )}
                />
            </View>

            {/* Gender Selection */}
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Gender</Text>
                <Controller
                    control={form.control}
                    name="gender"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <>
                            <View style={styles.genderRow}>
                                {['Male', 'Female', 'Other'].map((option) => (
                                    <TouchableOpacity
                                        key={option}
                                        style={[
                                            styles.genderOption,
                                            value === option && styles.genderOptionSelected,
                                            error && { borderColor: '#ef4444' }
                                        ]}
                                        onPress={() => onChange(option)}
                                    >
                                        <Text style={[styles.genderText, value === option && styles.genderTextSelected]}>
                                            {option}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {error && <Text style={styles.errorText}>{error.message}</Text>}
                        </>
                    )}
                />
            </View>

            {/* Date of Birth */}
            <View style={styles.inputContainer}>
                <Text style={styles.label}>Date of Birth</Text>
                <Controller
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field: { onChange, value }, fieldState: { error } }) => (
                        <>
                            <TouchableOpacity
                                style={[styles.inputWrapper, error && styles.inputError]}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Ionicons name="calendar-outline" size={20} color="#64748b" style={styles.inputIcon} />
                                <Text style={[styles.input, { paddingVertical: 14, color: value ? '#0f172a' : '#94a3b8' }]}>
                                    {value ? value.toLocaleDateString() : "Select Date"}
                                </Text>
                            </TouchableOpacity>
                            {error && <Text style={styles.errorText}>{error.message}</Text>}

                            {showDatePicker && (
                                <DateTimePicker
                                    value={value || new Date()}
                                    mode="date"
                                    display="default"
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(false);
                                        if (selectedDate) onChange(selectedDate);
                                    }}
                                    maximumDate={new Date()}
                                />
                            )}
                        </>
                    )}
                />
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#64748b" />
                    <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.nextButton} onPress={form.handleSubmit(onSubmit)}>
                    <LinearGradient
                        colors={['#06b6d4', '#0891b2']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                    >
                        <Text style={styles.nextButtonText}>Next Step</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );

    // --- RESPONSIVE LAYOUTS ---
    if (!isLargeScreen) {
        return (
            <View style={{ flex: 1 }}>
                <LinearGradient colors={['#0f172a', '#0891b2']} style={styles.mobileBackground}>
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

    return (
        <View style={styles.containerRow}>
            <SafeAreaView style={styles.formSection} edges={['top', 'bottom']}>
                <View style={styles.desktopLogoContainer}>
                    <Image source={logoSource} style={styles.desktopLogo} resizeMode="contain" />
                    <Text style={styles.desktopBrandName}>Care 101</Text>
                </View>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <View style={styles.formContainer}><FormContent /></View>
                </ScrollView>
            </SafeAreaView>

            <View style={styles.heroSection}>
                <ImageBackground source={bgSource} style={styles.heroBackground} imageStyle={styles.heroImage}>
                    <LinearGradient colors={['rgba(15, 23, 42, 0.4)', '#0f172a']} style={styles.heroGradient}>
                        <View style={styles.heroContent}>
                            <Text style={styles.heroTitle}>Your health, your hands.</Text>
                            <Text style={styles.heroDescription}>Securely manage your medical data and connect with specialists.</Text>
                        </View>
                    </LinearGradient>
                </ImageBackground>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    mobileBackground: { flex: 1 },
    mobileLogoContainer: { alignItems: 'center', justifyContent: 'center', height: 160 },
    mobileLogo: { width: 100, height: 100 },
    mobileCard: {
        flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30,
        paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40,
    },
    containerRow: { flex: 1, flexDirection: 'row', backgroundColor: '#fff' },
    desktopLogoContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 32, paddingTop: 24 },
    desktopLogo: { width: 40, height: 40, marginRight: 10 },
    desktopBrandName: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
    formSection: { flex: 1, backgroundColor: '#fff' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 24 },
    formContainer: { maxWidth: 450, width: '100%', alignSelf: 'center' },
    formContentContainer: { width: '100%' },
    header: { marginBottom: 24 },
    title: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
    subtitle: { fontSize: 15, color: '#64748b', lineHeight: 22 },
    progressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    progressBarBackground: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, marginRight: 12 },
    progressBarFill: { height: '100%', borderRadius: 3 },
    stepText: { fontSize: 12, fontWeight: '600', color: '#0891b2' },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6 },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc',
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, height: 50,
    },
    inputError: { borderColor: '#ef4444' },
    errorText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
    inputIcon: { marginRight: 10 },
    input: { flex: 1, fontSize: 16, color: '#0f172a' },
    genderRow: { flexDirection: 'row', justifyContent: 'space-between' },
    genderOption: {
        flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 8, backgroundColor: '#f8fafc', marginHorizontal: 4
    },
    genderOptionSelected: { borderColor: '#0891b2', backgroundColor: '#ecfeff' },
    genderText: { fontWeight: '600', color: '#64748b' },
    genderTextSelected: { color: '#0891b2' },
    buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: 10 },
    backButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600', marginLeft: 4 },
    nextButton: { borderRadius: 8, overflow: 'hidden' },
    gradientButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 24 },
    nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 8 },
    heroSection: { flex: 1.2, backgroundColor: '#0f172a' },
    heroBackground: { flex: 1 },
    heroImage: { opacity: 0.6 },
    heroGradient: { flex: 1, justifyContent: 'flex-end', padding: 48 },
    heroContent: { maxWidth: 512 },
    heroTitle: { fontSize: 36, fontWeight: '700', color: '#fff', marginBottom: 16 },
    heroDescription: { fontSize: 18, color: '#cbd5e1' },
});