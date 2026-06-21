import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TextInput, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { fetchComments, fetchReplies, addComment } from '../api/social';
import { colors } from '../theme/colors';

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Avatar({ user, size = 36 }) {
  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();
  if (user.avatar) {
    return <Image source={{ uri: user.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: colors.text, fontWeight: '800' }}>{initial}</Text>
    </View>
  );
}

function CommentRow({ item, onReply, onShowReplies, replies, showReplies, loadingReplies }) {
  return (
    <View style={styles.commentRow}>
      <Avatar user={item.user} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.cUser}>
          {item.user.displayName || item.user.username}{' '}
          <Text style={styles.cTime}>· {timeAgo(item.createdAt)}</Text>
        </Text>
        <Text style={styles.cText}>{item.text}</Text>
        <View style={styles.cActions}>
          <TouchableOpacity onPress={() => onReply(item)}>
            <Text style={styles.cReply}>Reply</Text>
          </TouchableOpacity>
          {item.replyCount > 0 && (
            <TouchableOpacity onPress={() => onShowReplies(item.id)}>
              <Text style={styles.cReply}>
                {showReplies ? 'Hide' : `View ${item.replyCount}`} repl{item.replyCount > 1 ? 'ies' : 'y'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showReplies && (
          loadingReplies ? <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} /> :
          (replies || []).map((r) => (
            <View key={r.id} style={styles.replyRow}>
              <Avatar user={r.user} size={28} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.cUser}>
                  {r.user.displayName || r.user.username}{' '}
                  <Text style={styles.cTime}>· {timeAgo(r.createdAt)}</Text>
                </Text>
                <Text style={styles.cText}>{r.text}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

export default function CommentsSheet({ visible, videoId, onClose, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [repliesMap, setRepliesMap] = useState({});   // commentId -> replies[]
  const [openReplies, setOpenReplies] = useState({});  // commentId -> bool
  const [loadingReplies, setLoadingReplies] = useState({});

  const load = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    try {
      setComments(await fetchComments(videoId));
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { if (visible) load(); }, [visible, load]);

  const onShowReplies = async (commentId) => {
    const willOpen = !openReplies[commentId];
    setOpenReplies((m) => ({ ...m, [commentId]: willOpen }));
    if (willOpen && !repliesMap[commentId]) {
      setLoadingReplies((m) => ({ ...m, [commentId]: true }));
      try {
        const r = await fetchReplies(commentId);
        setRepliesMap((m) => ({ ...m, [commentId]: r }));
      } finally {
        setLoadingReplies((m) => ({ ...m, [commentId]: false }));
      }
    }
  };

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      const newComment = await addComment(videoId, t, replyTo?.id || null);
      setText('');
      if (replyTo) {
        // refresh that thread's replies + bump count
        setRepliesMap((m) => ({ ...m, [replyTo.id]: [...(m[replyTo.id] || []), newComment] }));
        setOpenReplies((m) => ({ ...m, [replyTo.id]: true }));
        setComments((cs) => cs.map((c) => c.id === replyTo.id ? { ...c, replyCount: c.replyCount + 1 } : c));
        setReplyTo(null);
      } else {
        setComments((cs) => [newComment, ...cs]);
        onCountChange?.(1);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{comments.length} comments</Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => String(c.id)}
              renderItem={({ item }) => (
                <CommentRow
                  item={item}
                  onReply={setReplyTo}
                  onShowReplies={onShowReplies}
                  replies={repliesMap[item.id]}
                  showReplies={!!openReplies[item.id]}
                  loadingReplies={!!loadingReplies[item.id]}
                />
              )}
              ListEmptyComponent={<Text style={styles.empty}>Be the first to comment!</Text>}
              style={{ flexGrow: 0, maxHeight: 380 }}
            />
          )}

          {replyTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText}>Replying to @{replyTo.user.username}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Text style={styles.replyCancel}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity onPress={send} disabled={sending || !text.trim()}>
              <Text style={[styles.post, (!text.trim() || sending) && { opacity: 0.4 }]}>Post</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 8 },
  title: { color: colors.text, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  commentRow: { flexDirection: 'row', marginBottom: 16 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  cUser: { color: colors.text, fontWeight: '700', fontSize: 13 },
  cTime: { color: colors.textMuted, fontWeight: '400', fontSize: 12 },
  cText: { color: colors.text, marginTop: 2 },
  cActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  cReply: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  replyRow: { flexDirection: 'row', marginTop: 12 },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 24 },
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.card, padding: 8, borderRadius: 8, marginBottom: 6 },
  replyBannerText: { color: colors.textMuted, fontSize: 12 },
  replyCancel: { color: colors.textMuted, fontWeight: '800' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  input: { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: colors.text },
  post: { color: colors.primary, fontWeight: '800', marginLeft: 12 },
});
