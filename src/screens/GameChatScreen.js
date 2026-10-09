import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function GameChatScreen({ game, userId, onClose }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const listRef = useRef(null);

  async function fetchMessages() {
    if (!game) return;

    const { data } = await supabase
      .from('game_chat')
      .select('chat_id, sender_id, message, sent_at, users(full_name)')
      .eq('game_id', game.game_id)
      .order('sent_at', { ascending: true });

    setMessages(data || []);
  }

  useEffect(() => {
    async function init() {
      await fetchMessages();
      setLoading(false);
    }
    init();
  }, [game]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMessages();
    setRefreshing(false);
  };

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setDraft('');

    const { error } = await supabase
      .from('game_chat')
      .insert({
        game_id: game.game_id,
        sender_id: userId,
        message: text,
      });

    if (error) {
      setDraft(text); // restore so the message isn't lost
    } else {
      await fetchMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }

    setSending(false);
  }

  if (!game) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-down" size={22} color={COLORS.snow} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{game.title}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {game.parks?.name || 'Game chat'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.chat_id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary}
                colors={[COLORS.primary]}
                progressBackgroundColor={COLORS.inkRaised}
              />
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyMark} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>Say hello to the other players</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMine = item.sender_id === userId;
              const prev = messages[index - 1];
              const showName = !isMine && (!prev || prev.sender_id !== item.sender_id);

              return (
                <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
                  <View style={{ maxWidth: '78%' }}>
                    {showName && (
                      <Text style={styles.senderName}>
                        {item.users?.full_name || 'Player'}
                      </Text>
                    )}
                    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.messageText, isMine && styles.messageTextMine]}>
                        {item.message}
                      </Text>
                    </View>
                    <Text style={[styles.timestamp, isMine && styles.timestampMine]}>
                      {formatTime(item.sent_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message the group"
            placeholderTextColor={COLORS.neutral400}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!draft.trim() || sending}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={draft.trim() ? COLORS.ink : COLORS.mute}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 14,
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.cardFill,
    borderWidth: 1, borderColor: COLORS.line,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.snow, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, color: COLORS.mute, marginTop: 2 },

  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  bubbleRow: { marginBottom: 12, alignItems: 'flex-start' },
  bubbleRowMine: { alignItems: 'flex-end' },
  senderName: {
    fontSize: 11, fontWeight: '800', color: COLORS.primary,
    marginBottom: 5, marginLeft: 4, letterSpacing: 0.3,
  },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleTheirs: {
    backgroundColor: COLORS.cardFill,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 6 },
  messageText: { fontSize: 15, color: COLORS.snow, lineHeight: 21 },
  messageTextMine: { color: COLORS.ink, fontWeight: '500' },
  timestamp: { fontSize: 10, color: COLORS.faint, marginTop: 4, marginLeft: 6 },
  timestampMine: { textAlign: 'right', marginRight: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyMark: {
    width: 13, height: 13, backgroundColor: COLORS.primary,
    borderRadius: 3, transform: [{ rotate: '45deg' }], marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.snow },
  emptyText: { fontSize: 14, color: COLORS.mute, marginTop: 6 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 24,
    borderTopWidth: 1, borderTopColor: COLORS.line,
    backgroundColor: COLORS.inkRaised,
  },
  input: {
    flex: 1, maxHeight: 110, minHeight: 44,
    backgroundColor: COLORS.inkRaised, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontSize: 15, color: COLORS.snow,
    borderWidth: 1, borderColor: COLORS.line,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 15, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: COLORS.neutral200 },
});