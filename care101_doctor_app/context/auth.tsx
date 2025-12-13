import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store'; 
import { useRouter, useSegments } from 'expo-router';


const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/auth`;

interface AuthProps {
  user: any;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (userData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthProps | null>(null);

// ✅ SAFETY HOOK: Prevents usage outside the Provider
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // 1. INITIAL SESSION CHECK
  useEffect(() => {
    const checkUser = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const userData = await SecureStore.getItemAsync('user_data');
        
        if (token && userData) {
          setUser(JSON.parse(userData));
        }
      } catch (e) {
        console.error("Session Restoration Failed:", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkUser();
  }, []);

  // 2. SIGN IN ACTION
  const signIn = async (email: string, password: string) => {
    try {
      console.log(`Attempting login to: ${API_URL}/login`); 

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // 🚨 CRITICAL CHECK: Ensure response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Server returned non-JSON:", text);
        throw new Error("Cannot connect to server. Check your API URL.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Login failed');
      }

      // 🚨 RESTRICTION: Block Patients
      if (data.user.role !== 'doctor') {
        throw new Error("Access Denied. This app is for Doctors only.");
      }

      // ✅ SUCCESS: Save Session & Redirect
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));
      
      setUser(data.user);
      
      // ✅ FIX: Route to the dashboard folder, not the file inside it
      router.replace('/dashboard'); 

    } catch (error: any) {
      console.error("Login Error:", error);
      throw error; // Re-throw to be caught by the Login Screen UI
    }
  };

  // 3. SIGN UP ACTION
  const signUp = async (userData: any) => {
    try {
      console.log(`Registering doctor at: ${API_URL}/register-doctor`);

      // ✅ Map frontend fields to backend Schema
      const payload = {
        name: userData.fullName, 
        email: userData.email,
        password: userData.password,
        specialization: userData.specialization,
        mobileNumber: userData.phoneNumber, 
        qualifications: userData.slmcRegistrationNumber, 
      };

      const response = await fetch(`${API_URL}/register-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || 'Registration failed');
      }

      // ✅ AUTO-LOGIN: Log them in immediately after signup
      await signIn(userData.email, userData.password);

    } catch (error: any) {
      console.error("Signup Error:", error);
      throw error;
    }
  };

  // 4. SIGN OUT ACTION
  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user_data');
      setUser(null);
      router.replace('/');
    } catch (error) {
      console.error("Sign Out Error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}