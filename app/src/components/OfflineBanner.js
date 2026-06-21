import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onClientEvent } from '../api/client';
import { colors } from '../theme/colors';

// Shows a brief banner when a request fails due to no network/server.
export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const off = onClientEvent('network', () => {
      setVisible(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setVisible(false), 4000);
    });
    return () => { off(); if (timer.current) clearTimeout(timer.current); };
  }, []);

  if (!visible) return null;
  return (
    <View style={[styles.banner, { top: insets.top }]}>
      <Text style={styles.text}>⚠️ Can't reach the server. Check Wi-Fi / backend.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 0, right: 0, backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: 14, zIndex: 999, alignItems: 'center' },
  text: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
