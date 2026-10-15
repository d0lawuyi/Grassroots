import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { formatGameTime } from '../utils/format';
import { dayLabel, startsNewDay, initials } from '../utils/chat';

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
        <TouchableOpacity onPress={onClose} style={styles.backButton} accessibilityLabel="Close chat">
          <Ionicons name="chevron-down" size={22} color={COLORS.snow} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>{game.title}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {[game.parks?.name, game.start_time ? formatGameTime(game.start_time) : null].filter(Boolean).join(' · ') || 'Game chat'}
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
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={26} color={COLORS.primary} />
                </View>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>Say hello to the other players</Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMine = item.sender_id === userId;
              const prev = messages[index - 1];
              const newDay = startsNewDay(prev, item);
              // Name and initial only on the first message in a run from the same person
              const firstOfRun = !isMine && (newDay || !prev || prev.sender_id !== item.sender_id);
              const name = item.users?.full_name || 'Player';

              return (
                <View>
                  {newDay && (
                    <View style={styles.dayRow}>
                      <View style={styles.dayLine} />
                      <Text style={styles.dayText}>{dayLabel(item.sent_at)}</Text>
                      <View style={styles.dayLine} />
                    </View>
                  )}
                  <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
                    {!isMine && (
                      <View style={[styles.face, !firstOfRun && styles.faceHidden]}>
                        {firstOfRun && <Text style={styles.faceText}>{initials(name)}</Text>}
                      </View>
                    )}
                    <View style={{ maxWidth: '76%' }}>
                      {firstOfRun && <Text style={styles.senderName}>{name}</Text>}
                      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{item.message}</Text>
                      </View>
                      <Text style={[styles.timestamp, isMine && styles.timestampMine]}>{formatTime(item.sent_at)}</Text>
                    </View>
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
            accessibilityLabel="Send message"
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={draft.trim() ? COLORS.white : COLORS.mute}
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
    flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12,
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line, backgroundColor: COLORS.ink,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardFill,
    borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  headerTitle: { fontFamily: FONTS.displaySemi, fontSize: 19, lineHeight: 24, color: COLORS.snow },
  headerSubtitle: { fontSize: 12.5, color: COLORS.mute, marginTop: 2 },

  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  dayLine: { flex: 1, height: 1, backgroundColor: COLORS.line },
  dayText: { fontSize: 12, fontWeight: '700', color: COLORS.mute },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  face: {
    width: 30, height: 30, borderRadius: 15, marginTop: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.sage,
  },
  faceHidden: { backgroundColor: 'transparent', marginTop: 0 },
  faceText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  senderName: { fontSize: 12, fontWeight: '800', color: COLORS.primary, marginBottom: 4, marginLeft: 4 },

  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleTheirs: { backgroundColor: COLORS.cardFill, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: COLORS.line },
  bubbleMine: { backgroundColor: COLORS.forest, borderBottomRightRadius: 6 },
  messageText: { fontSize: 15, color: COLORS.snow, lineHeight: 21 },
  messageTextMine: { color: COLORS.white },
  timestamp: { fontSize: 10.5, color: COLORS.faint, marginTop: 4, marginLeft: 6 },
  timestampMine: { textAlign: 'right', marginRight: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.sage, marginBottom: 14,
  },
  emptyTitle: { fontFamily: FONTS.displaySemi, fontSize: 20, color: COLORS.snow },
  emptyText: { fontSize: 14, color: COLORS.mute, marginTop: 6 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 26,
    borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: COLORS.ink,
  },
  input: {
    flex: 1, maxHeight: 110, minHeight: 44,
    backgroundColor: COLORS.cardFill, borderRadius: 22,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontSize: 15, color: COLORS.snow, borderWidth: 1, borderColor: COLORS.line,
  },
  sendButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.forest,
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: COLORS.neutral200 },
});
