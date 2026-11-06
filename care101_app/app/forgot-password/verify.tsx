import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import OtpInput, { type OtpInputHandle } from '../../components/OtpInput';
import KeyboardSafe from '../../components/KeyboardSafe';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

export default function VerifyOTPScreen() {
  const { email, maskedEmail } = useLocalSearchParams(); // identifier + masked email from the previous screen
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const otpRef = useRef<OtpInputHandle>(null);
  const verifyingRef = useRef(false);
  const router = useRouter();

  // Countdown before a new code can be requested
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const verify = async (code: string) => {
    if (code.length !== CODE_LENGTH || verifyingRef.current) return;
    verifyingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setVerified(true);
        // Let the success tick play, then continue
        setTimeout(() => {
          router.replace({ pathname: '/forgot-password/new-password', params: { email, otp: code } });
        }, 650);
      } else {
        setError(data.msg || data.message || 'That code is not right. Please try again.');
        otpRef.current?.shake();
        setOtp('');
        setTimeout(() => otpRef.current?.focus(), 250);
      }
    } catch {
      setError('Could not connect to the server. Check your connection and try again.');
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  const resend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOtp('');
        setResendIn(RESEND_SECONDS);
        otpRef.current?.focus();
      } else {
        setError(data.msg || data.message || 'Could not send a new code.');
      }
    } catch {
      setError('Could not connect to the server.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardSafe contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>

        <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 350 }}>
          <View style={styles.iconBadge}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color="#0891b2" />
          </View>
          <Text style={styles.title}>Enter the code</Text>
          <Text style={styles.subtitle}>
            We sent a {CODE_LENGTH}-digit code by SMS{maskedEmail ? ` and to ${maskedEmail}` : ''}. It fills in automatically when the message arrives.
          </Text>
        </MotiView>

        <OtpInput
          ref={otpRef}
          value={otp}
          length={CODE_LENGTH}
          onChange={(code) => {
            setOtp(code);
            if (error) setError('');
          }}
          onComplete={verify}
          error={!!error}
          disabled={loading || verified}
        />

        <View style={styles.statusArea}>
          <AnimatePresence exitBeforeEnter>
            {verified ? (
              <MotiView key="ok" from={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12 }} style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                <Text style={[styles.statusText, { color: '#16a34a' }]}>Code verified</Text>
              </MotiView>
            ) : loading ? (
              <MotiView key="loading" from={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={styles.statusRow}>
                <ActivityIndicator size="small" color="#06b6d4" />
                <Text style={styles.statusText}>Checking code…</Text>
              </MotiView>
            ) : error ? (
              <MotiView key="err" from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0 }} style={styles.statusRow}>
                <Ionicons name="alert-circle" size={18} color="#dc2626" />
                <Text style={[styles.statusText, { color: '#dc2626' }]}>{error}</Text>
              </MotiView>
            ) : null}
          </AnimatePresence>
        </View>

        <TouchableOpacity
          style={[styles.button, (otp.length !== CODE_LENGTH || loading || verified) && styles.buttonDisabled]}
          onPress={() => verify(otp)}
          disabled={otp.length !== CODE_LENGTH || loading || verified}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Verify code</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={resend} disabled={resendIn > 0 || resending} style={styles.resend} accessibilityRole="button">
          <Text style={[styles.resendText, (resendIn > 0 || resending) && { color: '#94a3b8' }]}>
            {resending ? 'Sending…' : resendIn > 0 ? `Resend code in ${resendIn}s` : "Didn't get it? Resend code"}
          </Text>
        </TouchableOpacity>
      </KeyboardSafe>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  backButton: { marginBottom: 20, alignSelf: 'flex-start', padding: 4 },
  iconBadge: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#ecfeff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#64748b', marginBottom: 28, lineHeight: 22 },
  statusArea: { minHeight: 44, justifyContent: 'center', marginTop: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, color: '#475569', flexShrink: 1 },
  button: { backgroundColor: '#06b6d4', height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resend: { alignItems: 'center', paddingVertical: 18 },
  resendText: { color: '#0891b2', fontSize: 14, fontWeight: '600' },
});
