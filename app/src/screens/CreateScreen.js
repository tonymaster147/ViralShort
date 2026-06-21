import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/ui';
import { uploadVideo } from '../api/videos';
import { colors } from '../theme/colors';

export default function CreateScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const player = useVideoPlayer(asset?.uri || null, (p) => { p.loop = true; });

  const pickFrom = async (source) => {
    const opts = {
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: 1,
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
    player.replace(a.uri);
  };

  const onUpload = async () => {
    if (!asset) return Alert.alert('Pick a video first');
    setUploading(true);
    setProgress(0);
    try {
      await uploadVideo(asset, caption, setProgress);
      Alert.alert('Posted! 🎉', 'Your reel is live.');
      setAsset(null);
      setCaption('');
      navigation.navigate('Feed');
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || 'Try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 10 }}>
      <Text style={styles.title}>New Reel</Text>

      {asset ? (
        <View style={styles.previewWrap}>
          <VideoView style={styles.preview} player={player} contentFit="cover" nativeControls={false} />
          <TouchableOpacity style={styles.changeBtn} onPress={() => setAsset(null)}>
            <Text style={styles.changeText}>✕ Remove</Text>
          </TouchableOpacity>
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
  previewWrap: { height: 360, borderRadius: 16, overflow: 'hidden', marginBottom: 20, backgroundColor: '#000' },
  preview: { flex: 1 },
  changeBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  changeText: { color: colors.text, fontWeight: '700' },
  label: { color: colors.textMuted, marginBottom: 6 },
  captionInput: {
    backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text,
    minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, marginBottom: 18,
  },
  progressWrap: { height: 26, backgroundColor: colors.card, borderRadius: 13, overflow: 'hidden', marginBottom: 14, justifyContent: 'center' },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary },
  progressText: { color: colors.text, textAlign: 'center', fontWeight: '700', fontSize: 12 },
});
