import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { useTheme } from '../theme/ThemeContext';

const SPEEDS = [0.5, 1, 1.5, 2];
let cid = 1;

// Convert picked assets into editable clips.
function toClip(a) {
  const isImage = a.type === 'image' || (a.mimeType || '').startsWith('image');
  const dur = isImage ? 3 : Math.max(0.5, (a.duration || 3000) / 1000);
  return {
    id: cid++, uri: a.uri, type: isImage ? 'image' : 'video',
    dur, trimStart: 0, trimEnd: dur, imgDur: 3, speed: 1, rotate: 0, fit: 'cover',
  };
}

export default function ClipEditorScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [clips, setClips] = useState(() => (route.params?.assets || []).map(toClip));
  const [sel, setSel] = useState(0);
  const [tool, setTool] = useState(null); // trim | speed | null

  const current = clips[sel];
  const player = useVideoPlayer(current?.type === 'video' ? current.uri : null, (p) => { p.loop = true; p.muted = false; });

  // Load the selected clip into the preview when it changes.
  useEffect(() => {
    if (current?.type === 'video' && current.uri) {
      try { player.replace(current.uri); player.play(); } catch (_) {}
    } else {
      try { player.pause(); } catch (_) {}
    }
  }, [current?.uri]);

  // Live preview: reflect speed on the player.
  useEffect(() => {
    if (current?.type === 'video') {
      try { player.playbackRate = current.speed || 1; } catch (_) {}
    }
  }, [current?.speed, current?.uri]);

  // Stop audio/video when leaving the screen.
  useFocusEffect(
    useCallback(() => {
      return () => { try { player.pause(); } catch (_) {} };
    }, [player])
  );

  const update = (patch) => setClips((cs) => cs.map((c, i) => i === sel ? { ...c, ...patch } : c));

  const move = (dir) => {
    setClips((cs) => {
      const ns = [...cs];
      const j = sel + dir;
      if (j < 0 || j >= ns.length) return cs;
      [ns[sel], ns[j]] = [ns[j], ns[sel]];
      setSel(j);
      return ns;
    });
  };

  const del = () => {
    if (clips.length <= 1) return Alert.alert('Keep at least one clip');
    setClips((cs) => cs.filter((_, i) => i !== sel));
    setSel((s) => Math.max(0, s - 1));
    setTool(null);
  };

  const rotate = () => update({ rotate: ((current.rotate + 90) % 360) });

  const split = () => {
    if (current.type !== 'video') return Alert.alert('Only videos can be split');
    const mid = (current.trimStart + current.trimEnd) / 2;
    setClips((cs) => {
      const ns = [...cs];
      const a = { ...current, trimEnd: mid };
      const b = { ...current, id: cid++, trimStart: mid };
      ns.splice(sel, 1, a, b);
      return ns;
    });
    setTool(null);
  };

  const onNext = () => {
    const clipItems = clips.map((c) => ({
      uri: c.uri,
      type: c.type,
      trimStart: c.type === 'video' ? c.trimStart : 0,
      trimDur: c.type === 'video' ? Math.max(0.3, c.trimEnd - c.trimStart) : undefined,
      speed: c.speed,
      rotate: c.rotate,
      fit: c.fit,
      duration: c.type === 'image' ? c.imgDur : undefined,
    }));
    navigation.navigate({ name: 'CreateMain', params: { clipItems }, merge: true });
  };

  const totalSec = clips.reduce((s, c) => {
    const len = c.type === 'image' ? c.imgDur : (c.trimEnd - c.trimStart);
    return s + len / c.speed;
  }, 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-back" size={26} color={colors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Edit clips · {totalSec.toFixed(1)}s</Text>
        <TouchableOpacity onPress={onNext} style={styles.nextBtn}><Text style={styles.nextText}>Next ({clips.length})</Text></TouchableOpacity>
      </View>

      {/* Preview — reflects rotation + fill/fit live */}
      <View style={styles.preview}>
        <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${current?.rotate || 0}deg` }] }]}>
          {current?.type === 'video' ? (
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              contentFit={current?.fit === 'fit' ? 'contain' : 'cover'}
              nativeControls={false}
            />
          ) : (
            <Image source={{ uri: current?.uri }} style={StyleSheet.absoluteFill} resizeMode={current?.fit === 'fit' ? 'contain' : 'cover'} />
          )}
        </View>
        {current?.rotate ? <View style={styles.rotateTag}><Text style={styles.tagText}>↻ {current.rotate}°</Text></View> : null}
        {current?.speed !== 1 ? <View style={styles.speedTag}><Text style={styles.tagText}>{current.speed}×</Text></View> : null}
      </View>

      {/* Tool panel */}
      {tool === 'trim' && current?.type === 'video' && (
        <View style={styles.toolPanel}>
          <Text style={styles.toolLabel}>Start {current.trimStart.toFixed(1)}s · End {current.trimEnd.toFixed(1)}s</Text>
          <Text style={styles.miniLabel}>Start</Text>
          <Slider minimumValue={0} maximumValue={Math.max(0.1, current.dur)} value={current.trimStart}
            onValueChange={(v) => update({ trimStart: Math.min(v, current.trimEnd - 0.3) })}
            minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />
          <Text style={styles.miniLabel}>End</Text>
          <Slider minimumValue={0} maximumValue={Math.max(0.1, current.dur)} value={current.trimEnd}
            onValueChange={(v) => update({ trimEnd: Math.max(v, current.trimStart + 0.3) })}
            minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.border} thumbTintColor={colors.accent} />
        </View>
      )}
      {tool === 'trim' && current?.type === 'image' && (
        <View style={styles.toolPanel}>
          <Text style={styles.toolLabel}>Photo duration: {current.imgDur}s</Text>
          <Slider minimumValue={1} maximumValue={10} step={1} value={current.imgDur}
            onValueChange={(v) => update({ imgDur: v })}
            minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />
        </View>
      )}
      {tool === 'speed' && (
        <View style={styles.toolPanel}>
          <Text style={styles.toolLabel}>Speed</Text>
          <View style={styles.speedRow}>
            {SPEEDS.map((s) => (
              <TouchableOpacity key={s} style={[styles.speedChip, current.speed === s && styles.speedChipActive]} onPress={() => update({ speed: s })}>
                <Text style={[styles.speedChipText, current.speed === s && styles.speedChipTextActive]}>{s}×</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Filmstrip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filmstrip} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
        {clips.map((c, i) => (
          <TouchableOpacity key={c.id} onPress={() => { setSel(i); setTool(null); }} style={[styles.tile, i === sel && styles.tileActive]}>
            {c.type === 'image' ? (
              <Image source={{ uri: c.uri }} style={styles.tileImg} />
            ) : (
              <View style={[styles.tileImg, styles.tileVideo]}><Ionicons name="play" size={18} color="#fff" /></View>
            )}
            <Text style={styles.tileNum}>{i + 1}</Text>
            {c.fit === 'fit' && <View style={styles.fitDot} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bottom toolbar */}
      <View style={[styles.toolbar, { paddingBottom: insets.bottom + 8 }]}>
        <Tool icon="cut" label="Trim" active={tool === 'trim'} onPress={() => setTool((t) => t === 'trim' ? null : 'trim')} colors={colors} styles={styles} />
        <Tool icon="git-branch" label="Split" onPress={split} colors={colors} styles={styles} />
        <Tool icon="speedometer" label="Speed" active={tool === 'speed'} onPress={() => setTool((t) => t === 'speed' ? null : 'speed')} colors={colors} styles={styles} />
        <Tool icon="sync" label={`${current?.rotate || 0}°`} onPress={rotate} colors={colors} styles={styles} />
        <Tool icon={current?.fit === 'fit' ? 'scan-outline' : 'crop'} label={current?.fit === 'fit' ? 'Fit' : 'Fill'} onPress={() => update({ fit: current.fit === 'fit' ? 'cover' : 'fit' })} colors={colors} styles={styles} />
        <Tool icon="arrow-back" label="◀" onPress={() => move(-1)} colors={colors} styles={styles} />
        <Tool icon="arrow-forward" label="▶" onPress={() => move(1)} colors={colors} styles={styles} />
        <Tool icon="trash" label="Delete" onPress={del} colors={colors} styles={styles} danger />
      </View>
    </View>
  );
}

function Tool({ icon, label, active, onPress, colors, styles, danger }) {
  return (
    <TouchableOpacity style={styles.tool} onPress={onPress}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : active ? colors.primary : colors.text} />
      <Text style={[styles.toolText, active && { color: colors.primary }, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10 },
  headerTitle: { color: colors.text, fontWeight: '800' },
  nextBtn: { backgroundColor: colors.primary, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  nextText: { color: '#fff', fontWeight: '800' },
  preview: { flex: 1, backgroundColor: '#000', margin: 12, borderRadius: 14, overflow: 'hidden' },
  rotateTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  speedTag: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  toolPanel: { backgroundColor: colors.card, marginHorizontal: 12, borderRadius: 12, padding: 14, marginBottom: 8 },
  toolLabel: { color: colors.text, fontWeight: '700', marginBottom: 4 },
  miniLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  speedRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  speedChip: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  speedChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  speedChipText: { color: colors.textMuted, fontWeight: '800' },
  speedChipTextActive: { color: '#fff' },
  filmstrip: { maxHeight: 84, marginBottom: 6 },
  tile: { width: 54, height: 72, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.card },
  tileActive: { borderColor: colors.primary },
  tileImg: { width: '100%', height: '100%' },
  tileVideo: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tileNum: { position: 'absolute', top: 2, left: 4, color: '#fff', fontWeight: '800', fontSize: 11, textShadowColor: '#000', textShadowRadius: 2 },
  fitDot: { position: 'absolute', bottom: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  toolbar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  tool: { alignItems: 'center', gap: 3, minWidth: 36 },
  toolText: { color: colors.text, fontSize: 10, fontWeight: '600' },
});
