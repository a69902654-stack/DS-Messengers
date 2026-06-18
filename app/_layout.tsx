import { AuthProvider } from '@/context/auth-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="user-profile/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
