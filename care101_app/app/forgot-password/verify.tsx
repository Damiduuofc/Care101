import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function VerifyOTPScreen() {
  const { email } = useLocalSearchParams(); // Get email passed from previous screen
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleVerify = async () => {
    if (otp.length !== 6) return Alert.alert("Error", "Please enter a valid 6-digit OTP.");
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Navigate to the final screen, passing both email and the verified OTP
        router.push({
          pathname: '/forgot-password/new-password',
          params: { email, otp }
        });
      } else {
        Alert.alert("Error", data.msg);
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#0f172a" />
      </TouchableOpacity>
      
      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {email}.</Text>

      <View style={styles.inputWrapper}>
        <Ionicons name="keypad-outline" size={20} color="#64748b" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="000000"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Code</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ... Use the exact same styles object as Step 1 ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  backButton: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 30, lineHeight: 22 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, height: 50, marginBottom: 24 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0f172a', letterSpacing: 5 },
  button: { backgroundColor: '#06b6d4', height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});