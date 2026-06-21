import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchWallet, fetchTransactions, fetchDailyStatus, claimDaily } from '../api/economy';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const REASON_LABEL = {
  signup_bonus: 'Welcome bonus', daily_login: 'Daily check-in', purchase: 'Purchase',
  gift_sent: 'Gift sent', gift_received: 'Gift received', contest_reward: 'Contest reward',
  like_reward: 'Like reward',
};

export default function WalletScreen({ navigation }) {
  const { refreshUser } = useAuth();
  const [wallet, setWallet] = useState({ coins: 0, diamonds: 0 });
  const [txns, setTxns] = useState([]);
  const [daily, setDaily] = useState({ canClaim: false, amount: 0 });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, t, d] = await Promise.all([fetchWallet(), fetchTransactions(), fetchDailyStatus()]);
      setWallet(w); setTxns(t); setDaily(d);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onClaim = async () => {
    setClaiming(true);
    try {
      const res = await claimDaily();
      setWallet({ coins: res.coins, diamonds: res.diamonds });
      setDaily({ canClaim: false, amount: daily.amount });
      await refreshUser();
      load();
      Alert.alert('Claimed! 🎉', `+${res.claimed} coins added.`);
    } catch (err) {
      Alert.alert('Oops', err.response?.data?.error || 'Could not claim');
    } finally { setClaiming(false); }
  };

  const Header = (
    <View>
      <View style={styles.balances}>
        <View style={styles.balCard}>
          <Text style={[styles.balValue, { color: colors.coin }]}>🪙 {wallet.coins}</Text>
          <Text style={styles.balLabel}>Coins</Text>
        </View>
        <View style={styles.balCard}>
          <Text style={[styles.balValue, { color: colors.diamond }]}>💎 {wallet.diamonds}</Text>
          <Text style={styles.balLabel}>Diamonds</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.claimBtn, !daily.canClaim && styles.claimDisabled]}
        onPress={onClaim}
        disabled={!daily.canClaim || claiming}
      >
        <Text style={styles.claimText}>
          {claiming ? 'Claiming…' : daily.canClaim ? `🎁 Claim daily +${daily.amount} coins` : '✅ Daily reward claimed'}
        </Text>
      </TouchableOpacity>

      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quick} onPress={() => navigation.navigate('BuyCoins')}>
          <Text style={styles.quickEmoji}>💳</Text><Text style={styles.quickLabel}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quick} onPress={() => navigation.navigate('Leaderboard')}>
          <Text style={styles.quickEmoji}>🏆</Text><Text style={styles.quickLabel}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quick} onPress={() => navigation.navigate('Contest')}>
          <Text style={styles.quickEmoji}>⚡</Text><Text style={styles.quickLabel}>Contest</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.section}>History</Text>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={txns}
      keyExtractor={(t) => String(t.id)}
      ListHeaderComponent={Header}
      ListEmptyComponent={<Text style={styles.empty}>No transactions yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.txn}>
          <Text style={styles.txnLabel}>{REASON_LABEL[item.reason] || item.reason}</Text>
          <Text style={[styles.txnAmount, { color: item.amount > 0 ? colors.success : colors.danger }]}>
            {item.amount > 0 ? '+' : ''}{item.amount} {item.currency === 'diamonds' ? '💎' : '🪙'}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  balances: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  balCard: { flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 22, alignItems: 'center' },
  balValue: { fontSize: 24, fontWeight: '800' },
  balLabel: { color: colors.textMuted, marginTop: 4 },
  claimBtn: { backgroundColor: colors.primary, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  claimDisabled: { backgroundColor: colors.card },
  claimText: { color: colors.text, fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  quick: { flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  quickEmoji: { fontSize: 26, marginBottom: 6 },
  quickLabel: { color: colors.text, fontWeight: '700', fontSize: 12 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  txn: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8 },
  txnLabel: { color: colors.text },
  txnAmount: { fontWeight: '800' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 20 },
});
