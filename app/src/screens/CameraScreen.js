import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const MAX_TOTAL = 60;            // max total reel length (s)
const COUNTDOWN_OPTIONS = [0, 3, 10];

export default function CameraScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();

  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');     // off | on | auto
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [countdown, setCountdown] = useState(0); // selected countdown seconds
  const [counting, setCounting] = useState(0);   // live countdown number
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);     // current clip seconds
  const [clips, setClips] = useState([]);        // [{ uri, duration }]
  const [busy, setBusy] = useState(false);

  const timerRef = useRef(null);
  const totalRecorded = clips.reduce((s, c) => s + (c.duration || 0), 0);
  const remaining = Math.max(0, MAX_TOTAL - totalRecorded);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // Ask permissions up-front.
  useEffect(() => {
    if (camPerm && !camPerm.granted) requestCam();
    if (micPerm && !micPerm.granted) requestMic();
  }, [camPerm, micPerm]);

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (totalRecorded + next >= MAX_TOTAL) stopRecording();
        return next;
      });
    }, 1000);
  };

  const doRecord = async () => {
    if (!cameraRef.current) return;
    setRecording(true);
    startTimer();
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: remaining });
      if (video?.uri) {
        // capture the duration we counted
        setClips((prev) => [...prev, { uri: video.uri, duration: elapsedRef.current || 1 }]);
      }
    } catch (e) {
      // recording cancelled/failed
    } finally {
      clearInterval(timerRef.current);
      setRecording(false);
      setElapsed(0);
    }
  };

  // keep a ref of elapsed so doRecord's closure can read the final value
  const elapsedRef = useRef(0);
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  const onShutter = async () => {
    if (recording) return stopRecording();
    if (remaining < 1) return Alert.alert('Max length reached', 'Remove a clip to record more.');
    if (countdown > 0) {
      setCounting(countdown);
      const tick = setInterval(() => {
        setCounting((c) => {
          if (c <= 1) { clearInterval(tick); setCounting(0); doRecord(); return 0; }
          return c - 1;
        });
      }, 1000);
    } else {
      doRecord();
    }
  };

  const stopRecording = () => {
    try { cameraRef.current?.stopRecording(); } catch (_) {}
  };

  const deleteLast = () => setClips((prev) => prev.slice(0, -1));

  const onNext = () => {
    if (clips.length === 0) return Alert.alert('Record a clip first');
    setBusy(true);
    // Hand the clips to the Create screen for editing/publish.
    navigation.navigate('CreateMain', { clips: clips.map((c) => c.uri) });
    setBusy(false);
  };

  if (!camPerm || !micPerm) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }
  if (!camPerm.granted) {
    return (
      <View style={styles.center}>
        <Ionicons name="camera-outline" size={56} color={colors.textMuted} />
        <Text style={styles.permText}>Camera access is needed to record.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestCam}><Text style={styles.permBtnText}>Grant access</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
        enableTorch={torch}
        zoom={zoom}
        mode="video"
        videoBitrate={12000000}
        autofocus="on"
      />

      {/* Top controls */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))}>
            <Ionicons name={flash === 'off' ? 'flash-off' : flash === 'auto' ? 'flash-outline' : 'flash'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setTorch((t) => !t)}>
            <Ionicons name={torch ? 'bulb' : 'bulb-outline'} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}>
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Countdown overlay */}
      {counting > 0 && (
        <View style={styles.countdownOverlay}><Text style={styles.countdownNum}>{counting}</Text></View>
      )}

      {/* Progress / total */}
      <View style={[styles.progressWrap, { top: insets.top + 56 }]}>
        <View style={[styles.progressBar, { width: `${(totalRecorded / MAX_TOTAL) * 100}%` }]} />
        {recording && <View style={[styles.progressBarLive, { left: `${(totalRecorded / MAX_TOTAL) * 100}%`, width: `${(elapsed / MAX_TOTAL) * 100}%` }]} />}
      </View>
      <Text style={[styles.timeText, { top: insets.top + 68 }]}>
        {Math.floor(totalRecorded + (recording ? elapsed : 0))}s / {MAX_TOTAL}s
        {clips.length ? `  ·  ${clips.length} clip${clips.length > 1 ? 's' : ''}` : ''}
      </Text>

      {/* Right rail: zoom + countdown */}
      <View style={[styles.rightRail, { top: insets.top + 110 }]}>
        <Text style={styles.railLabel}>Zoom</Text>
        <Slider
          style={styles.zoomSlider}
          minimumValue={0} maximumValue={1} value={zoom} onValueChange={setZoom}
          minimumTrackTintColor={colors.primary} maximumTrackTintColor="rgba(255,255,255,0.4)" thumbTintColor="#fff"
        />
        <TouchableOpacity
          style={styles.timerBtn}
          onPress={() => setCountdown((c) => COUNTDOWN_OPTIONS[(COUNTDOWN_OPTIONS.indexOf(c) + 1) % COUNTDOWN_OPTIONS.length])}
        >
          <Ionicons name="timer-outline" size={20} color="#fff" />
          <Text style={styles.timerText}>{countdown > 0 ? `${countdown}s` : 'off'}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.sideBtn} onPress={deleteLast} disabled={!clips.length || recording}>
          <Ionicons name="arrow-undo" size={26} color={clips.length && !recording ? '#fff' : 'rgba(255,255,255,0.3)'} />
          <Text style={styles.sideText}>Delete</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onShutter} disabled={counting > 0}>
          <View style={[styles.shutterOuter, recording && styles.shutterOuterRec]}>
            <View style={[styles.shutterInner, recording && styles.shutterInnerRec]} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sideBtn} onPress={onNext} disabled={!clips.length || recording || busy}>
          <Ionicons name="checkmark-circle" size={30} color={clips.length && !recording ? colors.primary : 'rgba(255,255,255,0.3)'} />
          <Text style={styles.sideText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 30 },
  permText: { color: colors.text, marginTop: 14, textAlign: 'center' },
  permBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 30, paddingVertical: 12, paddingHorizontal: 30 },
  permBtnText: { color: colors.text, fontWeight: '800' },
  topBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  topRight: { flexDirection: 'row', gap: 6 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  countdownNum: { color: '#fff', fontSize: 100, fontWeight: '900' },
  progressWrap: { position: 'absolute', left: 12, right: 12, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent },
  progressBarLive: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.primary },
  timeText: { position: 'absolute', alignSelf: 'center', color: '#fff', fontWeight: '700', fontSize: 12 },
  rightRail: { position: 'absolute', right: 8, alignItems: 'center', gap: 10 },
  railLabel: { color: '#fff', fontSize: 11 },
  zoomSlider: { width: 120, transform: [{ rotate: '-90deg' }], marginVertical: 50 },
  timerBtn: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 8, width: 48 },
  timerText: { color: '#fff', fontSize: 11, marginTop: 2 },
  bottomBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 20 },
  sideBtn: { alignItems: 'center', width: 70 },
  sideText: { color: '#fff', fontSize: 11, marginTop: 4 },
  shutterOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterOuterRec: { borderColor: colors.primary },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary },
  shutterInnerRec: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary },
});
