import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpload } from '../context/UploadContext';
import { useTheme } from '../theme/ThemeContext';

// Floating pill that shows background-upload progress / success / retry.
export default function UploadPill() {
  const insets = useSafeAreaInsets();
  const { status, progress, retry, dismiss } = useUpload();
  const { colors } = useTheme();

  if (status === 'idle') return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <View style={[styles.pill, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
        {status === 'uploading' && (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.text, { color: colors.text }]}>Uploading reel… {progress}%</Text>
          </>
        )}
        {status === 'done' && (
          <>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[styles.text, { color: colors.text }]}>Reel uploaded — processing…</Text>
          </>
        )}
        {status === 'failed' && (
          <>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[styles.text, { color: colors.text }]}>Upload failed</Text>
            <TouchableOpacity onPress={retry}><Text style={[styles.action, { color: colors.primary }]}>Retry</Text></TouchableOpacity>
            <TouchableOpacity onPress={dismiss}><Ionicons name="close" size={16} color={colors.textMuted} /></TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, maxWidth: '92%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  text: { fontWeight: '700', fontSize: 13 },
  action: { fontWeight: '800', fontSize: 13 },
});
