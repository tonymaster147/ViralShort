import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, PanResponder, Dimensions,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

const COLORS = ['#ffffff', '#000000', '#FF4D4F', '#FFC107', '#2ECC71', '#25F4EE', '#7C5CFF', '#FF6FB5'];
const EMOJIS = ['❤️', '😂', '🔥', '💯', '😍', '🎉', '✨', '👍', '😎', '🥳', '👀', '💀', '⭐', '🌈', '🚀'];

let nextId = 1;

// A draggable text/sticker layer.
function DraggableLayer({ layer, onMove, onSelect }) {
  const start = useRef({ x: layer.x, y: layer.y });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { start.current = { x: layer.x, y: layer.y }; onSelect?.(layer.id); },
      onPanResponderMove: (_, g) => onMove(layer.id, start.current.x + g.dx, start.current.y + g.dy),
    })
  ).current;

  return (
    <View
      {...pan.panHandlers}
      style={[styles.layer, { left: layer.x, top: layer.y, transform: [{ translateX: -0 }] }]}
    >
      {layer.type === 'text' ? (
        <Text style={[
          styles.layerText,
          { color: layer.color, fontSize: layer.fontSize },
          layer.bg ? { backgroundColor: layer.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' } : null,
        ]}>
          {layer.text}
        </Text>
      ) : (
        <Text style={{ fontSize: layer.size }}>{layer.emoji}</Text>
      )}
    </View>
  );
}

export default function EditorScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { videoUri } = route.params;
  const [box, setBox] = useState({ w: Dimensions.get('window').width, h: Dimensions.get('window').height });

  const player = useVideoPlayer(videoUri, (p) => { p.loop = true; p.muted = true; p.play(); });

  const [layers, setLayers] = useState([]);          // text + sticker
  const [strokes, setStrokes] = useState([]);        // committed draw strokes
  const [current, setCurrent] = useState(null);      // active stroke
  const [mode, setMode] = useState('none');          // none | draw
  const [drawColor, setDrawColor] = useState('#25F4EE');
  const [drawWidth, setDrawWidth] = useState(6);

  // Text editor modal
  const [textModal, setTextModal] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftColor, setDraftColor] = useState('#ffffff');
  const [draftSize, setDraftSize] = useState(34);
  const [draftBg, setDraftBg] = useState(false);

  // Sticker palette
  const [stickerOpen, setStickerOpen] = useState(false);

  const onLayerMove = useCallback((id, x, y) => {
    setLayers((ls) => ls.map((l) => l.id === id ? { ...l, x, y } : l));
  }, []);

  const addText = () => {
    if (!draftText.trim()) { setTextModal(false); return; }
    setLayers((ls) => [...ls, {
      id: nextId++, type: 'text', text: draftText.trim(),
      x: box.w / 2 - 60, y: box.h / 2 - 20,
      color: draftColor, fontSize: draftSize, bg: draftBg ? 'rgba(124,92,255,0.85)' : null,
    }]);
    setDraftText(''); setDraftBg(false); setTextModal(false);
  };

  const addSticker = (emoji) => {
    setLayers((ls) => [...ls, { id: nextId++, type: 'sticker', emoji, x: box.w / 2 - 20, y: box.h / 2 - 20, size: 56 }]);
    setStickerOpen(false);
  };

  // Drawing capture (only active in draw mode)
  const drawPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setCurrent({ color: drawColor, width: drawWidth, points: [pt(e)] }),
      onPanResponderMove: (e) => setCurrent((c) => c ? { ...c, points: [...c.points, pt(e)] } : c),
      onPanResponderRelease: () => {
        setCurrent((c) => { if (c && c.points.length > 1) setStrokes((s) => [...s, c]); return null; });
      },
    })
  ).current;
  function pt(e) { return { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }; }

  const undo = () => {
    if (mode === 'draw' && strokes.length) { setStrokes((s) => s.slice(0, -1)); return; }
    if (layers.length) setLayers((ls) => ls.slice(0, -1));
    else if (strokes.length) setStrokes((s) => s.slice(0, -1));
  };

  // Serialize to normalized overlay and return to Create.
  const done = () => {
    const W = box.w, H = box.h;
    const out = [];
    for (const l of layers) {
      if (l.type === 'text') {
        out.push({ type: 'text', x: (l.x + 60) / W, y: (l.y + l.fontSize / 2) / H, text: l.text, color: l.color, fontSize: l.fontSize / H, bg: l.bg, align: 'center' });
      } else {
        out.push({ type: 'sticker', x: (l.x + l.size / 2) / W, y: (l.y + l.size / 2) / H, emoji: l.emoji, size: l.size / H });
      }
    }
    for (const s of strokes) {
      out.push({ type: 'draw', color: s.color, width: s.width / W, points: s.points.map((p) => ({ x: p.x / W, y: p.y / H })) });
    }
    navigation.navigate({ name: 'CreateMain', params: { overlay: { layers: out } }, merge: true });
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.canvas}
        onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      >
        <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="cover" nativeControls={false} />

        {/* committed strokes + current stroke */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {strokes.map((s, i) => (
            <Polyline key={i} points={s.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {current && (
            <Polyline points={current.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={current.color} strokeWidth={current.width} strokeLinejoin="round" strokeLinecap="round" />
          )}
        </Svg>

        {/* text + sticker layers */}
        {layers.map((l) => <DraggableLayer key={l.id} layer={l} onMove={onLayerMove} />)}

        {/* draw capture layer */}
        {mode === 'draw' && <View {...drawPan.panHandlers} style={StyleSheet.absoluteFill} />}
      </View>

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topRight}>
          <ToolBtn icon="text" active={false} onPress={() => setTextModal(true)} />
          <ToolBtn icon="happy-outline" onPress={() => setStickerOpen(true)} />
          <ToolBtn icon="brush" active={mode === 'draw'} onPress={() => setMode((m) => m === 'draw' ? 'none' : 'draw')} />
          <ToolBtn icon="arrow-undo" onPress={undo} />
        </View>
      </View>

      {/* Done */}
      <TouchableOpacity style={[styles.doneBtn, { top: insets.top + 8 }]} onPress={done}>
        <Text style={styles.doneText}>Done</Text>
      </TouchableOpacity>

      {/* Draw controls */}
      {mode === 'draw' && (
        <View style={[styles.drawBar, { bottom: insets.bottom + 16 }]}>
          <View style={styles.swatchRow}>
            {COLORS.map((c) => (
              <TouchableOpacity key={c} onPress={() => setDrawColor(c)} style={[styles.swatch, { backgroundColor: c }, drawColor === c && styles.swatchActive]} />
            ))}
          </View>
          <Slider style={{ width: '90%' }} minimumValue={2} maximumValue={24} value={drawWidth} onValueChange={setDrawWidth} minimumTrackTintColor="#7C5CFF" maximumTrackTintColor="rgba(255,255,255,0.4)" thumbTintColor="#fff" />
        </View>
      )}

      {/* Sticker palette */}
      {stickerOpen && (
        <View style={[styles.stickerBar, { bottom: insets.bottom + 16 }]}>
          {EMOJIS.map((e) => (
            <TouchableOpacity key={e} onPress={() => addSticker(e)} style={styles.stickerBtn}>
              <Text style={{ fontSize: 30 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Text editor modal */}
      <Modal visible={textModal} transparent animationType="fade" onRequestClose={() => setTextModal(false)}>
        <View style={styles.textModalBg}>
          <TextInput
            style={[styles.textInput, { color: draftColor, fontSize: draftSize, backgroundColor: draftBg ? 'rgba(124,92,255,0.85)' : 'transparent' }]}
            value={draftText} onChangeText={setDraftText} placeholder="Type…" placeholderTextColor="rgba(255,255,255,0.5)"
            autoFocus multiline
          />
          <View style={styles.textControls}>
            <View style={styles.swatchRow}>
              {COLORS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setDraftColor(c)} style={[styles.swatch, { backgroundColor: c }, draftColor === c && styles.swatchActive]} />
              ))}
            </View>
            <Slider style={{ width: '90%' }} minimumValue={18} maximumValue={64} value={draftSize} onValueChange={setDraftSize} minimumTrackTintColor="#7C5CFF" maximumTrackTintColor="rgba(255,255,255,0.4)" thumbTintColor="#fff" />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setDraftBg((b) => !b)} style={[styles.bgToggle, draftBg && styles.bgToggleOn]}>
                <Ionicons name="color-fill" size={16} color="#fff" />
                <Text style={styles.bgToggleText}>Highlight</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTextModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={addText} style={styles.addBtn}><Text style={styles.addText}>Add</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToolBtn({ icon, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.iconBtn, active && { backgroundColor: '#7C5CFF' }]}>
      <Ionicons name={icon} size={20} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  canvas: { flex: 1, overflow: 'hidden' },
  layer: { position: 'absolute' },
  layerText: { fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  topBar: { position: 'absolute', left: 12, right: 90, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 },
  topRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  doneBtn: { position: 'absolute', right: 12, backgroundColor: '#7C5CFF', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, zIndex: 11 },
  doneText: { color: '#fff', fontWeight: '800' },
  drawBar: { position: 'absolute', left: 12, right: 12, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, paddingVertical: 12, gap: 8 },
  swatchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#fff' },
  stickerBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 12 },
  stickerBtn: { padding: 6 },
  textModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  textInput: { color: '#fff', fontWeight: '800', textAlign: 'center', minWidth: 200, maxWidth: '90%' },
  textControls: { position: 'absolute', bottom: 50, left: 20, right: 20, gap: 12, alignItems: 'center' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bgToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bgToggleOn: { backgroundColor: '#7C5CFF' },
  bgToggleText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  cancelText: { color: '#fff', fontWeight: '700' },
  addBtn: { backgroundColor: '#7C5CFF', borderRadius: 18, paddingHorizontal: 22, paddingVertical: 10 },
  addText: { color: '#fff', fontWeight: '800' },
});
