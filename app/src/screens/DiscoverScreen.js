import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { search as searchApi, fetchTrending, fetchTrendingHashtags } from '../api/discover';
import { GridTile } from '../components/VideoGrid';
import { colors } from '../theme/colors';

function UserRow({ user, onPress }) {
  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();
  return (
    <TouchableOpacity style={styles.userRow} onPress={onPress}>
      {user.avatar ? (
        <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.avatarFallback]}><Text style={styles.avInit}>{initial}</Text></View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.userName}>{user.displayName || user.username}</Text>
        <Text style={styles.userHandle}>@{user.username} · {user.followers} followers</Text>
      </View>
    </TouchableOpacity>
  );
}

function HashtagRow({ tag, onPress }) {
  return (
    <TouchableOpacity style={styles.tagRow} onPress={onPress}>
      <View style={styles.tagIcon}><Text style={styles.tagHash}>#</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tagName}>#{tag.name}</Text>
        <Text style={styles.tagCount}>{tag.videoCount} videos</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function DiscoverScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('videos'); // videos | users | hashtags
  const [results, setResults] = useState({ users: [], videos: [], hashtags: [] });
  const [searching, setSearching] = useState(false);

  const [trending, setTrending] = useState([]);
  const [trendingTags, setTrendingTags] = useState([]);
  const [loadingTrending, setLoadingTrending] = useState(true);

  const debounceRef = useRef(null);

  const loadTrending = useCallback(async () => {
    setLoadingTrending(true);
    try {
      const [vids, tags] = await Promise.all([fetchTrending(), fetchTrendingHashtags()]);
      setTrending(vids);
      setTrendingTags(tags);
    } catch (_) {} finally { setLoadingTrending(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadTrending(); }, [loadTrending]));

  // debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults({ users: [], videos: [], hashtags: [] }); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        setResults(await searchApi(q.trim()));
      } catch (_) {} finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  const openVideo = (video) => navigation.navigate('Video', { videoId: video.id, video });
  const openUser = (id) => navigation.navigate('UserProfile', { userId: id });
  const openTag = (name) => navigation.navigate('Hashtag', { name });

  const isSearching = q.trim().length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.searchBar}>
        <Text style={{ fontSize: 16 }}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Search users, videos, #hashtags"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        {q ? <TouchableOpacity onPress={() => setQ('')}><Text style={styles.clear}>✕</Text></TouchableOpacity> : null}
      </View>

      {isSearching ? (
        <>
          <View style={styles.tabs}>
            {['videos', 'users', 'hashtags'].map((t) => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t[0].toUpperCase() + t.slice(1)} ({results[t].length})
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {searching ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
          ) : tab === 'videos' ? (
            <FlatList
              data={results.videos}
              keyExtractor={(v) => String(v.id)}
              numColumns={3}
              renderItem={({ item }) => <GridTile item={item} onPress={openVideo} />}
              columnWrapperStyle={{ gap: 3, paddingHorizontal: 3 }}
              contentContainerStyle={{ gap: 3 }}
              ListEmptyComponent={<Text style={styles.empty}>No videos found</Text>}
            />
          ) : tab === 'users' ? (
            <FlatList
              data={results.users}
              keyExtractor={(u) => String(u.id)}
              renderItem={({ item }) => <UserRow user={item} onPress={() => openUser(item.id)} />}
              ListEmptyComponent={<Text style={styles.empty}>No users found</Text>}
            />
          ) : (
            <FlatList
              data={results.hashtags}
              keyExtractor={(h) => String(h.id)}
              renderItem={({ item }) => <HashtagRow tag={item} onPress={() => openTag(item.name)} />}
              ListEmptyComponent={<Text style={styles.empty}>No hashtags found</Text>}
            />
          )}
        </>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.section}>🔥 Trending hashtags</Text>
          {loadingTrending ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {trendingTags.map((t) => (
                <TouchableOpacity key={t.id} style={styles.chip} onPress={() => openTag(t.name)}>
                  <Text style={styles.chipText}>#{t.name}</Text>
                  <Text style={styles.chipCount}>{t.videoCount}</Text>
                </TouchableOpacity>
              ))}
              {trendingTags.length === 0 && <Text style={styles.empty}>No hashtags yet</Text>}
            </ScrollView>
          )}

          <Text style={styles.section}>⚡ Trending videos</Text>
          <View style={styles.gridWrap}>
            {trending.map((v) => (
              <GridTile key={v.id} item={v} onPress={openVideo} />
            ))}
            {!loadingTrending && trending.length === 0 && <Text style={styles.empty}>No videos yet</Text>}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 12, height: 44, gap: 8 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  clear: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginTop: 12, gap: 8 },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: colors.text },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  userAvatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avInit: { color: colors.text, fontWeight: '800', fontSize: 18 },
  userName: { color: colors.text, fontWeight: '700' },
  userHandle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  tagRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  tagIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  tagHash: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  tagName: { color: colors.text, fontWeight: '700' },
  tagCount: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  section: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 16, marginBottom: 10 },
  chip: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, flexDirection: 'row', gap: 6, alignItems: 'center' },
  chipText: { color: colors.text, fontWeight: '700' },
  chipCount: { color: colors.textMuted, fontSize: 12 },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 24, width: '100%' },
});
