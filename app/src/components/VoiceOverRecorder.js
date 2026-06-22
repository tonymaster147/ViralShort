import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { colors } from '../theme/colors';

// Records a voice-over from the mic and reports the file via onRecorded({uri}).
export default function VoiceOverRecorder({ voiceover, onRecorded, onClear }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let t;
    if (recording) t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const start = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow microphone access to record a voice-over.');
    try {
      try { await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }); } catch (_) {}
      await recorder.prepareToRecordAsync();
      recorder.record();
      setSeconds(0);
      setRecording(true);
    } catch (_) {
      Alert.alert('Could not start recording');
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      setRecording(false);
      // Reset the audio session so it doesn't leave the mic in recording mode
      // (which can affect later camera audio capture).
      try { await AudioModule.setAudioModeAsync({ allowsRecording: false }); } catch (_) {}
      if (recorder.uri) onRecorded({ uri: recorder.uri, name: `voice_${Date.now()}.m4a` });
    } catch (_) {
      setRecording(false);
    }
  };

  if (voiceover) {
    return (
      <View style={styles.row}>
        <Ionicons name="mic" size={18} color={colors.accent} />
        <Text style={styles.label}>Voice-over recorded</Text>
        <TouchableOpacity onPress={onClear}><Ionicons name="close" size={18} color={colors.danger} /></TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity style={[styles.recordBtn, recording && styles.recordingBtn]} onPress={recording ? stop : start}>
      <Ionicons name={recording ? 'stop' : 'mic'} size={18} color={colors.text} />
      <Text style={styles.recordText}>
        {recording ? `Stop (${seconds}s)` : 'Record voice-over'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed', paddingVertical: 12, marginBottom: 12 },
  recordingBtn: { borderColor: colors.danger, borderStyle: 'solid', backgroundColor: 'rgba(255,77,79,0.12)' },
  recordText: { color: colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 12 },
  label: { color: colors.text, fontWeight: '700', flex: 1 },
});
