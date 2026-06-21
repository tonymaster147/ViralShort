import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { fetchPacks, buyPack } from '../api/economy';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export default function BuyCoinsScreen({ navigation }) {
  const { refreshUser } = useAuth();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);

  useEffect(() => {
    fetchPacks().then(setPacks).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const onBuy = (pack) => {
    Alert.alert(
      'Confirm purchase',
      `Buy ${pack.name} for ${pack.priceLabel}?\n\n(This is a mock checkout — no real payment.)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy', onPress: async () => {
            setBuying(pack.id);
            try {
              const res = await buyPack(pack.id);
              await refreshUser();
              Alert.alert('Success! 🎉',
                `Added ${pack.coins ? pack.coins + ' 🪙 ' : ''}${pack.diamonds ? pack.diamonds + ' 💎' : ''}`.trim());
            } catch (err) {
              Alert.alert('Failed', err.response?.data?.error || 'Try again');
            } finally { setBuying(null); }
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={packs}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={<Text style={styles.note}>💡 Mock checkout for demo — plug in Razorpay/Google Play later.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.pack} onPress={() => onBuy(item)} disabled={buying === item.id}>
          <View style={{ flex: 1 }}>
            <Text style={styles.packName}>{item.name}</Text>
            <Text style={styles.packContents}>
              {item.coins > 0 ? `🪙 ${item.coins} coins` : ''}{item.coins > 0 && item.diamonds > 0 ? '  ·  ' : ''}
              {item.diamonds > 0 ? `💎 ${item.diamonds} diamonds` : ''}
            </Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{buying === item.id ? '…' : item.priceLabel}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  note: { color: colors.textMuted, marginBottom: 14, fontSize: 13 },
  pack: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 16, padding: 18, marginBottom: 12 },
  packName: { color: colors.text, fontWeight: '800', fontSize: 16 },
  packContents: { color: colors.textMuted, marginTop: 4 },
  priceTag: { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  priceText: { color: colors.text, fontWeight: '800' },
});
