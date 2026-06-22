import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, Dimensions, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import VideoCard from '../components/VideoCard';
import CommentsSheet from '../components/CommentsSheet';
import { Loading, EmptyState } from '../components/StateViews';
import { fetchFeed, fetchFollowingFeed } from '../api/videos';
import { useTheme } from '../theme/ThemeContext';

const { height: SCREEN_H } = Dimensions.get('window');

export default function FeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Each page = full screen minus the bottom tab bar (~50) + safe area.
  const ITEM_HEIGHT = SCREEN_H - 49 - insets.bottom;

  const [tab, setTab] = useState('foryou'); // foryou | following
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);
  const [commentsFor, setCommentsFor] = useState(null);   // video object
  const commentCountSetterRef = useRef(null);

  const load = useCallback(async (which) => {
    setLoading(true);
    try {
      const data = which === 'following' ? await fetchFollowingFeed(1) : await fetchFeed(1);
      setVideos(data);
      setActiveIndex(0);
    } catch (_) {
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  // Pause all videos when the feed tab loses focus.
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(tab);
    setRefreshing(false);
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const openComments = (video, setCount) => {
    commentCountSetterRef.current = setCount;
    setCommentsFor(video);
  };

  const renderItem = ({ item, index }) => (
    <VideoCard
      video={item}
      active={screenFocused && !commentsFor && index === activeIndex}
      height={ITEM_HEIGHT}
      onOpenComments={openComments}
      onUserPress={(userId) => navigation.navigate('UserProfile', { userId })}
    />
  );

  return (
    <View style={styles.container}>
      {/* Top tabs */}
      <View style={[styles.tabs, { top: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => setTab('following')}>
          <Text style={[styles.tab, tab === 'following' && styles.tabActive]}>Following</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('foryou')}>
          <Text style={[styles.tab, tab === 'foryou' && styles.tabActive]}>For You</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Loading />
      ) : videos.length === 0 ? (
        <EmptyState
          emoji="🎬"
          title={tab === 'following' ? 'Nothing here yet' : 'No videos yet'}
          subtitle={tab === 'following'
            ? 'Follow some creators to see their reels here.'
            : 'Be the first to post — tap ➕ Create!'}
          actionLabel={tab === 'foryou' ? 'Create a reel' : undefined}
          onAction={tab === 'foryou' ? () => navigation.getParent()?.navigate('Create') : undefined}
        />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => String(v.id)}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          // Preload + memory: keep only a few players alive, preload neighbours.
          windowSize={3}
          maxToRenderPerBatch={3}
          initialNumToRender={2}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
        />
      )}

      <CommentsSheet
        visible={!!commentsFor}
        videoId={commentsFor?.id}
        onClose={() => setCommentsFor(null)}
        onCountChange={(delta) => commentCountSetterRef.current?.((c) => c + delta)}
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabs: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', zIndex: 10, gap: 22 },
  tab: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  tabActive: { color: colors.text, textDecorationLine: 'underline' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 16 },
});
