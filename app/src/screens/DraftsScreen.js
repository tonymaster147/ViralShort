import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFocusEffect } from '@react-navigation/native';
import { listDrafts, deleteDraft } from '../api/drafts';
import { colors } from '../theme/colors';

function DraftTile({ draft, onOpen, onDelete }) {
  const player = useVideoPlayer(draft.videoUri, (p) => { p.muted = true; });
  const when = new Date(draft.updatedAt);
  return (
    <TouchableOpacity style={styles.tile} onPress={() => onOpen(draft)} onLongPress={() => onDelete(draft)}>
      <VideoView style={styles.thumb} player={player} contentFit="cover" nativeControls={false} />
      <View style={styles.tileInfo}>
        <Text style={styles.tileCaption} numberOfLines={1}>{draft.state?.caption || 'Untitled draft'}</Text>
        <Text style={styles.tileTime}>{when.toLocaleDateString()} {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <TouchableOpacity onPress={() => onDelete(draft)} style={styles.del}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function DraftsScreen({ navigation }) {
  const [drafts, setDrafts] = useState([]);

  const load = useCallback(async () => { setDrafts(await listDrafts()); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onOpen = (draft) => navigation.navigate('CreateMain', { draft });
  const onDelete = (draft) => {
    Alert.alert('Delete draft?', 'This removes the saved draft.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDraft(draft.id); load(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={drafts}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => <DraftTile draft={item} onOpen={onOpen} onDelete={onDelete} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={54} color={colors.textMuted} />
            <Text style={styles.emptyText}>No drafts yet</Text>
            <Text style={styles.emptySub}>Tap "Save draft" while creating a reel to keep it for later.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tile: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 10, marginBottom: 10, gap: 12 },
  thumb: { width: 54, height: 72, borderRadius: 8, backgroundColor: '#000' },
  tileInfo: { flex: 1 },
  tileCaption: { color: colors.text, fontWeight: '700' },
  tileTime: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  del: { padding: 8 },
  empty: { alignItems: 'center', marginTop: 90, paddingHorizontal: 40 },
  emptyText: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 14 },
  emptySub: { color: colors.textMuted, textAlign: 'center', marginTop: 6 },
});
