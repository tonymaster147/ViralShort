import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchNotifications } from '../api/social';
import { useSocket } from '../context/SocketContext';
import { colors } from '../theme/colors';

const ICON = { like: '❤️', comment: '💬', follow: '👤', gift: '🎁', system: '🔔' };
function verb(type) {
  return type === 'like' ? 'liked your video'
    : type === 'comment' ? 'commented on your video'
    : type === 'follow' ? 'started following you'
    : type === 'gift' ? 'sent you a gift'
    : 'sent a notification';
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function NotificationsScreen({ navigation }) {
  const { clearNotificationBadge, on } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setItems(await fetchNotifications()); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      clearNotificationBadge();
      const off = on('notification:new', () => load());
      return off;
    }, [load])
  );

  const renderItem = ({ item }) => {
    const actor = item.actor;
    const initial = (actor?.displayName || actor?.username || '?').charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => {
          if (item.videoId) navigation.navigate('Video', { videoId: item.videoId });
          else if (actor) navigation.navigate('UserProfile', { userId: actor.id });
        }}
      >
        {actor?.avatar ? (
          <Image source={{ uri: actor.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avInit}>{initial}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>
            <Text style={styles.name}>{actor ? '@' + actor.username : 'Someone'}</Text>{' '}
            {item.message || verb(item.type)}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)} ago</Text>
        </View>
        <Text style={styles.icon}>{ICON[item.type] || '🔔'}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => String(n.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avInit: { color: colors.text, fontWeight: '800', fontSize: 18 },
  text: { color: colors.text, fontSize: 14 },
  name: { fontWeight: '800' },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  icon: { fontSize: 22 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyText: { color: colors.textMuted, fontSize: 15 },
});
