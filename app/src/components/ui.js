import React, { useMemo } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function Field({ label, ...props }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

export function Button({ title, onPress, loading, disabled, variant = 'primary' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bg =
    variant === 'primary' ? colors.primary :
    variant === 'outline' ? 'transparent' : colors.card;
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.6 : 1 },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.border },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.buttonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  label: { color: colors.textMuted, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    borderRadius: 30,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  buttonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
