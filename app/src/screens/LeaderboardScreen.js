import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { fetchLeaderboard } from '../api/economy';
import { colors } from '../theme/colors';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen({ navigation }) {
  const [period, setPeriod] = useState('all');
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p) => {
    setLoading(true);
    try { setLeaders(await fetchLeaderboard(p)); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const renderItem = ({ item }) => {
    const initial = (item.displayName || item.username || '?').charAt(0).toUpperCase();
    return (
      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('UserProfile', { userId: item.id })}>
        <Text style={styles.rank}>{MEDAL[item.rank - 1] || `#${item.rank}`}</Text>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avInit}>{initial}</Text></View>
        )}
        <Text style={styles.name}>{item.displayName || item.username}</Text>
        <Text style={styles.score}>💎 {item.score}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setPeriod('all')} style={[styles.tab, period === 'all' && styles.tabActive]}>
          <Text style={[styles.tabText, period === 'all' && styles.tabTextActive]}>All-time</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPeriod('week')} style={[styles.tab, period === 'week' && styles.tabActive]}>
          <Text style={[styles.tabText, period === 'week' && styles.tabTextActive]}>This week</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={leaders}
          keyExtractor={(l) => String(l.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(period)} tintColor={colors.text} />}
          ListEmptyComponent={<Text style={styles.empty}>No diamonds earned yet. Send gifts to climb the board!</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabs: { flexDirection: 'row', gap: 10, padding: 16 },
  tab: { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700' },
  tabTextActive: { color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  rank: { color: colors.text, fontSize: 18, fontWeight: '800', width: 36, textAlign: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avInit: { color: colors.text, fontWeight: '800', fontSize: 18 },
  name: { flex: 1, color: colors.text, fontWeight: '700' },
  score: { color: colors.diamond, fontWeight: '800' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 30 },
});
