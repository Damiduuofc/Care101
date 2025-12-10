import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store'; 
import { useRouter, useSegments } from 'expo-router';

// ⚠️ YOUR PHONE'S IP ADDRESS (Ensure this matches your computer's local IP)
const API_URL = 'http://192.168.8.101:5000/api/auth'; 

interface AuthProps {
  user: any;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (userData: any) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthProps>({} as AuthProps);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // 1. Check for stored session on app launch
  useEffect(() => {
    const checkUser = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const userData = await SecureStore.getItemAsync('user_data');
        if (token && userData) {
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        console.error("Session Check Error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  // 2. SIGN IN ACTION
  const signIn = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Login failed');
      }

      // 🚨 RESTRICTION: Block Patients from the Doctor App
      if (data.user.role !== 'doctor') {
        throw new Error("Access Denied. This app is for Doctors only.");
      }

      // ✅ Success: Save Data & Redirect
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));
      
      setUser(data.user);
router.replace('/dashboard/dashboard');

    } catch (error: any) {
      console.error("Login Error:", error);
      throw error; // Propagate error to the UI for alerts
    }
  };

  // 3. SIGN UP ACTION (Corrected for Doctors)
  const signUp = async (userData: any) => {
    try {
      // ✅ Map frontend fields to backend Doctor Model
      const payload = {
        name: userData.fullName, // Backend expects 'name'
        email: userData.email,
        password: userData.password,
        specialization: userData.specialization,
        mobileNumber: userData.phoneNumber, // Backend expects 'mobileNumber'
        qualifications: userData.slmcRegistrationNumber, // Using SLMC Reg as qualifications
      };

      // ✅ Use the DOCTOR registration endpoint
      const response = await fetch(`${API_URL}/register-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Registration failed');
      }

      // ✅ Auto-Login after successful registration
      // We call signIn immediately so the user doesn't have to type credentials again
      await signIn(userData.email, userData.password);

    } catch (error: any) {
      console.error("Signup Error:", error);
      throw error;
    }
  };

  // 4. SIGN OUT ACTION
  const signOut = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user_data');
    setUser(null);
    router.replace('/');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}