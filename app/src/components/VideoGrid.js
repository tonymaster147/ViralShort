import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { colors } from '../theme/colors';

const { width } = Dimensions.get('window');
const TILE = (width - 6) / 3;

export function GridTile({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={() => onPress?.(item)}>
      {item.thumbUrl ? (
        <Image source={{ uri: item.thumbUrl }} style={styles.tileImg} />
      ) : (
        <View style={[styles.tileImg, styles.tileFallback]}><Text style={styles.tilePlay}>▶</Text></View>
      )}
      <Text style={styles.tileViews}>👁 {item.views}</Text>
    </TouchableOpacity>
  );
}

// Standalone grid (used inside scroll containers via ListHeaderComponent etc).
export default function VideoGrid({ videos, onPressVideo, header, empty }) {
  return (
    <FlatList
      data={videos}
      keyExtractor={(v) => String(v.id)}
      numColumns={3}
      renderItem={({ item }) => <GridTile item={item} onPress={onPressVideo} />}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={{ gap: 3, paddingHorizontal: 3 }}
      contentContainerStyle={{ gap: 3, paddingBottom: 30 }}
    />
  );
}

const styles = StyleSheet.create({
  tile: { width: TILE, height: TILE * 1.4, backgroundColor: colors.card, borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  tileImg: { ...StyleSheet.absoluteFillObject, width: TILE, height: TILE * 1.4 },
  tileFallback: { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tilePlay: { color: colors.textMuted, fontSize: 28 },
  tileViews: { color: colors.text, fontSize: 11, padding: 4, fontWeight: '600' },
});
