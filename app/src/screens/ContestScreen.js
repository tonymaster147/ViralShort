import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchContest } from '../api/economy';
import { colors } from '../theme/colors';

const MEDAL = ['🥇', '🥈', '🥉'];

function timeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return 'Ending soon';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return `${d}d ${h}h left`;
}

export default function ContestScreen({ navigation }) {
  const [data, setData] = useState({ contest: null, entries: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setData(await fetchContest()); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const { contest, entries } = data;

  const Header = (
    <View style={styles.banner}>
      <Text style={styles.trophy}>🏆</Text>
      <Text style={styles.title}>{contest ? contest.title : 'No active contest'}</Text>
      {contest && <Text style={styles.timer}>{timeLeft(contest.endsAt)}</Text>}
      <Text style={styles.prizes}>Prizes: 🥇 1000🪙+500💎 · 🥈 500🪙+200💎 · 🥉 250🪙+100💎</Text>
      <Text style={styles.rule}>Score = likes×3 + views + gift diamonds×5</Text>
    </View>
  );

  const renderItem = ({ item }) => {
    const initial = (item.user.displayName || item.user.username || '?').charAt(0).toUpperCase();
    return (
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Video', { videoId: item.videoId })}>
        <Text style={styles.rank}>{MEDAL[item.rank - 1] || `#${item.rank}`}</Text>
        {item.user.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avInit}>{initial}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>@{item.user.username}</Text>
          <Text style={styles.caption} numberOfLines={1}>{item.caption || 'No caption'}</Text>
        </View>
        <Text style={styles.score}>{item.score}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={entries}
      keyExtractor={(e) => String(e.videoId)}
      ListHeaderComponent={Header}
      renderItem={renderItem}
      ListEmptyComponent={<Text style={styles.empty}>No entries yet. Post a video to join!</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  banner: { backgroundColor: colors.card, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  trophy: { fontSize: 44 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 6 },
  timer: { color: colors.primary, fontWeight: '700', marginTop: 4 },
  prizes: { color: colors.textMuted, fontSize: 12, marginTop: 10, textAlign: 'center' },
  rule: { color: colors.textMuted, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  rank: { color: colors.text, fontSize: 16, fontWeight: '800', width: 34, textAlign: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avInit: { color: colors.text, fontWeight: '800' },
  name: { color: colors.text, fontWeight: '700' },
  caption: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  score: { color: colors.accent, fontWeight: '800', fontSize: 16 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 30 },
});
