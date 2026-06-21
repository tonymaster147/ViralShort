import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { fetchGiftTypes, sendGift } from '../api/economy';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const GIFT_EMOJI = { Rose: '🌹', Heart: '❤️', Crown: '👑', Rocket: '🚀' };

export default function GiftSheet({ visible, videoId, onClose, onSent }) {
  const { user, refreshUser } = useAuth();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchGiftTypes().then(setGifts).catch(() => {}).finally(() => setLoading(false));
    }
  }, [visible]);

  const send = async (gift) => {
    if ((user?.coins || 0) < gift.coinCost) {
      return Alert.alert('Not enough coins', `You need ${gift.coinCost} 🪙. Buy more in your Wallet.`);
    }
    setSending(gift.id);
    try {
      const res = await sendGift(gift.id, videoId);
      await refreshUser();
      onSent?.(res);
      onClose();
      Alert.alert('Gift sent! 🎉', `You sent a ${gift.name}. Creator got ${gift.diamondValue} 💎`);
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Try again');
    } finally { setSending(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Send a gift</Text>
            <Text style={styles.balance}>🪙 {user?.coins ?? 0}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
          ) : (
            <FlatList
              data={gifts}
              keyExtractor={(g) => String(g.id)}
              numColumns={2}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ gap: 12, paddingBottom: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.gift} onPress={() => send(item)} disabled={sending === item.id}>
                  <Text style={styles.giftEmoji}>{GIFT_EMOJI[item.name] || '🎁'}</Text>
                  <Text style={styles.giftName}>{item.name}</Text>
                  <Text style={styles.giftCost}>🪙 {item.coinCost}</Text>
                  <Text style={styles.giftValue}>→ {item.diamondValue} 💎</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  balance: { color: colors.coin, fontWeight: '800' },
  gift: { flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  giftEmoji: { fontSize: 40 },
  giftName: { color: colors.text, fontWeight: '700', marginTop: 6 },
  giftCost: { color: colors.coin, marginTop: 4, fontWeight: '700' },
  giftValue: { color: colors.diamond, fontSize: 12, marginTop: 2 },
});
