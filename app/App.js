import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { SocketProvider } from './src/context/SocketContext';
import OfflineBanner from './src/components/OfflineBanner';
import RootNavigation from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SocketProvider>
          <StatusBar style="light" />
          <RootNavigation />
          <OfflineBanner />
        </SocketProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
