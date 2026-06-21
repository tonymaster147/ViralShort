import React, { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { fetchNotifications, markAllNotificationsRead } from '../api/social';
import { useSocket } from '../context/SocketContext';
import { colors } from '../theme/colors';

// Icon + tint per notification type.
const META = {
  like:    { icon: 'heart',            color: colors.primary },
  comment: { icon: 'chatbubble',       color: colors.accent },
  follow:  { icon: 'person-add',       color: '#4caf50' },
  gift:    { icon: 'diamond',          color: colors.diamond },
  system:  { icon: 'trophy',           color: colors.coin },
};
function verb(type) {
  return type === 'like' ? 'liked your video'
    : type === 'comment' ? 'commented on your video'
    : type === 'follow' ? 'started following you'
    : type === 'gift' ? 'sent you diamonds'
    : 'sent you a notification';
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsScreen({ navigation }) {
  const { clearNotificationBadge, on } = useSocket();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await fetchNotifications()); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const off = on('notification:new', () => load());
      return off;
    }, [load])
  );

  const onMarkAll = async () => {
    // optimistic: clear unread flags locally
    setItems((arr) => arr.map((n) => ({ ...n, isRead: true })));
    clearNotificationBadge();
    try { await markAllNotificationsRead(); } catch (_) {}
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={onMarkAll} style={{ paddingHorizontal: 14 }}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, items]);

  const unreadCount = items.filter((n) => !n.isRead).length;

  const renderItem = ({ item }) => {
    const actor = item.actor;
    const meta = META[item.type] || META.system;
    const initial = (actor?.displayName || actor?.username || '?').charAt(0).toUpperCase();
    return (
      <TouchableOpacity
        style={[styles.row, !item.isRead && styles.rowUnread]}
        onPress={() => {
          if (item.videoId) navigation.navigate('Video', { videoId: item.videoId });
          else if (actor) navigation.navigate('UserProfile', { userId: actor.id });
        }}
      >
        <View style={styles.avatarWrap}>
          {actor?.avatar ? (
            <Image source={{ uri: actor.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avInit}>{initial}</Text></View>
          )}
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={11} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.text}>
            <Text style={styles.name}>{actor ? actor.displayName || actor.username : 'ViralShort'}</Text>{' '}
            {item.message || verb(item.type)}
          </Text>
          <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.isRead && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(n) => String(n.id)}
      renderItem={renderItem}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
      ListHeaderComponent={
        unreadCount > 0 ? <Text style={styles.header}>{unreadCount} new</Text> : null
      }
      contentContainerStyle={{ paddingVertical: 8 }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="notifications-outline" size={56} color={colors.textMuted} />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySub}>Likes, comments, follows and diamonds will show up here.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  markAll: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  header: { color: colors.textMuted, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 6, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  rowUnread: { backgroundColor: 'rgba(254,44,85,0.06)' },
  avatarWrap: { width: 48, height: 48 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avInit: { color: colors.text, fontWeight: '800', fontSize: 18 },
  badge: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  text: { color: colors.text, fontSize: 14, lineHeight: 19 },
  name: { fontWeight: '800' },
  time: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  empty: { alignItems: 'center', marginTop: 90, paddingHorizontal: 40 },
  emptyText: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 14 },
  emptySub: { color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
