import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { search as searchApi } from '../api/discover';
import { colors } from '../theme/colors';

// Search users and return the chosen @username via onPick.
export default function TagPeopleModal({ visible, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (!visible) { setQ(''); setUsers([]); return; }
  }, [visible]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) { setUsers([]); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try { const r = await searchApi(q.trim(), 'users'); setUsers(r.users || []); }
      catch (_) {} finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Tag people</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input} value={q} onChangeText={setQ} autoFocus autoCapitalize="none"
              placeholder="Search username" placeholderTextColor={colors.textMuted}
            />
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(u) => String(u.id)}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => {
                const initial = (item.displayName || item.username || '?').charAt(0).toUpperCase();
                return (
                  <TouchableOpacity style={styles.row} onPress={() => { onPick(item.username); onClose(); }}>
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.fallback]}><Text style={styles.init}>{initial}</Text></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.displayName || item.username}</Text>
                      <Text style={styles.handle}>@{item.username}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={q.trim() ? <Text style={styles.empty}>No users found</Text> : <Text style={styles.empty}>Type a username to tag</Text>}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 10 },
  heading: { color: colors.text, fontWeight: '800', fontSize: 18, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 10 },
  input: { flex: 1, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  fallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  init: { color: colors.text, fontWeight: '800' },
  name: { color: colors.text, fontWeight: '700' },
  handle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 24 },
});
