import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Field, Button } from '../components/ui';
import { colors } from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [emailOrUsername, setId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (!emailOrUsername || !password) return setError('Please fill in all fields');
    setLoading(true);
    setError('');
    try {
      await login(emailOrUsername.trim(), password);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          Viral<Text style={{ color: colors.primary }}>Short</Text>
        </Text>
        <Text style={styles.subtitle}>Welcome back 👋</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Field
          label="Email or username"
          value={emailOrUsername}
          onChangeText={setId}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <Button title="Log In" onPress={onSubmit} loading={loading} />

        <Text style={styles.switch}>
          New here?{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Signup')}>
            Create an account
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 38, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginTop: 4, marginBottom: 28 },
  error: { color: colors.danger, marginBottom: 12, textAlign: 'center' },
  switch: { color: colors.textMuted, textAlign: 'center', marginTop: 22 },
  link: { color: colors.primary, fontWeight: '700' },
});
