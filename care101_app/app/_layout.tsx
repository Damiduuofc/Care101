import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/auth';
import "../global.css";
import { PortalHost } from "@rn-primitives/portal";
import "../theme.css";
import { Platform, View, ActivityIndicator, Text, LogBox, Alert } from 'react-native'; 
import * as NavigationBar from 'expo-navigation-bar';

// ✅ This will suppress ALL development-time error popups (red/yellow boxes)
LogBox.ignoreAllLogs();

// ✅ (Optional) Un-comment below to also disable ALL Alert.alert() popups throughout the app
// Alert.alert = () => {}; 

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  // ✅ 1. DEFINE 'currentRoute' HERE (Safe Check)
  // We use optional chaining (?.) just in case segments is undefined
  const currentRoute: string = segments?.[0] || "index"; 

  // 2. Logic to Hide Ads
  const hideAdsOn = ['login', 'signup', 'dashboard', 'onboarding', '(auth)'];
  const showAds = !user && !hideAdsOn.includes(currentRoute);

  // EFFECT 1: Hide Navigation Bar (Android Only)
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

 

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" /> 
        <Stack.Screen name="login" />
        <Stack.Screen name="dashboard" />
      </Stack>
      
 

      <PortalHost />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}