import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert } from 'react-native';
import { sendDiamond } from '../api/economy';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const AMOUNTS = [1, 5, 10, 25, 50, 100];

export default function DiamondSheet({ visible, videoId, onClose, onSent }) {
  const { user, refreshUser } = useAuth();
  const [sending, setSending] = useState(false);

  const send = async (amount) => {
    if ((user?.diamonds || 0) < amount) {
      return Alert.alert('Not enough diamonds', `You have ${user?.diamonds ?? 0} 💎. Buy more in your Wallet.`);
    }
    setSending(true);
    try {
      const res = await sendDiamond(videoId, amount);
      await refreshUser();
      onSent?.(res);
      onClose();
      Alert.alert('Sent! 💎', `You sent ${amount} diamonds to this creator.`);
    } catch (err) {
      Alert.alert('Failed', err.response?.data?.error || 'Try again');
    } finally { setSending(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Send diamonds 💎</Text>
            <Text style={styles.balance}>You have 💎 {user?.diamonds ?? 0}</Text>
          </View>
          <Text style={styles.sub}>Support this creator — your diamonds go straight to them and count toward the leaderboard.</Text>
          <View style={styles.grid}>
            {AMOUNTS.map((a) => (
              <TouchableOpacity key={a} style={styles.amount} onPress={() => send(a)} disabled={sending}>
                <Text style={styles.amountText}>💎 {a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  balance: { color: colors.diamond, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  amount: { width: '30%', backgroundColor: colors.card, borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: colors.diamond },
  amountText: { color: colors.text, fontWeight: '800', fontSize: 16 },
});
