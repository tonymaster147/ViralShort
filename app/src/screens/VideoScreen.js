import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VideoCard from '../components/VideoCard';
import CommentsSheet from '../components/CommentsSheet';
import { fetchVideo } from '../api/discover';
import { colors } from '../theme/colors';

const { height: SCREEN_H } = Dimensions.get('window');

// Plays a single video full-screen (opened from a grid tile).
export default function VideoScreen({ route, navigation }) {
  const { videoId, video: passed } = route.params;
  const insets = useSafeAreaInsets();
  const [video, setVideo] = useState(passed || null);
  const [loading, setLoading] = useState(!passed);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const commentSetter = useRef(null);

  useEffect(() => {
    if (passed) return;
    (async () => {
      try {
        setVideo(await fetchVideo(videoId));
      } finally {
        setLoading(false);
      }
    })();
  }, [videoId]);

  if (loading || !video) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <VideoCard
        video={video}
        active={!commentsOpen}
        height={SCREEN_H}
        onOpenComments={(v, setCount) => { commentSetter.current = setCount; setCommentsOpen(true); }}
        onUserPress={(userId) => navigation.navigate('UserProfile', { userId })}
      />
      <CommentsSheet
        visible={commentsOpen}
        videoId={video.id}
        onClose={() => setCommentsOpen(false)}
        onCountChange={(d) => commentSetter.current?.((c) => c + d)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
