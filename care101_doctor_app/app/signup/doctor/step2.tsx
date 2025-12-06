// app/signup/doctor/step2.tsx
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
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import * as ImagePicker from "expo-image-picker";

// --- VALIDATION SCHEMA ---
const formSchema = z.object({
  nicNumber: z.string().min(1, { message: "NIC number is required." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(9, { message: "Valid phone number is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  slmcCertificate: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function DoctorSignupStep2() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // --- ASSETS ---
  const logoSource = require('../../../assets/logo1.png'); 
  const bgSource = { uri: 'https://images.unsplash.com/photo-1579684385136-4f899452c00d?q=80&w=2070&auto=format&fit=crop' }; // Different medical bg

  // --- STATE ---
  const [showPassword, setShowPassword] = useState(false);
  const [certificateUri, setCertificateUri] = useState<string | null>(null);

  // --- FORM SETUP ---
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nicNumber: "",
      email: "",
      phoneNumber: "",
      password: "",
      slmcCertificate: null,
    },
  });

  // --- HANDLERS ---
  const pickCertificate = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, // Professionals usually upload full docs
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setCertificateUri(uri);
      form.setValue("slmcCertificate", { uri });
    }
  };

  const removeCertificate = () => {
    setCertificateUri(null);
    form.setValue("slmcCertificate", null);
  };

  const onSubmit = (values: FormValues) => {
    console.log("Step 2 Data:", values);
    Alert.alert("Success", "Doctor account created successfully!", [
      { text: "OK", onPress: () => router.push("/dashboard") },
    ]);
  };

  // --- REUSABLE COMPONENTS ---
  const FormInput = ({ control, name, placeholder, icon, keyboardType = 'default', isPassword = false }: any) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>{name === 'nicNumber' ? 'National ID (NIC)' : name.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase())}</Text>
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
              secureTextEntry={isPassword && !showPassword}
              autoCapitalize="none"
            />
            {isPassword && (
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
          {error && <Text style={styles.errorText}>{error.message}</Text>}
        </View>
      )}
    />
  );

  // --- MAIN CONTENT ---
  const FormContent = () => (
    <View style={styles.formContentContainer}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <LinearGradient
            colors={['#06b6d4', '#10b981']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: '100%' }]} 
          />
        </View>
        <Text style={styles.stepText}>Step 2 of 2</Text>
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Account Details</Text>
        <Text style={styles.subtitle}>
          Secure your account with contact information and a strong password.
        </Text>
      </View>

      {/* Inputs */}
      <FormInput 
        control={form.control} 
        name="nicNumber" 
        placeholder="e.g. 199012345678" 
        icon="card-outline" 
      />

      <FormInput 
        control={form.control} 
        name="email" 
        placeholder="doctor@hospital.com" 
        icon="mail-outline" 
        keyboardType="email-address"
      />

      <FormInput 
        control={form.control} 
        name="phoneNumber" 
        placeholder="+94 77 123 4567" 
        icon="call-outline" 
        keyboardType="phone-pad"
      />

      <FormInput 
        control={form.control} 
        name="password" 
        placeholder="••••••••" 
        icon="lock-closed-outline" 
        isPassword={true}
      />

      {/* Certificate Upload */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>SLMC Certificate Photo</Text>
        <TouchableOpacity onPress={pickCertificate} style={styles.uploadBox}>
          {certificateUri ? (
            <View style={styles.uploadedContainer}>
              <Image source={{ uri: certificateUri }} style={styles.uploadedImage} resizeMode="cover" />
              <View style={styles.uploadOverlay}>
                <Text style={styles.changeText}>Tap to change</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="cloud-upload-outline" size={24} color="#06b6d4" />
              </View>
              <Text style={styles.uploadText}>Tap to upload photo</Text>
              <Text style={styles.uploadSubtext}>JPG or PNG (Max 5MB)</Text>
            </View>
          )}
        </TouchableOpacity>
        
        {certificateUri && (
          <TouchableOpacity onPress={removeCertificate} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" style={{marginRight: 4}} />
            <Text style={styles.removeText}>Remove file</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#64748b" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextButton} onPress={form.handleSubmit(onSubmit)}>
          <LinearGradient
            colors={['#10b981', '#059669']} // Green for completion
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.nextButtonText}>Complete Signup</Text>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
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
                <Ionicons name="shield-checkmark" size={16} color="#67e8f9" style={{ marginRight: 8 }} />
                <Text style={styles.badgeText}>Verified Professionals</Text>
              </View>
              <Text style={styles.heroTitle}>Your credentials, secured.</Text>
              <Text style={styles.heroDescription}>
                We prioritize the security of your professional data with enterprise-grade encryption and verification standards.
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
  mobileLogo: { width: 200, height: 200, marginBottom: 10 },
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
  stepText: { fontSize: 12, fontWeight: '600', color: '#10b981' },

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
  eyeButton: { padding: 8 },

  // Upload Styles
  uploadBox: {
    borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 12,
    backgroundColor: '#f1f5f9', overflow: 'hidden', minHeight: 120, justifyContent: 'center',
  },
  uploadPlaceholder: { alignItems: 'center', padding: 20 },
  uploadIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e0f2fe', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  uploadText: { fontSize: 14, fontWeight: '600', color: '#0891b2' },
  uploadSubtext: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  uploadedContainer: { width: '100%', height: 150 },
  uploadedImage: { width: '100%', height: '100%' },
  uploadOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8, alignItems: 'center',
  },
  changeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  removeButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 8 },
  removeText: { color: '#ef4444', fontSize: 13, fontWeight: '500' },

  // Buttons
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 },
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  backButtonText: { color: '#64748b', fontSize: 16, fontWeight: '600', marginLeft: 4 },
  nextButton: { borderRadius: 8, overflow: 'hidden', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  gradientButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', marginRight: 8 },


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
});