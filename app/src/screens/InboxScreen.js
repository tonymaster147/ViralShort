import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { fetchConversations } from '../api/messages';
import { useSocket } from '../context/SocketContext';
import { colors } from '../theme/colors';

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function InboxScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { clearMessageBadge, on } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchConversations();
      setConversations(data);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      clearMessageBadge();
      // refresh list when a new message arrives while inbox is open
      const off = on('message:new', () => load());
      return off;
    }, [load])
  );

  const renderItem = ({ item }) => {
    const initial = (item.user.displayName || item.user.username || '?').charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('Chat', {
          conversationId: item.id, user: item.user,
        })}
      >
        {item.user.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avInit}>{initial}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.user.displayName || item.user.username}</Text>
          <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {item.lastMessage
              ? (item.lastMessage.fromMe ? 'You: ' : '') + item.lastMessage.text
              : 'Say hi 👋'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.time}>{timeAgo(item.lastMessage?.createdAt)}</Text>
          {item.unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread}</Text></View>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.title}>Messages</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>No conversations yet.{'\n'}Open someone's profile and tap Message.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avInit: { color: colors.text, fontWeight: '800', fontSize: 20 },
  name: { color: colors.text, fontWeight: '700', fontSize: 16 },
  preview: { color: colors.textMuted, marginTop: 3 },
  previewUnread: { color: colors.text, fontWeight: '700' },
  time: { color: colors.textMuted, fontSize: 11 },
  badge: { marginTop: 6, backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 15 },
});
