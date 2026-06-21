import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui';
import { colors } from '../theme/colors';

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.header}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <Text style={styles.name}>{user.displayName || user.username}</Text>
        <Text style={styles.handle}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>

      <View style={styles.stats}>
        <Stat value={user.followers} label="Followers" />
        <Stat value={user.following} label="Following" />
        <Stat value={user.videoCount} label="Videos" />
      </View>

      <View style={styles.wallet}>
        <View style={styles.walletItem}>
          <Text style={[styles.walletValue, { color: colors.coin }]}>🪙 {user.coins}</Text>
          <Text style={styles.walletLabel}>Coins</Text>
        </View>
        <View style={styles.walletItem}>
          <Text style={[styles.walletValue, { color: colors.diamond }]}>💎 {user.diamonds}</Text>
          <Text style={styles.walletLabel}>Diamonds</Text>
        </View>
      </View>

      <Button title="Edit Profile" onPress={() => navigation.navigate('EditProfile')} variant="outline" />
      <View style={{ height: 12 }} />
      <Button title="Log Out" onPress={logout} variant="card" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: 40, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  handle: { color: colors.textMuted, marginTop: 2 },
  bio: { color: colors.text, marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  stats: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.card, borderRadius: 16, paddingVertical: 16, marginBottom: 14,
  },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  wallet: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.card, borderRadius: 16, paddingVertical: 16, marginBottom: 20,
  },
  walletItem: { alignItems: 'center' },
  walletValue: { fontSize: 20, fontWeight: '800' },
  walletLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
