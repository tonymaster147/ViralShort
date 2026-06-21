import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { createAudioPlayer } from 'expo-audio';
import {
  fetchTrendingSounds, searchSounds, fetchSavedSounds, toggleSavedSound,
} from '../api/videos';
import { useTheme } from '../theme/ThemeContext';

function fmt(s) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPanel({ visible, onClose, onSelectSound, onSelectDevice, onSelectOriginal }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState('trending');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const playerRef = useRef(null);
  const debounce = useRef(null);

  const stopPreview = useCallback(() => {
    try { playerRef.current?.remove(); } catch (_) {}
    playerRef.current = null;
    setPlayingId(null);
  }, []);

  const load = useCallback(async (which, query) => {
    setLoading(true);
    try {
      if (which === 'trending') setItems(await fetchTrendingSounds());
      else if (which === 'saved') setItems(await fetchSavedSounds());
      else if (which === 'search') setItems(query?.trim() ? await searchSounds(query.trim()) : []);
    } catch (_) { setItems([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!visible) { stopPreview(); return; }
    if (tab !== 'search') load(tab);
  }, [visible, tab, load, stopPreview]);

  useEffect(() => {
    if (tab !== 'search') return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load('search', q), 300);
    return () => clearTimeout(debounce.current);
  }, [q, tab, load]);

  const preview = (sound) => {
    if (playingId === sound.id) { stopPreview(); return; }
    stopPreview();
    if (!sound.audioUrl) return;
    try {
      const p = createAudioPlayer({ uri: sound.audioUrl });
      playerRef.current = p;
      p.play();
      setPlayingId(sound.id);
      setTimeout(() => { if (playerRef.current === p) stopPreview(); }, 15000);
    } catch (_) {}
  };

  const onSave = async (sound) => {
    try {
      const res = await toggleSavedSound(sound.id);
      setItems((arr) => arr.map((s) => s.id === sound.id ? { ...s, saved: res.saved } : s));
    } catch (_) {}
  };

  const choose = (sound) => { stopPreview(); onSelectSound(sound); onClose(); };

  const pickDevice = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const f = result.assets[0];
    stopPreview();
    onSelectDevice({ uri: f.uri, name: f.name, mimeType: f.mimeType });
    onClose();
  };

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <TouchableOpacity style={styles.playBtn} onPress={() => preview(item)}>
        <Ionicons name={playingId === item.id ? 'pause' : 'play'} size={18} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.author} · {fmt(item.duration)} · {item.usageCount} uses{item.trending ? ' · 🔥' : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={() => onSave(item)} style={styles.iconBtn}>
        <Ionicons name={item.saved ? 'bookmark' : 'bookmark-outline'} size={20} color={item.saved ? colors.primary : colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => choose(item)} style={styles.useBtn}>
        <Text style={styles.useText}>Use</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { stopPreview(); onClose(); }} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Add sound</Text>

          <View style={styles.tabs}>
            {['trending', 'search', 'saved'].map((t) => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t[0].toUpperCase() + t.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'search' && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={q}
                onChangeText={setQ}
                placeholder="Search sounds"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(s) => String(s.id)}
              renderItem={renderItem}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={<Text style={styles.empty}>{tab === 'search' ? 'Type to search sounds' : 'Nothing here yet'}</Text>}
            />
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerBtn} onPress={() => { stopPreview(); onSelectOriginal(); onClose(); }}>
              <Ionicons name="mic-outline" size={18} color={colors.text} />
              <Text style={styles.footerText}>Original audio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerBtn} onPress={pickDevice}>
              <Ionicons name="folder-outline" size={18} color={colors.text} />
              <Text style={styles.footerText}>From device</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 20 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 10 },
  heading: { color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.card },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: colors.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, height: 40, marginBottom: 10 },
  searchInput: { flex: 1, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  playBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  iconBtn: { padding: 6 },
  useBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 7 },
  useText: { color: colors.text, fontWeight: '800', fontSize: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 24 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 12 },
  footerText: { color: colors.text, fontWeight: '700' },
});
