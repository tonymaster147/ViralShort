import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Dimensions, RefreshControl,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import VideoCard from '../components/VideoCard';
import { fetchFeed, fetchFollowingFeed } from '../api/videos';
import { colors } from '../theme/colors';

const { height: SCREEN_H } = Dimensions.get('window');

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  // Each page = full screen minus the bottom tab bar (~50) + safe area.
  const ITEM_HEIGHT = SCREEN_H - 49 - insets.bottom;

  const [tab, setTab] = useState('foryou'); // foryou | following
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [screenFocused, setScreenFocused] = useState(true);

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

  const renderItem = ({ item, index }) => (
    <VideoCard
      video={item}
      active={screenFocused && index === activeIndex}
      height={ITEM_HEIGHT}
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
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyText}>
            {tab === 'following' ? 'No videos from people you follow yet.' : 'No videos yet — be the first to post!'}
          </Text>
        </View>
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tabs: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', zIndex: 10, gap: 22 },
  tab: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  tabActive: { color: colors.text, textDecorationLine: 'underline' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyEmoji: { fontSize: 50, marginBottom: 12 },
  emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 16 },
});
