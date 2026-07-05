import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';

// Ensure this points to /api/auth in your .env
const API_URL = `${process.env.EXPO_PUBLIC_API_URL}/auth`;

interface AuthProps {
  user: any;
  token: string | null; // <--- ✅ ADDED: Expose token in interface
  isLoading: boolean;
  signIn: (identifier: string, pass: string) => Promise<void>;
  signUp: (userData: any) => Promise<void>;
  registerPatient: (userData: any) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthProps | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null); // <--- ✅ ADDED: State for token
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // 1. INITIAL SESSION CHECK
  useEffect(() => {
    const checkUser = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('token');
        const storedUserData = await SecureStore.getItemAsync('user_data');

        if (storedToken && storedUserData) {
          setToken(storedToken); // <--- ✅ Load token into state
          setUser(JSON.parse(storedUserData));
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
  const signIn = async (identifier: string, password: string) => {
    try {
      console.log(`Attempting login to: ${API_URL}/login`);

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Server returned non-JSON:", text);
        throw new Error("Cannot connect to server. Check your API URL.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.msg || 'Login failed');
      }

      // ✅ SUCCESS: Save Session & Redirect
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));

      setToken(data.token); // <--- ✅ Update token state
      setUser(data.user);

      // Navigate based on role
      if (data.user.role === 'patient') {
        router.replace('/patient-dashboard' as any);
      } else {
        router.replace('/dashboard');
      }

    } catch (error: any) {
      console.error("Login Error:", error);
      throw error;
    }
  };

  // 3. SIGN UP ACTION (Doctor)
  // Note: Does NOT auto-login because new doctor accounts require admin approval first.
  const signUp = async (userData: any) => {
    try {
      console.log(`Registering doctor at: ${API_URL}/register-doctor`);

      const response = await fetch(`${API_URL}/register-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.msg || 'Registration failed');
      }

      // Registration successful — caller will navigate to success screen.
      // Do NOT auto-login: account requires admin approval before first login.

    } catch (error: any) {
      console.error("Signup Error:", error);
      throw error;
    }
  };

  // 4. REGISTER PATIENT
  const registerPatient = async (userData: any) => {
    try {
      console.log(`Registering patient at: ${API_URL}/register-patient`);

      const response = await fetch(`${API_URL}/register-patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.msg || 'Registration failed');
      }

      // ✅ SUCCESS: Save Session & Redirect
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user_data', JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);

      router.replace('/patient-dashboard' as any);

    } catch (error: any) {
      console.error("Patient Signup Error:", error);
      throw error;
    }
  };

  // 5. SIGN OUT ACTION
  const signOut = async () => {
    try {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user_data');
      setUser(null);
      setToken(null); // <--- ✅ Clear token state
      router.replace('/');
    } catch (error) {
      console.error("Sign Out Error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, registerPatient, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}