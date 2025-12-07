import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store'; 
import { useRouter, useSegments } from 'expo-router';

// ⚠️ YOUR COMPUTER'S IP ADDRESS
const API_URL = 'http://192.168.8.100:5000/api/auth'; 

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

  useEffect(() => {
    // Check if user is logged in on app start
    const checkUser = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const userData = await SecureStore.getItemAsync('user_data');
        if (token && userData) {
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  // --- ACTIONS ---

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

      // 🚨 RESTRICTION: Block Patients from the App
      if (data.user.role !== 'doctor') {
        throw new Error("Access Denied. This app is for Doctors only.");
      }

      // ✅ Success: Save Data
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));
      
      setUser(data.user);
      router.replace('/dashboard/dashboard');

    } catch (error: any) {
      console.error("Login Error:", error);
      throw error; // Passes the error to the Login Screen to show the red Alert
    }
  };

  const signUp = async (userData: any) => {
    try {
      // Map frontend form fields to backend database names
      const payload = {
        name: userData.fullName,
        email: userData.email,
        password: userData.password,
        specialization: userData.specialization,
        // Detailed fields
        nic: userData.nicNumber,
        phone: userData.phoneNumber, // Map 'phoneNumber' -> 'phone'
        slmcReg: userData.slmcRegistrationNumber, // Map 'slmcRegistrationNumber' -> 'slmcReg'
        nameWithInitials: userData.nameWithInitials
      };

      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Registration failed');
      }

      // Auto login after signup
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));
      
      setUser(data.user);
      router.replace('/dashboard/dashboard');

    } catch (error: any) {
      console.error("Signup Error:", error);
      throw error;
    }
  };

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