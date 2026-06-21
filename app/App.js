import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { checkHealth } from './src/api/client';
import { API_BASE_URL } from './src/api/config';
import { colors } from './src/theme/colors';

export default function App() {
  const [status, setStatus] = useState('loading'); // loading | connected | error
  const [info, setInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const runCheck = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const data = await checkHealth();
      setInfo(data);
      setStatus('connected');
    } catch (err) {
      setErrorMsg(err.message || 'Request failed');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <Text style={styles.logo}>
        Viral<Text style={{ color: colors.primary }}>Short</Text>
      </Text>
      <Text style={styles.tagline}>TikTok / Reels clone</Text>

      <View style={styles.statusBox}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.statusText}>Connecting to API…</Text>
          </>
        )}

        {status === 'connected' && (
          <>
            <Text style={styles.connected}>✅ Connected to ViralShort API</Text>
            <Text style={styles.detail}>app: {info?.app}</Text>
            <Text style={styles.detail}>server time: {info?.time}</Text>
          </>
        )}

        {status === 'error' && (
          <>
            <Text style={styles.failed}>❌ Could not reach API</Text>
            <Text style={styles.detail}>{errorMsg}</Text>
            <Text style={styles.hint}>
              Make sure the backend is running and your phone is on the same
              Wi-Fi. API: {API_BASE_URL}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.button} onPress={runCheck}>
        <Text style={styles.buttonText}>Retry</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Phase 0 — Foundation ✓</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: { fontSize: 40, fontWeight: '800', color: colors.text },
  tagline: { color: colors.textMuted, marginTop: 4, marginBottom: 32 },
  statusBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    minHeight: 150,
    justifyContent: 'center',
  },
  statusText: { color: colors.textMuted, marginTop: 12 },
  connected: { color: colors.success, fontSize: 18, fontWeight: '700' },
  failed: { color: colors.danger, fontSize: 18, fontWeight: '700' },
  detail: { color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  hint: { color: colors.textMuted, marginTop: 12, fontSize: 12, textAlign: 'center' },
  button: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  buttonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  footer: { color: colors.textMuted, marginTop: 40, fontSize: 12 },
});
