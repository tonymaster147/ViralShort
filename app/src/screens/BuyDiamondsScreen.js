import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchPacks, createDiamondOrder } from '../api/economy';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function BuyDiamondsScreen({ navigation }) {
  const { user } = useAuth();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    fetchPacks()
      .then((p) => active && setPacks(p))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []));

  const onBuy = async (pack) => {
    setStarting(pack.id);
    try {
      const order = await createDiamondOrder(pack.id);
      navigation.navigate('Checkout', {
        orderId: order.orderId,
        keyId: order.keyId,
        amount: order.amount,
        packName: pack.name,
        diamonds: pack.diamonds,
      });
    } catch (err) {
      Alert.alert('Could not start checkout', err.response?.data?.error || 'Please try again.');
    } finally {
      setStarting(null);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={packs}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={
        <View>
          <View style={styles.balCard}>
            <Text style={styles.balLabel}>Your balance</Text>
            <Text style={styles.balValue}>💎 {user?.diamonds ?? 0}</Text>
          </View>
          <Text style={styles.note}>Diamonds let you support creators. Pay securely with Razorpay (UPI, cards, netbanking).</Text>
        </View>
      }
      renderItem={({ item }) => {
        const best = item.diamonds >= 650;
        return (
          <TouchableOpacity style={[styles.pack, best && styles.packBest]} onPress={() => onBuy(item)} disabled={starting === item.id}>
            <View style={styles.diamondBadge}>
              <Text style={styles.diamondBadgeText}>💎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.packName}>{item.name}{best ? '  ⭐' : ''}</Text>
              <Text style={styles.packContents}>{item.diamonds} diamonds</Text>
            </View>
            <View style={styles.priceTag}>
              <Text style={styles.priceText}>{starting === item.id ? '…' : item.priceLabel}</Text>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  balCard: { backgroundColor: colors.card, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 12 },
  balLabel: { color: colors.textMuted, fontSize: 13 },
  balValue: { color: colors.diamond, fontSize: 28, fontWeight: '800', marginTop: 4 },
  note: { color: colors.textMuted, marginBottom: 14, fontSize: 13, lineHeight: 18 },
  pack: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, gap: 12 },
  packBest: { borderWidth: 1, borderColor: colors.diamond },
  diamondBadge: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  diamondBadgeText: { fontSize: 22 },
  packName: { color: colors.text, fontWeight: '800', fontSize: 16 },
  packContents: { color: colors.textMuted, marginTop: 2 },
  priceTag: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  priceText: { color: '#fff', fontWeight: '800' },
});
