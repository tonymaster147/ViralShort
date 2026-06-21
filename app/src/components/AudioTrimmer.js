import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { createAudioPlayer } from 'expo-audio';
import { colors } from '../theme/colors';

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Lets the user choose which slice of the picked music to use.
// Reports { start, duration } up via onChange. videoDuration caps the length.
export default function AudioTrimmer({ music, videoDuration, onChange }) {
  const [player, setPlayer] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(videoDuration || 15);
  const [playing, setPlaying] = useState(false);

  // Load the audio to read its duration.
  useEffect(() => {
    let p;
    try {
      p = createAudioPlayer({ uri: music.uri });
      setPlayer(p);
      const poll = setInterval(() => {
        if (p.duration && p.duration > 0) {
          setAudioDuration(p.duration);
          // default length = min(video length, audio length)
          const def = Math.min(videoDuration || p.duration, p.duration);
          setLength(def);
          clearInterval(poll);
        }
      }, 200);
      setTimeout(() => clearInterval(poll), 5000);
    } catch (_) {}
    return () => { try { p?.remove(); } catch (_) {} };
  }, [music.uri]);

  // Report changes upward.
  useEffect(() => {
    onChange?.({ start: Math.round(start), duration: Math.round(length) });
  }, [start, length]);

  const maxStart = Math.max(0, audioDuration - 1);
  const maxLength = Math.max(1, audioDuration - start);

  const preview = async () => {
    if (!player) return;
    try {
      if (playing) { player.pause(); setPlaying(false); return; }
      player.seekTo(start);
      player.play();
      setPlaying(true);
      // auto-stop at the end of the slice
      setTimeout(() => { try { player.pause(); } catch (_) {} setPlaying(false); }, length * 1000);
    } catch (_) {}
  };

  if (audioDuration === 0) {
    return <Text style={styles.loading}>Loading audio…</Text>;
  }

  return (
    <View style={styles.box}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Trim music</Text>
        <TouchableOpacity onPress={preview} style={styles.previewBtn}>
          <Text style={styles.previewText}>{playing ? '⏸ Stop' : '▶ Preview'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.value}>Start: {fmt(start)}</Text>
      <Slider
        minimumValue={0}
        maximumValue={maxStart}
        value={start}
        onValueChange={(v) => setStart(v)}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />

      <Text style={styles.value}>
        Length: {fmt(length)} {videoDuration ? `(video is ${fmt(videoDuration)})` : ''}
      </Text>
      <Slider
        minimumValue={1}
        maximumValue={maxLength}
        value={Math.min(length, maxLength)}
        onValueChange={(v) => setLength(v)}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />

      <Text style={styles.summary}>
        Using {fmt(start)} → {fmt(Math.min(start + length, audioDuration))} of the track
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { color: colors.text, fontWeight: '800' },
  previewBtn: { backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  previewText: { color: colors.accent, fontWeight: '700' },
  value: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
  summary: { color: colors.text, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  loading: { color: colors.textMuted, marginBottom: 12 },
});
