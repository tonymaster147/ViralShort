import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import { UploadProvider } from './src/context/UploadContext';
import OfflineBanner from './src/components/OfflineBanner';
import UploadPill from './src/components/UploadPill';
import RootNavigation from './src/navigation';

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <UploadProvider>
              <ThemedStatusBar />
              <RootNavigation />
              <OfflineBanner />
              <UploadPill />
            </UploadProvider>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
