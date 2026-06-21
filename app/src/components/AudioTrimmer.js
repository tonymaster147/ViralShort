import React, { useEffect, useState, useRef } from 'react';
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
// Reports { start, duration } up via onChange.
// The chosen length can never exceed the video duration.
export default function AudioTrimmer({ music, videoDuration, onChange }) {
  const playerRef = useRef(null);
  const stopTimer = useRef(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(videoDuration || 15);
  const [playing, setPlaying] = useState(false);

  // Hard cap: music length can't be longer than the video.
  const cap = (val) => {
    let max = audioDuration > 0 ? audioDuration - start : val;
    if (videoDuration) max = Math.min(max, videoDuration);
    return Math.max(1, Math.min(val, max));
  };

  // Load the audio to read its duration.
  useEffect(() => {
    let p;
    try {
      p = createAudioPlayer({ uri: music.uri });
      playerRef.current = p;
      const poll = setInterval(() => {
        if (p.duration && p.duration > 0) {
          setAudioDuration(p.duration);
          const def = Math.min(videoDuration || p.duration, p.duration);
          setLength(def);
          clearInterval(poll);
        }
      }, 150);
      setTimeout(() => clearInterval(poll), 5000);
    } catch (_) {}
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      try { p?.remove(); } catch (_) {}
    };
  }, [music.uri]);

  // Keep length within the cap whenever start/duration changes.
  useEffect(() => {
    setLength((l) => cap(l));
  }, [start, audioDuration, videoDuration]);

  // Report the slice upward.
  useEffect(() => {
    onChange?.({ start: Math.round(start), duration: Math.round(length) });
  }, [start, length]);

  const stopPreview = () => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    try { playerRef.current?.pause(); } catch (_) {}
    setPlaying(false);
  };

  // Play the selected slice from `start`, auto-stop after `length` seconds.
  const playSlice = () => {
    const p = playerRef.current;
    if (!p) return;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    try {
      p.seekTo(start);
      p.play();
      setPlaying(true);
      stopTimer.current = setTimeout(() => stopPreview(), length * 1000);
    } catch (_) {}
  };

  const togglePreview = () => (playing ? stopPreview() : playSlice());

  // When the user moves the START slider, instantly restart preview from the new point.
  const onStartChange = (v) => {
    setStart(v);
    if (playing) {
      const p = playerRef.current;
      try {
        p.seekTo(v);
        if (stopTimer.current) clearTimeout(stopTimer.current);
        stopTimer.current = setTimeout(() => stopPreview(), cap(length) * 1000);
      } catch (_) {}
    }
  };

  if (audioDuration === 0) {
    return <Text style={styles.loading}>Loading audio…</Text>;
  }

  const maxStart = Math.max(0, audioDuration - 1);
  // Length max is bounded by both remaining audio AND the video length.
  const lengthMax = Math.max(1, Math.min(audioDuration - start, videoDuration || audioDuration));

  return (
    <View style={styles.box}>
      <View style={styles.rowBetween}>
        <Text style={styles.label}>Trim music</Text>
        <TouchableOpacity onPress={togglePreview} style={styles.previewBtn}>
          <Text style={styles.previewText}>{playing ? '⏸ Stop' : '▶ Preview'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.value}>Start: {fmt(start)}</Text>
      <Slider
        minimumValue={0}
        maximumValue={maxStart}
        value={start}
        onValueChange={onStartChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />

      <Text style={styles.value}>
        Length: {fmt(cap(length))}{videoDuration ? `  (max ${fmt(videoDuration)} — video length)` : ''}
      </Text>
      <Slider
        minimumValue={1}
        maximumValue={lengthMax}
        value={cap(length)}
        onValueChange={(v) => setLength(cap(v))}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />

      <Text style={styles.summary}>
        Using {fmt(start)} → {fmt(Math.min(start + cap(length), audioDuration))} of the track
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
