import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export function Loading({ label }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? <Text style={styles.muted}>{label}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.muted}>{message || 'Please try again.'}</Text>
      {onRetry ? (
        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function EmptyState({ emoji = '📭', title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>{emoji}</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: 'transparent' },
  emoji: { fontSize: 48, marginBottom: 12 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  muted: { color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  btn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 30, paddingVertical: 12, paddingHorizontal: 30 },
  btnText: { color: colors.text, fontWeight: '800' },
});
