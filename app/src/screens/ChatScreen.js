import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { fetchMessages, sendMessage as sendMessageApi } from '../api/messages';
import { useSocket } from '../context/SocketContext';
import { colors } from '../theme/colors';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, user } = route.params;
  const headerHeight = useHeaderHeight();
  const { on, emit } = useSocket();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: user.displayName || user.username });
  }, [navigation, user]);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchMessages(conversationId));
    } finally { setLoading(false); }
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  // Live incoming messages for THIS conversation.
  useEffect(() => {
    const off = on('message:new', (data) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) => [...prev, data.message]);
      }
    });
    return off;
  }, [on, conversationId]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    // optimistic add
    const tempId = `temp_${Date.now()}`;
    const optimistic = { id: tempId, text: t, fromMe: true, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      // Prefer socket (instant); fall back to REST.
      emit('message:send', { conversationId, text: t }, (ack) => {
        if (ack?.ok) {
          setMessages((prev) => prev.map((m) => m.id === tempId ? ack.message : m));
        }
      });
    } catch (_) {
      try {
        const saved = await sendMessageApi(conversationId, t);
        setMessages((prev) => prev.map((m) => m.id === tempId ? saved : m));
      } catch (e) {
        // mark failed by removing optimistic
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.bubbleRow, item.fromMe ? styles.right : styles.left]}>
      <View style={[styles.bubble, item.fromMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={styles.bubbleText}>{item.text}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 14, paddingBottom: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hi 👋</Text>}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <TouchableOpacity onPress={send} disabled={!text.trim()} style={styles.sendBtn}>
          <Text style={[styles.sendText, !text.trim() && { opacity: 0.4 }]}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bubbleRow: { marginVertical: 4, flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleText: { color: colors.text, fontSize: 15 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
});
