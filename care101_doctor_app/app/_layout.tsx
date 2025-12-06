import { Stack } from 'expo-router';
import { AuthProvider } from '../context/auth';
import "../global.css";
import { PortalHost } from "@rn-primitives/portal";
import "../theme.css";


export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* 'index' is our Onboarding/Ads screen */}
        <Stack.Screen name="index" /> 
        <Stack.Screen name="login" />
        <Stack.Screen name="dashboard" />
      </Stack>
            <PortalHost />

    </AuthProvider>
  );
}