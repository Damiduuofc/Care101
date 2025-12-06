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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// 1. Import Validation Libraries
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";

// 2. Define Validation Schema
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // Assets
  const logoSource = require('../assets/logo1.png');

  // 3. Setup Form Hook
  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // 4. Handle Submission
  const onLogin = async (data: LoginFormValues) => {
      console.log("Login Data:", data);
       router.replace("/dashboard/dashboard");
  };

  // 5. Reusable Input Component
  const FormInput = ({ name, placeholder, icon, isPassword = false, keyboardType = 'default' }: any) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>
            {name === 'email' ? 'Email Address' : 'Password'}
          </Text>
          
          <View style={[styles.inputWrapper, errors[name as keyof LoginFormValues] && styles.inputError]}>
            <Ionicons name={icon} size={20} color="#64748b" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              placeholderTextColor="#94a3b8"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              keyboardType={keyboardType}
              autoCapitalize="none"
              secureTextEntry={isPassword && !showPassword}
            />
            {isPassword && (
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Inline Error Message */}
          {errors[name as keyof LoginFormValues] && (
            <Text style={styles.errorText}>
              {errors[name as keyof LoginFormValues]?.message}
            </Text>
          )}
        </View>
      )}
    />
  );

  const FormContent = () => (
    <View style={styles.formContentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Enter your credentials to access your patient portal.
        </Text>
      </View>

      {/* Form Inputs */}
      <FormInput 
        name="email" 
        placeholder="name@example.com" 
        icon="mail-outline" 
        keyboardType="email-address" 
      />

      <FormInput 
        name="password" 
        placeholder="••••••••" 
        icon="lock-closed-outline" 
        isPassword={true} 
      />

      {/* Login Button */}
      <TouchableOpacity
        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
        onPress={handleSubmit(onLogin)}
        disabled={isLoading}
      >
        <LinearGradient
          colors={['#06b6d4', '#0891b2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          <Text style={styles.loginButtonText}>
            {isLoading ? 'Signing in...' : 'Log In'}
          </Text>
          {!isLoading && <Ionicons name="arrow-forward" size={20} color="#fff" />}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/signup/doctor/step1')}>
          <Text style={styles.signupLink}>Sign up </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ---------------- UNIFIED VIEW ----------------
  // This layout now applies to both Mobile and Desktop
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#0f172a', '#0891b2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.logoContainer}>
                <Image source={logoSource} style={styles.logo} resizeMode="contain" />
              </View>

              <View style={styles.card}>
                <FormContent />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- Main Layout Styles ---
  background: {
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    height: 200,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },

  // --- Form Content Styles ---
  formContentContainer: {
    width: '100%',
    maxWidth: 500, // Added maxWidth so it doesn't look too wide on giant screens
    alignSelf: 'center', // Center the form content on desktop
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 50,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    height: '100%',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  eyeButton: {
    padding: 8,
  },
  loginButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    paddingBottom: 20,
  },
  signupText: {
    fontSize: 14,
    color: '#475569',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06b6d4',
  },
});