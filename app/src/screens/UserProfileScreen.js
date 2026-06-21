import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, FlatList, TouchableOpacity, Dimensions, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { fetchUser, toggleFollow } from '../api/social';
import { fetchUserVideos } from '../api/videos';
import { openConversation } from '../api/messages';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const TILE = (width - 6) / 3;

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { user: me } = useAuth();
  const [user, setUser] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          const u = await fetchUser(userId);
          const v = await fetchUserVideos(userId);
          if (!alive) return;
          setUser(u);
          setFollowing(!!u.isFollowing);
          setFollowers(u.followers || 0);
          setVideos(v);
          navigation.setOptions({ title: '@' + u.username });
        } catch (_) {}
        finally { if (alive) setLoading(false); }
      })();
      return () => { alive = false; };
    }, [userId])
  );

  const onFollow = async () => {
    const next = !following;
    setFollowing(next);
    setFollowers((c) => c + (next ? 1 : -1));
    try {
      const res = await toggleFollow(userId);
      setFollowing(res.following);
      setFollowers(res.followers);
    } catch (_) {
      setFollowing(!next);
      setFollowers((c) => c + (next ? -1 : 1));
    }
  };

  const onMessage = async () => {
    try {
      const { conversationId, user: other } = await openConversation(userId);
      navigation.navigate('Chat', { conversationId, user: other });
    } catch (_) {}
  };

  if (loading || !user) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();
  const isMe = me?.id === user.id;

  const Header = (
    <View style={{ padding: 20 }}>
      <View style={styles.header}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <Text style={styles.name}>{user.displayName || user.username}</Text>
        <Text style={styles.handle}>@{user.username}</Text>
        {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
      </View>

      <View style={styles.stats}>
        <Stat value={followers} label="Followers" />
        <Stat value={user.following} label="Following" />
        <Stat value={user.videoCount} label="Videos" />
      </View>

      {!isMe && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followingBtn, { flex: 1 }]}
            onPress={onFollow}
          >
            <Text style={styles.followText}>{following ? 'Following' : 'Follow'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.messageBtn} onPress={onMessage}>
            <Text style={styles.followText}>Message</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.gridTitle}>Videos</Text>
    </View>
  );

  const renderTile = ({ item }) => (
    <View style={styles.tile}>
      {item.thumbUrl ? (
        <Image source={{ uri: item.thumbUrl }} style={styles.tileImg} />
      ) : (
        <View style={[styles.tileImg, styles.tileFallback]}><Text style={styles.tilePlay}>▶</Text></View>
      )}
      <Text style={styles.tileViews}>👁 {item.views}</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={videos}
      keyExtractor={(v) => String(v.id)}
      numColumns={3}
      renderItem={renderTile}
      ListHeaderComponent={Header}
      ListEmptyComponent={<Text style={styles.empty}>No videos yet.</Text>}
      columnWrapperStyle={{ gap: 3, paddingHorizontal: 3 }}
      contentContainerStyle={{ gap: 3, paddingBottom: 30 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: 40, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  handle: { color: colors.textMuted, marginTop: 2 },
  bio: { color: colors.text, marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.card, borderRadius: 16, paddingVertical: 16, marginBottom: 14 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  followBtn: { backgroundColor: colors.primary, borderRadius: 30, paddingVertical: 12, alignItems: 'center' },
  followingBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  messageBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 30, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  followText: { color: colors.text, fontWeight: '800' },
  gridTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 6 },
  tile: { width: TILE, height: TILE * 1.4, backgroundColor: colors.card, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  tileImg: { ...StyleSheet.absoluteFillObject, width: TILE, height: TILE * 1.4 },
  tileFallback: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tilePlay: { color: colors.textMuted, fontSize: 28 },
  tileViews: { color: colors.text, fontSize: 11, padding: 4, fontWeight: '600' },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 30 },
});
