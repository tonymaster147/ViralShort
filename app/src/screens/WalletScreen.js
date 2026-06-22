import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchWallet, fetchTransactions, fetchDailyStatus, claimDaily } from '../api/economy';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const REASON_LABEL = {
  signup_bonus: 'Welcome bonus', daily_login: 'Daily check-in', purchase: 'Diamond purchase',
  gift_sent: 'Gift sent', gift_received: 'Gift received', contest_reward: 'Contest reward',
  diamond_sent: 'Diamonds sent', diamond_received: 'Diamonds received', like_reward: 'Like reward',
};

export default function WalletScreen({ navigation, route }) {
  const { refreshUser } = useAuth();
  const [wallet, setWallet] = useState({ diamonds: 0 });
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

  // Show the outcome of a Razorpay checkout when returning from the Checkout screen.
  useEffect(() => {
    const r = route.params?.paymentResult;
    if (!r) return;
    navigation.setParams({ paymentResult: undefined });
    if (r.status === 'success') {
      load(); refreshUser();
      Alert.alert('Payment successful 🎉', `${r.credited} 💎 added. New balance: ${r.diamonds} 💎`);
    } else if (r.status === 'cancelled') {
      // silent — user backed out
    } else if (r.status === 'verify_failed') {
      Alert.alert('Could not confirm payment', `${r.error}\n\nIf you were charged, your diamonds will appear shortly — pull to refresh.`);
    } else {
      Alert.alert('Payment failed', r.error || 'Please try again.');
    }
  }, [route.params?.paymentResult]);

  const onClaim = async () => {
    setClaiming(true);
    try {
      const res = await claimDaily();
      setWallet({ diamonds: res.diamonds });
      setDaily({ canClaim: false, amount: daily.amount });
      await refreshUser();
      load();
      Alert.alert('Claimed! 🎉', `+${res.claimed} 💎 added.`);
    } catch (err) {
      Alert.alert('Oops', err.response?.data?.error || 'Could not claim');
    } finally { setClaiming(false); }
  };

  const Header = (
    <View>
      <View style={styles.balCard}>
        <Text style={styles.balLabel}>Diamonds</Text>
        <Text style={styles.balValue}>💎 {wallet.diamonds}</Text>
      </View>

      <TouchableOpacity
        style={[styles.claimBtn, !daily.canClaim && styles.claimDisabled]}
        onPress={onClaim}
        disabled={!daily.canClaim || claiming}
      >
        <Text style={styles.claimText}>
          {claiming ? 'Claiming…' : daily.canClaim ? `🎁 Claim daily +${daily.amount} 💎` : '✅ Daily reward claimed'}
        </Text>
      </TouchableOpacity>

      <View style={styles.quickRow}>
        <TouchableOpacity style={styles.quickPrimary} onPress={() => navigation.navigate('BuyDiamonds')}>
          <Text style={styles.quickEmoji}>💎</Text><Text style={styles.quickLabelPrimary}>Buy diamonds</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.quickRow}>
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
            {item.amount > 0 ? '+' : ''}{item.amount} 💎
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  balCard: { backgroundColor: colors.card, borderRadius: 16, paddingVertical: 26, alignItems: 'center', marginBottom: 14 },
  balValue: { color: colors.diamond, fontSize: 32, fontWeight: '800', marginTop: 4 },
  balLabel: { color: colors.textMuted },
  claimBtn: { backgroundColor: colors.primary, borderRadius: 30, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  claimDisabled: { backgroundColor: colors.card },
  claimText: { color: '#fff', fontWeight: '800' },
  quickRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  quickPrimary: { flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.diamond },
  quick: { flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  quickEmoji: { fontSize: 26, marginBottom: 6 },
  quickLabel: { color: colors.text, fontWeight: '700', fontSize: 12 },
  quickLabelPrimary: { color: colors.diamond, fontWeight: '800', fontSize: 13 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8, marginTop: 8 },
  txn: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: 10, padding: 14, marginBottom: 8 },
  txnLabel: { color: colors.text },
  txnAmount: { fontWeight: '800' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 20 },
});
