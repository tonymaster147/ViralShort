import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { colors } from '../theme/colors';
import { addView } from '../api/videos';

const { height: SCREEN_H } = Dimensions.get('window');

// One full-screen reel. `active` controls play/pause as the user swipes.
export default function VideoCard({ video, active, height, onOpenComments }) {
  const player = useVideoPlayer(video.videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    if (active) {
      player.play();
      addView(video.id);
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [active]);

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
      </TouchableOpacity>

      {/* Right action rail */}
      <View style={styles.rail}>
        <Action emoji="❤️" label={video.likeCount} />
        <Action emoji="💬" label={video.commentCount} onPress={onOpenComments} />
        <Action emoji="🎁" label="Gift" />
        <Action emoji="↗️" label="Share" />
      </View>

      {/* Bottom info */}
      <View style={styles.bottom}>
        <View style={styles.userRow}>
          {video.user.avatar ? (
            <Image source={{ uri: video.user.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <Text style={styles.username}>@{video.user.username}</Text>
        </View>
        {video.caption ? <Text style={styles.caption}>{video.caption}</Text> : null}
        <Text style={styles.views}>👁 {video.views} views</Text>
      </View>
    </View>
  );
}

function Action({ emoji, label, onPress }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} disabled={!onPress}>
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
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
  avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 10, borderWidth: 1, borderColor: colors.text },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontWeight: '800' },
  username: { color: colors.text, fontWeight: '800', fontSize: 16 },
  caption: { color: colors.text, fontSize: 14, marginBottom: 6 },
  views: { color: colors.textMuted, fontSize: 12 },
});
