import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function DoctorSignupSuccess() {
  const router = useRouter();
  const PRIMARY_COLOR = '#06B6D4';

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        easing: Easing.out(Easing.back(1)),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B']}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        {/* Header Logo */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/logo1.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>Care 101</Text>
        </View>

        <View style={styles.content}>
          {/* Animated Success Icon */}
          <View style={styles.iconContainer}>
            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
            <Animated.View style={[styles.iconCircle, { transform: [{ scale: scaleAnim }] }]}>
              <Ionicons name="checkmark-sharp" size={48} color="white" />
            </Animated.View>
          </View>

          {/* Text Content */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], width: '100%' }}>
            <Text style={styles.title}>Registration Received</Text>
            <Text style={styles.subtitle}>
              We've sent your request to the hospital administration for verification.
            </Text>

            {/* Steps / Info Card */}
            <View style={styles.glassCard}>
              <StepItem 
                icon="time-outline" 
                text="Current Status: " 
                highlight="Pending Approval" 
              />
              <View style={styles.divider} />
              <StepItem 
                icon="shield-checkmark-outline" 
                text="Our team will verify your medical credentials shortly." 
              />
              <View style={styles.divider} />
              <StepItem 
                icon="mail-outline" 
                text="You'll receive a notification once your account is active." 
              />
            </View>
          </Animated.View>
        </View>

        {/* Footer Actions */}
        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/login')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[PRIMARY_COLOR, '#0891B2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Return to Login</Text>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => router.replace('/')}
          >
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const StepItem = ({ icon, text, highlight }: { icon: any, text: string, highlight?: string }) => (
  <View style={styles.stepRow}>
    <View style={styles.stepIconContainer}>
      <Ionicons name={icon} size={20} color="#06B6D4" />
    </View>
    <Text style={styles.stepText}>
      {text}
      {highlight && <Text style={styles.highlightText}>{highlight}</Text>}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  logo: { width: 32, height: 32, marginRight: 10 },
  brandName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  pulseCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 35,
    paddingHorizontal: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stepIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  highlightText: {
    color: '#06B6D4',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 10,
  },
  footer: {
    paddingBottom: 20,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 15,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
});