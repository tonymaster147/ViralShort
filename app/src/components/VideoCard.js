import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { colors } from '../theme/colors';
import { addView } from '../api/videos';
import { toggleLike, toggleFollow } from '../api/social';
import { useAuth } from '../context/AuthContext';
import { filterOverlay } from '../theme/filters';
import GiftSheet from './GiftSheet';

// One full-screen reel. `active` controls play/pause as the user swipes.
export default function VideoCard({ video, active, height, onOpenComments, onUserPress }) {
  const { user } = useAuth();
  const player = useVideoPlayer(video.videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  // Local social state (seeded from server, updated optimistically).
  const [liked, setLiked] = useState(!!video.liked);
  const [likeCount, setLikeCount] = useState(video.likeCount || 0);
  const [commentCount, setCommentCount] = useState(video.commentCount || 0);
  const [following, setFollowing] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  const isOwn = user?.id === video.user.id;

  useEffect(() => {
    if (active) {
      player.play();
      addView(video.id);
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [active]);

  const onLike = async () => {
    // optimistic
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      const res = await toggleLike(video.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
    } catch (_) {
      // revert on failure
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  const onFollow = async () => {
    const next = !following;
    setFollowing(next);
    try {
      const res = await toggleFollow(video.user.id);
      setFollowing(res.following);
    } catch (_) {
      setFollowing(!next);
    }
  };

  const initial = (video.user.displayName || video.user.username || '?').charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { height }]}>
      <TouchableOpacity
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={() => (isPlaying ? player.pause() : player.play())}
      >
        <VideoView
          style={StyleSheet.absoluteFill}
          player={player}
          contentFit="cover"
          nativeControls={false}
        />
        {video.filter ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filterOverlay(video.filter) }]} />
        ) : null}
      </TouchableOpacity>

      {/* Right action rail */}
      <View style={styles.rail}>
        <TouchableOpacity style={styles.action} onPress={onLike}>
          <Text style={styles.actionEmoji}>{liked ? '❤️' : '🤍'}</Text>
          <Text style={styles.actionLabel}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.action} onPress={() => onOpenComments?.(video, setCommentCount)}>
          <Text style={styles.actionEmoji}>💬</Text>
          <Text style={styles.actionLabel}>{commentCount}</Text>
        </TouchableOpacity>

        {!isOwn && (
          <TouchableOpacity style={styles.action} onPress={() => setGiftOpen(true)}>
            <Text style={styles.actionEmoji}>🎁</Text>
            <Text style={styles.actionLabel}>Gift</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.action}>
          <Text style={styles.actionEmoji}>↗️</Text>
          <Text style={styles.actionLabel}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={styles.bottom}>
        <View style={styles.userRow}>
          <TouchableOpacity style={styles.userTap} onPress={() => onUserPress?.(video.user.id)}>
            {video.user.avatar ? (
              <Image source={{ uri: video.user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <Text style={styles.username}>@{video.user.username}</Text>
          </TouchableOpacity>
          {!isOwn && (
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followingBtn]}
              onPress={onFollow}
            >
              <Text style={styles.followText}>{following ? 'Following' : 'Follow'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {video.caption ? <Text style={styles.caption}>{video.caption}</Text> : null}
        {video.soundTitle ? <Text style={styles.sound}>♪ {video.soundTitle}</Text> : null}
        <Text style={styles.views}>👁 {video.views} views</Text>
      </View>

      <GiftSheet
        visible={giftOpen}
        videoId={video.id}
        onClose={() => setGiftOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: colors.bg, justifyContent: 'flex-end' },
  rail: { position: 'absolute', right: 12, bottom: 120, alignItems: 'center' },
  action: { alignItems: 'center', marginBottom: 20 },
  actionEmoji: { fontSize: 30 },
  actionLabel: { color: colors.text, fontSize: 12, marginTop: 4, fontWeight: '600' },
  bottom: { padding: 16, paddingBottom: 90, paddingRight: 70 },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  userTap: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10, borderWidth: 1, borderColor: colors.text },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontWeight: '800' },
  username: { color: colors.text, fontWeight: '800', fontSize: 16 },
  followBtn: { marginLeft: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  followingBtn: { borderColor: colors.border },
  followText: { color: colors.text, fontWeight: '700', fontSize: 12 },
  caption: { color: colors.text, fontSize: 14, marginBottom: 6 },
  sound: { color: colors.text, fontSize: 12, marginBottom: 4 },
  views: { color: colors.textMuted, fontSize: 12 },
});
