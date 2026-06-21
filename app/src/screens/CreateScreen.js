import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Button } from '../components/ui';
import AudioTrimmer from '../components/AudioTrimmer';
import AudioPanel from '../components/AudioPanel';
import VoiceOverRecorder from '../components/VoiceOverRecorder';
import TagPeopleModal from '../components/TagPeopleModal';
import { uploadVideo } from '../api/videos';
import { saveDraft, deleteDraft } from '../api/drafts';
import { FILTERS, filterOverlay } from '../theme/filters';
import { useTheme } from '../theme/ThemeContext';

export default function CreateScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [asset, setAsset] = useState(null);
  const [caption, setCaption] = useState('');
  const [filter, setFilter] = useState('none');

  // Audio: a catalog sound OR a device music file (mutually exclusive); plus voice-over.
  const [selectedSound, setSelectedSound] = useState(null); // { id, title, audioUrl, duration }
  const [music, setMusic] = useState(null);                 // device file { uri, name }
  const [voiceover, setVoiceover] = useState(null);         // recorded file { uri }
  const [trim, setTrim] = useState({ start: 0, duration: null });
  const [originalVolume, setOriginalVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(1);
  const [voiceVolume, setVoiceVolume] = useState(1);
  const [audioPanelOpen, setAudioPanelOpen] = useState(false);

  const [videoDuration, setVideoDuration] = useState(null);
  const [coverTime, setCoverTime] = useState(0);
  const [allowComments, setAllowComments] = useState(true);
  const [allowRemix, setAllowRemix] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [draftId, setDraftId] = useState(null);
  const [clips, setClips] = useState(null);     // multi-clip uris from the camera
  const [overlay, setOverlay] = useState(null); // editor overlay (text/stickers/draw)
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Publish extras
  const [location, setLocation] = useState(null);   // { name, lat, lng }
  const [scheduledAt, setScheduledAt] = useState(null); // Date | null
  const [showPicker, setShowPicker] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  // The added audio source (music or catalog) used for trimming/preview.
  const addedAudio = music
    ? { uri: music.uri, label: music.name }
    : selectedSound
      ? { uri: selectedSound.audioUrl, label: selectedSound.title }
      : null;

  const player = useVideoPlayer(asset?.uri || null, (p) => {
    p.loop = true;
    p.muted = originalVolume === 0;
  });

  useEffect(() => { if (player) player.muted = originalVolume === 0; }, [originalVolume, player]);

  // Clips recorded in the custom camera.
  useEffect(() => {
    const incoming = route?.params?.clips;
    if (incoming?.length) {
      setClips(incoming);
      setAsset({ uri: incoming[0] }); // preview the first clip
      try { player.replace(incoming[0]); } catch (_) {}
    }
  }, [route?.params?.clips]);

  // Overlay returned from the editor.
  useEffect(() => {
    if (route?.params?.overlay) setOverlay(route.params.overlay);
  }, [route?.params?.overlay]);

  // Resume a draft if passed in.
  useEffect(() => {
    const draft = route?.params?.draft;
    if (draft) {
      const s = draft.state || {};
      setDraftId(draft.id);
      setAsset({ uri: draft.videoUri });
      setCaption(s.caption || '');
      setFilter(s.filter || 'none');
      setSelectedSound(s.selectedSound || null);
      setCoverTime(s.coverTime || 0);
      setAllowComments(s.allowComments !== false);
      setAllowRemix(s.allowRemix !== false);
      setAllowDownload(!!s.allowDownload);
      try { player.replace(draft.videoUri); } catch (_) {}
    }
  }, [route?.params?.draft]);

  useEffect(() => {
    if (asset) {
      try { player.play(); } catch (_) {}
      const poll = setInterval(() => {
        if (player?.duration && player.duration > 0) {
          setVideoDuration(player.duration);
          clearInterval(poll);
        }
      }, 250);
      const stop = setTimeout(() => clearInterval(poll), 5000);
      return () => { clearInterval(poll); clearTimeout(stop); };
    }
  }, [asset]);

  const onScrubCover = (t) => {
    setCoverTime(t);
    try { player.pause(); player.currentTime = t; } catch (_) {}
  };

  const addLocation = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Allow location access to tag your place.'); return; }
      const pos = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      const name = place
        ? [place.name, place.city || place.subregion, place.region].filter(Boolean).slice(0, 2).join(', ')
        : `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`;
      setLocation({ name, lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (_) {
      Alert.alert('Could not get location');
    } finally { setLocating(false); }
  };

  const onPickPerson = (username) => {
    setCaption((c) => (c.endsWith(' ') || c === '' ? c : c + ' ') + '@' + username + ' ');
  };

  // Open the schedule picker. Android needs a date step then a time step;
  // iOS shows the inline datetime spinner.
  const openScheduler = () => {
    if (scheduledAt) { setScheduledAt(null); return; }
    const initial = new Date(Date.now() + 3600000); // default +1h
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: new Date(Date.now() + 60000),
        onChange: (e, date) => {
          if (e.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: false,
            onChange: (e2, time) => {
              if (e2.type !== 'set' || !time) return;
              const combined = new Date(date);
              combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
              if (combined.getTime() < Date.now() + 60000) {
                return Alert.alert('Pick a future time', 'Schedule must be at least a minute from now.');
              }
              setScheduledAt(combined);
            },
          });
        },
      });
    } else {
      setShowPicker(true);
    }
  };

  const pickFrom = async (source) => {
    const opts = {
      mediaTypes: ImagePicker.MediaTypeOptions?.Videos ?? 'videos',
      videoMaxDuration: 60,
      quality: 1,
      videoExportPreset: ImagePicker.VideoExportPreset?.HighestQuality,
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

  // AudioPanel callbacks
  const onSelectSound = (sound) => { setSelectedSound(sound); setMusic(null); setTrim({ start: 0, duration: null }); if (originalVolume === 1) setOriginalVolume(0); };
  const onSelectDevice = (file) => { setMusic(file); setSelectedSound(null); setTrim({ start: 0, duration: null }); if (originalVolume === 1) setOriginalVolume(0); };
  const onSelectOriginal = () => { setSelectedSound(null); setMusic(null); setOriginalVolume(1); };

  const onUpload = async () => {
    if (!asset) return Alert.alert('Pick a video first');
    setUploading(true);
    setProgress(0);
    try {
      await uploadVideo(asset, caption, setProgress, {
        clips: clips && clips.length ? clips : null,
        overlay: overlay || null,
        filter: filter !== 'none' ? filter : null,
        soundId: !music && selectedSound ? selectedSound.id : null,
        music,
        voiceover,
        musicStart: addedAudio ? trim.start : null,
        musicDuration: addedAudio ? trim.duration : null,
        originalVolume,
        musicVolume,
        voiceVolume,
        coverTime,
        allowComments, allowRemix, allowDownload,
        locationName: location?.name || null,
        locationLat: location?.lat ?? null,
        locationLng: location?.lng ?? null,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
      });
      if (draftId) { try { await deleteDraft(draftId); } catch (_) {} }
      Alert.alert(
        scheduledAt ? 'Scheduled! 🗓️' : 'Posted! 🎉',
        scheduledAt
          ? `Your reel will publish on ${scheduledAt.toLocaleString()}.`
          : 'Your reel is processing and will appear shortly (check your profile).'
      );
      resetAll();
      navigation.navigate('Feed');
    } catch (err) {
      const msg = err.response?.data?.error
        || (err.message?.includes('timeout') ? 'Upload timed out — check Wi-Fi and try again.' : 'Could not upload. Check that the server is running.');
      Alert.alert('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  };

  const resetAll = () => {
    setAsset(null); setCaption(''); setFilter('none');
    setSelectedSound(null); setMusic(null); setVoiceover(null);
    setTrim({ start: 0, duration: null });
    setOriginalVolume(1); setMusicVolume(1); setVoiceVolume(1);
    setCoverTime(0); setDraftId(null); setVideoDuration(null); setClips(null); setOverlay(null);
    setLocation(null); setScheduledAt(null);
  };

  const onSaveDraft = async () => {
    if (!asset) return Alert.alert('Pick a video first');
    try {
      const saved = await saveDraft(
        { caption, filter, selectedSound, coverTime, allowComments, allowRemix, allowDownload },
        asset.uri, draftId
      );
      setDraftId(saved.id);
      Alert.alert('Draft saved', 'Find it later in Create → Drafts.');
    } catch (_) { Alert.alert('Could not save draft'); }
  };

  const audioLabel = music ? music.name : selectedSound ? selectedSound.title : 'Original audio';

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 10, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>New Reel</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Drafts')}>
          <Text style={styles.draftsLink}>Drafts</Text>
        </TouchableOpacity>
      </View>

      {asset ? (
        <View style={styles.previewWrap}>
          <VideoView style={styles.preview} player={player} contentFit="cover" nativeControls={false} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filterOverlay(filter) }]} />
          <TouchableOpacity style={styles.changeBtn} onPress={() => setAsset(null)}>
            <Text style={styles.changeText}>✕ Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('Editor', { videoUri: (clips && clips[0]) || asset.uri })}>
            <Ionicons name="sparkles" size={14} color="#fff" />
            <Text style={styles.editText}>{overlay ? 'Edit ✓' : 'Edit'}</Text>
          </TouchableOpacity>
          <View style={styles.soundTag}>
            <Ionicons name="musical-notes" size={12} color={colors.text} />
            <Text style={styles.soundTagText} numberOfLines={1}>{audioLabel}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickCard} onPress={() => navigation.navigate('Camera')}>
            <Ionicons name="videocam" size={34} color={colors.text} />
            <Text style={styles.pickLabel}>Record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickCard} onPress={() => pickFrom('library')}>
            <Ionicons name="images" size={34} color={colors.text} />
            <Text style={styles.pickLabel}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {asset && (
        <>
          {/* Filters */}
          <Text style={styles.label}>Filters</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
                <View style={[styles.swatch, { backgroundColor: f.overlay === 'transparent' ? colors.card : f.overlay }]} />
                <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Sound */}
          <Text style={styles.label}>Sound</Text>
          <TouchableOpacity style={styles.soundBtn} onPress={() => setAudioPanelOpen(true)}>
            <Ionicons name="musical-notes" size={18} color={colors.primary} />
            <Text style={styles.soundBtnText} numberOfLines={1}>{audioLabel}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {addedAudio?.uri ? (
            <AudioTrimmer music={{ uri: addedAudio.uri }} videoDuration={videoDuration} onChange={setTrim} />
          ) : null}

          {/* Voice-over */}
          <Text style={styles.label}>Voice-over</Text>
          <VoiceOverRecorder voiceover={voiceover} onRecorded={setVoiceover} onClear={() => setVoiceover(null)} />

          {/* Volume mixer */}
          <Text style={styles.label}>Volume</Text>
          <VolumeRow label="Original" value={originalVolume} onChange={setOriginalVolume} />
          {addedAudio ? <VolumeRow label="Music" value={musicVolume} onChange={setMusicVolume} /> : null}
          {voiceover ? <VolumeRow label="Voice" value={voiceVolume} onChange={setVoiceVolume} /> : null}
        </>
      )}

      {asset && videoDuration ? (
        <>
          <Text style={[styles.label, { marginTop: 8 }]}>Cover frame</Text>
          <Slider
            minimumValue={0} maximumValue={Math.max(0.1, videoDuration)} value={coverTime}
            onValueChange={onScrubCover}
            minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary}
          />
          <Text style={styles.hint}>Drag to choose the cover frame ({coverTime.toFixed(1)}s).</Text>

          <Text style={[styles.label, { marginTop: 10 }]}>Settings</Text>
          {[
            ['Allow comments', allowComments, setAllowComments],
            ['Allow remix', allowRemix, setAllowRemix],
            ['Allow downloads', allowDownload, setAllowDownload],
          ].map(([lbl, val, set]) => (
            <TouchableOpacity key={lbl} style={styles.toggleRow} onPress={() => set((v) => !v)}>
              <View style={[styles.checkbox, val && styles.checkboxOn]}>{val && <Ionicons name="checkmark" size={16} color={colors.text} />}</View>
              <Text style={styles.toggleLabel}>{lbl}</Text>
            </TouchableOpacity>
          ))}

          {/* Tag people */}
          <TouchableOpacity style={styles.optRow} onPress={() => setTagOpen(true)}>
            <Ionicons name="person-add-outline" size={20} color={colors.text} />
            <Text style={styles.optLabel}>Tag people</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Location */}
          <TouchableOpacity style={styles.optRow} onPress={location ? () => setLocation(null) : addLocation}>
            <Ionicons name="location-outline" size={20} color={colors.text} />
            <Text style={styles.optLabel} numberOfLines={1}>
              {locating ? 'Getting location…' : location ? location.name : 'Add location'}
            </Text>
            <Ionicons name={location ? 'close' : 'chevron-forward'} size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Schedule */}
          <TouchableOpacity style={styles.optRow} onPress={openScheduler}>
            <Ionicons name="time-outline" size={20} color={colors.text} />
            <Text style={styles.optLabel}>
              {scheduledAt ? `Scheduled: ${scheduledAt.toLocaleString()}` : 'Schedule for later'}
            </Text>
            <Ionicons name={scheduledAt ? 'close' : 'chevron-forward'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
          {showPicker && Platform.OS === 'ios' && (
            <DateTimePicker
              value={scheduledAt || new Date(Date.now() + 3600000)}
              mode="datetime"
              display="spinner"
              minimumDate={new Date(Date.now() + 60000)}
              onChange={(e, date) => {
                setShowPicker(false);
                if (e.type === 'set' && date) setScheduledAt(date);
              }}
            />
          )}
        </>
      ) : null}

      <Text style={styles.label}>Caption</Text>
      <TextInput
        style={styles.captionInput} value={caption} onChangeText={setCaption}
        placeholder="Say something… add #hashtags" placeholderTextColor={colors.textMuted}
        multiline maxLength={500}
      />

      {uploading ? (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
          <Text style={styles.progressText}>{progress}%</Text>
        </View>
      ) : null}

      <Button title="Post Reel" onPress={onUpload} loading={uploading} disabled={!asset} />
      {asset ? <View style={{ height: 10 }} /> : null}
      {asset ? <Button title="Save draft" onPress={onSaveDraft} variant="outline" /> : null}

      <AudioPanel
        visible={audioPanelOpen}
        onClose={() => setAudioPanelOpen(false)}
        onSelectSound={onSelectSound}
        onSelectDevice={onSelectDevice}
        onSelectOriginal={onSelectOriginal}
      />
      <TagPeopleModal visible={tagOpen} onClose={() => setTagOpen(false)} onPick={onPickPerson} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function VolumeRow({ label, value, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.volRow}>
      <Text style={styles.volLabel}>{label}</Text>
      <Slider
        style={{ flex: 1 }} minimumValue={0} maximumValue={1} value={value} onValueChange={onChange}
        minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.border} thumbTintColor={colors.accent}
      />
      <Text style={styles.volPct}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  draftsLink: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  pickRow: { flexDirection: 'row', gap: 14, marginBottom: 20 },
  pickCard: { flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 36, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  pickLabel: { color: colors.text, fontWeight: '700', marginTop: 8 },
  previewWrap: { height: 360, borderRadius: 16, overflow: 'hidden', marginBottom: 16, backgroundColor: '#000' },
  preview: { flex: 1 },
  changeBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  changeText: { color: '#fff', fontWeight: '700' },
  editBtn: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  editText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  soundTag: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '70%' },
  soundTagText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  label: { color: colors.textMuted, marginBottom: 8, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(254,44,85,0.15)' },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: colors.text },
  soundBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  soundBtnText: { color: colors.text, fontWeight: '700', flex: 1 },
  volRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  volLabel: { color: colors.text, width: 64, fontWeight: '600', fontSize: 13 },
  volPct: { color: colors.textMuted, width: 42, textAlign: 'right', fontSize: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { color: colors.text, fontWeight: '600' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, marginTop: 10, borderWidth: 1, borderColor: colors.border },
  optLabel: { color: colors.text, fontWeight: '600', flex: 1 },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: 16, marginTop: 2 },
  captionInput: { backgroundColor: colors.card, borderRadius: 12, padding: 14, color: colors.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, marginBottom: 18 },
  progressWrap: { height: 26, backgroundColor: colors.card, borderRadius: 13, overflow: 'hidden', marginBottom: 14, justifyContent: 'center' },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.primary },
  progressText: { color: colors.text, textAlign: 'center', fontWeight: '700', fontSize: 12 },
});
