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
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.replace('/dashboard');
    }, 2000);
  };

  // --- REUSABLE COMPONENTS ---

  // 1. Define the Logo Image source here so we can use it in both Mobile and Desktop
  //    I am using an online URL so it works immediately. 
  //    Later, download your logo to assets/logo.png and change this to: require('../assets/logo.png')
  const logoSource = { uri: 'https://cdn-icons-png.flaticon.com/512/3063/3063823.png' };
  
  // 2. Define Background Image source
  const bgSource = { uri: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80' };

  const FormContent = () => (
    <View style={styles.formContentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Enter your credentials to access your patient portal.
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email Address</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="name@example.com"
            placeholderTextColor="#94a3b8"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Password</Text>
          <TouchableOpacity>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.inputWrapper}>
          <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
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
        </View>
      </View>

      <TouchableOpacity
        style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <LinearGradient
          colors={['#06b6d4', '#0891b2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          <Text style={styles.loginButtonText}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Text>
          {!isLoading && <Ionicons name="arrow-forward" size={20} color="#fff" />}
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.signupContainer}>
        <Text style={styles.signupText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/signup')}>
          <Text style={styles.signupLink}>Sign up </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ---------------- MOBILE VIEW ----------------
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
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView 
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.mobileLogoContainer}>
                  {/* Using the variable defined above */}
                  <Image 
                    source={logoSource} 
                    style={styles.mobileLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.brandName}>MediConnect</Text>
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

  // ---------------- DESKTOP/TABLET VIEW ----------------
  return (
    <View style={styles.containerRow}>
      <SafeAreaView style={styles.formSection} edges={['top', 'bottom']}>
        <View style={styles.desktopLogoContainer}>
             {/* Using the variable defined above */}
             <Image 
                source={logoSource}
                style={styles.desktopLogo}
                resizeMode="contain"
             />
             <Text style={styles.desktopBrandName}>MediConnect</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formContainer}>
            <FormContent />
          </View>
        </ScrollView>
      </SafeAreaView>

      <View style={styles.heroSection}>
        {/* Using the variable defined above */}
        <ImageBackground
          source={bgSource} 
          style={styles.heroBackground}
          imageStyle={styles.heroImage}
        >
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.4)', 'rgba(15, 23, 42, 0.9)', '#0f172a']}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={16} color="#67e8f9" style={{marginRight: 8}} />
                <Text style={styles.badgeText}>Trusted Healthcare</Text>
              </View>
              <Text style={styles.heroTitle}>
                Manage your health with confidence.
              </Text>
              <Text style={styles.heroDescription}>
                Access your medical records, book appointments, and communicate with your doctors securely.
              </Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- Mobile Specific Styles ---
  mobileBackground: {
    flex: 1,
  },
  mobileLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    height: 200,
  },
  mobileLogo: {
    width: 80,
    height: 80,
    marginBottom: 10,
    tintColor: '#fff', 
  },
  brandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  mobileCard: {
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
  
  // --- Desktop Specific Styles ---
  containerRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  desktopLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  desktopLogo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  desktopBrandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },

  // --- Shared Form Styles ---
  formSection: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  formContainer: {
    maxWidth: 448,
    width: '100%',
    alignSelf: 'center',
  },
  formContentContainer: {
    width: '100%',
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06b6d4',
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
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    height: '100%',
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

  // --- Right Side (Desktop Hero) Styles ---
  heroSection: {
    flex: 1.2,
    backgroundColor: '#0f172a',
  },
  heroBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  heroImage: {
    opacity: 0.6,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 48,
  },
  heroContent: {
    maxWidth: 512,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 24,
  },
  badgeText: {
    color: '#67e8f9',
    fontSize: 14,
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
    lineHeight: 44,
  },
  heroDescription: {
    fontSize: 18,
    color: '#cbd5e1',
    lineHeight: 28,
    marginBottom: 32,
  },
});