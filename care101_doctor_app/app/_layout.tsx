import { useEffect } from 'react'; // <--- Added this missing import
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/auth';
import "../global.css";
import { PortalHost } from "@rn-primitives/portal";
import "../theme.css";
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';


export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      // 2. Hide the Navigation Bar on Android
      NavigationBar.setVisibilityAsync("hidden");
      
      // Optional: This prevents it from popping up too easily
      NavigationBar.setBehaviorAsync('overlay-swipe'); 
    }
  }, []);
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" /> 
        <Stack.Screen name="login" />
        <Stack.Screen name="dashboard" />
      </Stack>
            <PortalHost />

    </AuthProvider>
  );
}