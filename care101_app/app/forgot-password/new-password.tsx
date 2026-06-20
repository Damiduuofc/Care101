import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function NewPasswordScreen() {
  const { email, otp } = useLocalSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleReset = async () => {
    if (newPassword.length < 6) return Alert.alert("Error", "Password must be at least 6 characters.");
    if (newPassword !== confirmPassword) return Alert.alert("Error", "Passwords do not match.");
    
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        Alert.alert("Success!", "Your password has been changed. Please log in.", [
          { text: "OK", onPress: () => router.replace('/') } // Go back to login screen
        ]);
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
      <Text style={styles.title}>New Password</Text>
      <Text style={styles.subtitle}>Create a strong new password for your account.</Text>

      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
      </View>

      <View style={styles.inputWrapper}>
        <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Change Password</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ... Use the exact same styles object as Step 1 ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a', marginBottom: 10, marginTop: 20 },
  subtitle: { fontSize: 16, color: '#64748b', marginBottom: 30, lineHeight: 22 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 12, height: 50, marginBottom: 16 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0f172a' },
  button: { backgroundColor: '#06b6d4', height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});