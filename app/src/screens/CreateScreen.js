import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { uploadVideo, fetchSounds } from '../api/videos';
import { FILTERS, filterOverlay } from '../theme/filters';
import { colors } from '../theme/colors';

export default function CreateScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [filter, setFilter] = useState('none');
  const [sounds, setSounds] = useState([]);
  const [soundId, setSoundId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Preview player — autoplays + loops once a video is picked.
  const player = useVideoPlayer(asset?.uri || null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    fetchSounds().then(setSounds).catch(() => {});
  }, []);

  // Autoplay whenever an asset is set.
  useEffect(() => {
    if (asset) {
      try { player.play(); } catch (_) {}
    }
  }, [asset]);

  const pickFrom = async (source) => {
    const opts = {
      mediaTypes: ImagePicker.MediaTypeOptions?.Videos ?? 'videos',
      videoMaxDuration: 60,
      quality: 0.7, // compress a bit so uploads succeed faster
    };
    let result;
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access to record.');
      result = await ImagePicker.launchCameraAsync(opts);
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('Permission needed', 'Allow gallery access to pick a video.');
      result = await ImagePicker.launchImageLibraryAsync(opts);
    }
    if (result.canceled) return;
    const a = result.assets[0];
    setAsset(a);
    try { player.replace(a.uri); } catch (_) {}
  };

  const onUpload = async () => {
    if (!asset) return Alert.alert('Pick a video first');
    setUploading(true);
    setProgress(0);
    try {
      await uploadVideo(asset, caption, setProgress, {
        filter: filter !== 'none' ? filter : null,
        soundId,
      });
      Alert.alert('Posted! 🎉', 'Your reel is live.');
      setAsset(null);
      setCaption('');
      setFilter('none');
      setSoundId(null);
      navigation.navigate('Feed');
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.message?.includes('timeout') ? 'Upload timed out — check Wi-Fi and try again.' : 'Could not upload. Check that the server is running.');
      Alert.alert('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const selectedSound = sounds.find((s) => s.id === soundId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 10, paddingBottom: 40 }}>
      <Text style={styles.title}>New Reel</Text>

      {asset ? (
        <View style={styles.previewWrap}>
          <VideoView style={styles.preview} player={player} contentFit="cover" nativeControls={false} />
          {/* filter overlay */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filterOverlay(filter) }]} />
          <TouchableOpacity style={styles.changeBtn} onPress={() => { setAsset(null); }}>
            <Text style={styles.changeText}>✕ Remove</Text>
          </TouchableOpacity>
          {selectedSound ? (
            <View style={styles.soundTag}><Text style={styles.soundTagText}>♪ {selectedSound.title}</Text></View>
          ) : null}
        </View>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickCard} onPress={() => pickFrom('camera')}>
            <Text style={styles.pickEmoji}>🎥</Text>
            <Text style={styles.pickLabel}>Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickCard} onPress={() => pickFrom('library')}>
            <Text style={styles.pickEmoji}>📁</Text>
            <Text style={styles.pickLabel}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {asset && (
        <>
          {/* Filters */}
          <Text style={styles.label}>🎨 Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, filter === f.key && styles.chipActive]}
                onPress={() => setFilter(f.key)}
              >
                <View style={[styles.swatch, { backgroundColor: f.overlay === 'transparent' ? colors.card : f.overlay }]} />
                <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Soundtracks */}
          <Text style={styles.label}>🎵 Soundtrack</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <TouchableOpacity
              style={[styles.chip, !soundId && styles.chipActive]}
              onPress={() => setSoundId(null)}
            >
              <Text style={[styles.chipText, !soundId && styles.chipTextActive]}>None</Text>
            </TouchableOpacity>
            {sounds.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, soundId === s.id && styles.chipActive]}
                onPress={() => setSoundId(s.id)}
              >
                <Text style={[styles.chipText, soundId === s.id && styles.chipTextActive]}>♪ {s.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <Text style={styles.label}>Caption</Text>
      <TextInput
        style={styles.captionInput}
        value={caption}
        onChangeText={setCaption}
        placeholder="Say something… add #hashtags"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
      />

      {uploading ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      ) : null}

      <Button title="Post Reel" onPress={onUpload} loading={uploading} disabled={!asset} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 18 },
  pickRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  pickCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 36,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  pickEmoji: { fontSize: 40, marginBottom: 8 },
  pickLabel: { color: colors.text, fontWeight: '700' },
  previewWrap: { height: 360, borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: '#000' },
  preview: { flex: 1 },
  changeBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  changeText: { color: colors.text, fontWeight: '700' },
  soundTag: { position: 'absolute', left: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  soundTagText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  label: { color: colors.textMuted, marginBottom: 8, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(254,44,85,0.15)' },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.text },
  captionInput: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text,
    minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, marginBottom: 18,
  },
  progressWrap: { height: 26, backgroundColor: colors.card, borderRadius: 13, overflow: 'hidden', marginBottom: 14, justifyContent: 'center' },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary },
  progressText: { color: colors.text, textAlign: 'center', fontWeight: '700', fontSize: 12 },
});
