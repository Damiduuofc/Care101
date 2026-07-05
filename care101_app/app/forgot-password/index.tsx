import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL; // Make sure this is set in your .env

export default function ForgotPasswordEmailScreen() {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendOTP = async () => {
    if (!identifier) return Alert.alert("Error", "Please enter your SLMC Number or Patient ID.");
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier.trim() }) // Send the identifier in the 'email' field for backend compatibility
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const maskedEmail = data.maskedEmail || "your registered email";
        const targetEmail = data.email || identifier.trim();

        // Navigate to the Verify screen and pass details
        router.push({
          pathname: '/forgot-password/verify',
          params: { email: targetEmail, maskedEmail }
        });
      } else {
        Alert.alert("Error", data.msg || "Something went wrong.");
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
      
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>Enter your SLMC Registration Number or Patient ID. We will send a 6-digit OTP code to the registered email address associated with your account.</Text>

      <View style={styles.inputWrapper}>
        <Ionicons name="person-outline" size={20} color="#64748b" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="SLMC Number or Patient ID"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSendOTP} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  backButton: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 30, lineHeight: 22 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, height: 50, marginBottom: 24 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0f172a' },
  button: { backgroundColor: '#06b6d4', height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});