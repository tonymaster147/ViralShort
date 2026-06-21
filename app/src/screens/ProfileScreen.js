import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Button } from '../components/ui';
import { fetchUserVideos, deleteVideo } from '../api/videos';
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

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUser } = useAuth();
  const { on } = useSocket();
  const [videos, setVideos] = useState([]);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const vids = await fetchUserVideos(user.id);
      setVideos(vids);
      await refreshUser();
    } catch (_) {}
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      reload();
      // refresh when a just-uploaded reel finishes processing
      const off1 = on('video:ready', () => reload());
      const off2 = on('video:failed', () => reload());
      return () => { off1 && off1(); off2 && off2(); };
    }, [reload])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ paddingHorizontal: 14 }}>
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (!user) return null;

  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();

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
        <Stat value={user.followers} label="Followers" />
        <Stat value={user.following} label="Following" />
        <Stat value={user.videoCount} label="Videos" />
      </View>

      <TouchableOpacity style={styles.wallet} onPress={() => navigation.navigate('Wallet')}>
        <View style={styles.walletItem}>
          <Text style={[styles.walletValue, { color: colors.coin }]}>🪙 {user.coins}</Text>
          <Text style={styles.walletLabel}>Coins</Text>
        </View>
        <View style={styles.walletItem}>
          <Text style={[styles.walletValue, { color: colors.diamond }]}>💎 {user.diamonds}</Text>
          <Text style={styles.walletLabel}>Diamonds</Text>
        </View>
        <View style={styles.walletItem}>
          <Text style={[styles.walletValue, { color: colors.text, fontSize: 16 }]}>Wallet ›</Text>
          <Text style={styles.walletLabel}>Open</Text>
        </View>
      </TouchableOpacity>

      <Button title="Edit Profile" onPress={() => navigation.navigate('EditProfile')} variant="outline" />
      <View style={{ height: 12 }} />
      <Button title="Log Out" onPress={logout} variant="card" />

      <Text style={styles.gridTitle}>My Videos</Text>
      {videos.length > 0 && <Text style={styles.gridHint}>Long-press a video to delete</Text>}
    </View>
  );

  const onDelete = (item) => {
    Alert.alert('Delete video?', 'This permanently removes the reel.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteVideo(item.id);
            setVideos((vs) => vs.filter((v) => v.id !== item.id));
            await refreshUser();
          } catch (_) {
            Alert.alert('Failed', 'Could not delete video.');
          }
        },
      },
    ]);
  };

  const renderTile = ({ item }) => (
    <TouchableOpacity
      style={styles.tile}
      onPress={() => item.status === 'ready'
        ? navigation.navigate('Video', { videoId: item.id, video: item })
        : null}
      onLongPress={() => onDelete(item)}
    >
      {item.coverUrl || item.thumbUrl ? (
        <Image source={{ uri: item.coverUrl || item.thumbUrl }} style={styles.tileImg} />
      ) : (
        <View style={[styles.tileImg, styles.tileFallback]}>
          <Text style={styles.tilePlay}>▶</Text>
        </View>
      )}
      {item.status === 'processing' && (
        <View style={styles.tileOverlay}><Text style={styles.tileBadge}>Processing…</Text></View>
      )}
      {item.status === 'scheduled' && (
        <View style={styles.tileOverlay}><Text style={styles.tileBadge}>🗓️ Scheduled</Text></View>
      )}
      {item.status === 'failed' && (
        <View style={styles.tileOverlay}><Text style={[styles.tileBadge, { color: colors.danger }]}>Failed</Text></View>
      )}
      <Text style={styles.tileViews}>👁 {item.views}</Text>
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={styles.container}
      data={videos}
      keyExtractor={(v) => String(v.id)}
      numColumns={3}
      renderItem={renderTile}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        <Text style={styles.empty}>No videos yet. Tap ➕ to post your first reel!</Text>
      }
      columnWrapperStyle={{ gap: 3, paddingHorizontal: 3 }}
      contentContainerStyle={{ gap: 3, paddingBottom: 30 }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: 12 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: 40, fontWeight: '800' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  handle: { color: colors.textMuted, marginTop: 2 },
  bio: { color: colors.text, marginTop: 10, textAlign: 'center', paddingHorizontal: 20 },
  stats: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.card, borderRadius: 16, paddingVertical: 16, marginBottom: 14,
  },
  stat: { alignItems: 'center' },
  gridTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 4 },
  gridHint: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  tile: { width: TILE, height: TILE * 1.4, backgroundColor: colors.card, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  tileImg: { ...StyleSheet.absoluteFillObject, width: TILE, height: TILE * 1.4 },
  tileFallback: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tilePlay: { color: colors.textMuted, fontSize: 28 },
  tileViews: { color: colors.text, fontSize: 11, padding: 4, fontWeight: '600' },
  tileOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  tileBadge: { color: colors.text, fontWeight: '800', fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 30 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  wallet: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.card, borderRadius: 16, paddingVertical: 16, marginBottom: 20,
  },
  walletItem: { alignItems: 'center' },
  walletValue: { fontSize: 20, fontWeight: '800' },
  walletLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
