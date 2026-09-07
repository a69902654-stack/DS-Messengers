import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ErrorUtils, Text, TouchableOpacity, View } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto'; // URL polyfill
import { ErrorBoundary } from '../components/error-boundary';
import { AuthProvider } from '../context/auth-context';
import { useInitialization } from '../hooks/use-initialization';

// Catch any synchronous errors during module evaluation
try {
  SplashScreen.preventAutoHideAsync().catch(() => {});
} catch (e) {
  console.error('Failed to prevent auto hide splash:', e);
}

// Global error handlers to catch crashes during startup
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('Global JS error handler:', error, isFatal);
  if (isFatal) {
    SplashScreen.hideAsync().catch(() => {});
  }
});

let hasReportedStartupError = false;

function reportStartupError(msg: string, err?: unknown) {
  if (hasReportedStartupError) return;
  hasReportedStartupError = true;
  console.error(`[STARTUP ERROR] ${msg}`, err);
}

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const { isInitialized } = useInitialization();

  useEffect(() => {
    async function prepare() {
      try {
        // Wait for initialization and minimum 1 second
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        try {
          setAppIsReady(true);
          await SplashScreen.hideAsync();
        } catch (e) {
          reportStartupError('Failed to hide splash screen', e);
          setAppIsReady(true);
        }
      }
    }

    prepare();
  }, []);

  if (!appIsReady || !isInitialized) {
    return null;
  }

  if (startupError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a', padding: 20 }}>
        <Text style={{ color: '#ff6b6b', textAlign: 'center' }}>خطا در راه‌اندازی 앱

        <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>{startupError}</Text>
        <TouchableOpacity style={{ marginTop: 20, backgroundColor: '#7c6af7', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }} onPress={() => { setStartupError(null); hasReportedStartupError = false; setAppIsReady(false); }}}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>تلاش مجدد</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
