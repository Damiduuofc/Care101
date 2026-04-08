import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/auth';
import "../global.css";
import { PortalHost } from "@rn-primitives/portal";
import "../theme.css";
import { Platform, View, ActivityIndicator, LogBox } from 'react-native'; 
import * as NavigationBar from 'expo-navigation-bar';
import { StripeProvider } from '@stripe/stripe-react-native';

// ✅ Import your ChatProvider
import { ChatProvider } from '@/context/ChatContext';

// Suppress logs for a cleaner dev experience
LogBox.ignoreAllLogs();

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  const currentRoute: string = segments?.[0] || "index"; 

  // Navigation Bar styling for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const hideNav = async () => {
        try {
          await NavigationBar.setVisibilityAsync("hidden");
          await NavigationBar.setBehaviorAsync('overlay-swipe');
        } catch (e) {
          console.log("Nav Bar Error:", e);
        }
      };
      hideNav();
    }
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* ✅ ChatProvider wraps the Stack. 
          This ensures that even when the Dashboard re-renders 
          every 20 seconds, the chat state stays alive in this wrapper.
      */}
      <ChatProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" /> 
          <Stack.Screen name="login" />
          <Stack.Screen name="dashboard" />
          <Stack.Screen name="patient-dashboard" />
        </Stack>
      </ChatProvider>

      <PortalHost />
    </View>
  );
}

export default function RootLayout() {
  return (
    <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}>
      <AuthProvider>
        {/* ChatProvider is initialized inside RootLayoutNav above */}
        <RootLayoutNav />
      </AuthProvider>
    </StripeProvider>
  );
}
