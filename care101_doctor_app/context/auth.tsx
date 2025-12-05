import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store'; // Run: npx expo install expo-secure-store

type AuthType = {
  user: string | null;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthType>({
  user: null,
  isLoading: true,
  signIn: () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in when app opens
    const checkLogin = async () => {
      try {
        const token = await SecureStore.getItemAsync('user-token');
        if (token) {
          setUser(token);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    checkLogin();
  }, []);

  const signIn = async () => {
    // Call this function from your Login Screen when login succeeds
    setIsLoading(true);
    await SecureStore.setItemAsync('user-token', 'dummy-auth-token');
    setUser('dummy-auth-token');
    setIsLoading(false);
  };

  const signOut = async () => {
    setIsLoading(true);
    await SecureStore.deleteItemAsync('user-token');
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}