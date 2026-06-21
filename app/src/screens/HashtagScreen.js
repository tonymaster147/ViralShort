import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import VideoGrid from '../components/VideoGrid';
import { fetchHashtagVideos } from '../api/discover';
import { colors } from '../theme/colors';

export default function HashtagScreen({ route, navigation }) {
  const { name } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: `#${name}` });
    (async () => {
      try {
        setData(await fetchHashtagVideos(name));
      } finally {
        setLoading(false);
      }
    })();
  }, [name]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.hashCircle}><Text style={styles.hash}>#</Text></View>
      <Text style={styles.title}>#{name}</Text>
      <Text style={styles.count}>{data?.hashtag.videoCount || 0} videos</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <VideoGrid
        videos={data?.videos || []}
        header={header}
        onPressVideo={(v) => navigation.navigate('Video', { videoId: v.id, video: v })}
        empty={<Text style={styles.empty}>No videos for this hashtag yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', paddingVertical: 24 },
  hashCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  hash: { color: colors.primary, fontSize: 36, fontWeight: '800' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  count: { color: colors.textMuted, marginTop: 4 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 30 },
});
