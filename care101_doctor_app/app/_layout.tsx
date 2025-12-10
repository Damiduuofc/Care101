import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/auth';
import "../global.css";
import { PortalHost } from "@rn-primitives/portal";
import "../theme.css";
import { Platform, View, ActivityIndicator, Text } from 'react-native'; 
import * as NavigationBar from 'expo-navigation-bar';

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

  // EFFECT 2: Traffic Controller
  useEffect(() => {
    if (isLoading) return; 

    // Check if we are on an auth-related route
    const inAuthGroup = segments?.[0] === 'login' || segments?.[0] === 'signup' || segments?.[0] === 'onboarding';

    // LOGIC:
    // If NOT logged in... AND not in auth group... AND not on login/signup pages...
    // -> Send to Login
    if (!user && !inAuthGroup && currentRoute !== 'index' && currentRoute !== 'login' && currentRoute !== 'signup') {
      router.replace('/' as any); 

    // If LOGGED IN... AND on a login/welcome page...
    // -> Send to Dashboard
    } else if (user && (currentRoute === 'index' || currentRoute === 'login')) {
      router.replace('/dashboard' as any); 
    }
  }, [user, isLoading, segments, currentRoute]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#12a9acff" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" /> 
        <Stack.Screen name="login" />
        <Stack.Screen name="dashboard" />
      </Stack>
      
      {/* GLOBAL ADS */}
      {showAds && (
        <View style={{ height: 60, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
            <Text style={{color: '#94a3b8', fontSize: 12, fontWeight: '600'}}>ADS WOULD APPEAR HERE</Text>
        </View>
      )}

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