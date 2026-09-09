import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';

function timeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function MessagesScreen({ userId, onOpenChat }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchThreads() {
    const { data: orgGames } = await supabase
      .from('games')
      .select('*, parks(name)')
      .eq('organizer_id', userId);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('games(*, parks(name))')
      .eq('player_id', userId);

    const joined = (bookings || []).map((b) => b.games).filter(Boolean);

    const byId = {};
    [...(orgGames || []), ...joined].forEach((g) => {
      if (g) byId[g.game_id] = g;
    });
    const games = Object.values(byId);

    if (games.length === 0) {
      setThreads([]);
      return;
    }

    const { data: chats } = await supabase
      .from('game_chat')
      .select('game_id, message, sent_at, users(full_name)')
      .in('game_id', games.map((g) => g.game_id))
      .order('sent_at', { ascending: false });

    const latest = {};
    (chats || []).forEach((c) => {
      if (!latest[c.game_id]) latest[c.game_id] = c;
    });

    const withMessages = games.map((g) => ({
      ...g,
      lastMessage: latest[g.game_id] || null,
    }));

    withMessages.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.sent_at).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.sent_at).getTime() : 0;
      return bTime - aTime;
    });

    setThreads(withMessages);
  }

  useEffect(() => {
    async function init() {
      await fetchThreads();
      setLoading(false);
    }
    if (userId) init();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchThreads();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Messages" subtitle="Chats for your games" />

      <FlatList
        data={threads}
        keyExtractor={(item) => item.game_id}
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
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyMark} />
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>Join or start a run to talk to your squad</Text>
          </View>
        }
        renderItem={({ item }) => {
          const unreadish = !!item.lastMessage;

          return (
            <TouchableOpacity
              style={styles.thread}
              activeOpacity={0.85}
              onPress={() => onOpenChat(item)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>{sportEmoji(item.sport)}</Text>
              </View>

              <View style={styles.threadBody}>
                <View style={styles.threadTop}>
                  <Text style={styles.threadTitle} numberOfLines={1}>{item.title}</Text>
                  {item.lastMessage && (
                    <Text style={styles.threadTime}>{timeAgo(item.lastMessage.sent_at)}</Text>
                  )}
                </View>

                <Text
                  style={[styles.threadPreview, !unreadish && styles.threadPreviewIdle]}
                  numberOfLines={1}
                >
                  {item.lastMessage
                    ? `${item.lastMessage.users?.full_name?.split(' ')[0] || 'Player'}: ${item.lastMessage.message}`
                    : `${formatSport(item.sport)} at ${item.parks?.name || 'the park'}`}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={COLORS.neutral400} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.ink,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },

  thread: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardFill,
    borderRadius: 16, padding: 13, marginBottom: 9,
    borderWidth: 1, borderColor: COLORS.line,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: COLORS.limeDim,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    borderWidth: 1, borderColor: 'rgba(215,255,62,0.18)',
  },
  avatarEmoji: { fontSize: 21 },

  threadBody: { flex: 1, marginRight: 8 },
  threadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  threadTitle: {
    fontSize: 15, fontWeight: '700', color: COLORS.snow,
    flex: 1, letterSpacing: -0.2,
  },
  threadTime: {
    fontSize: 10.5, color: COLORS.mute, marginLeft: 8,
    fontWeight: '700', letterSpacing: 0.5,
  },
  threadPreview: { fontSize: 13, color: COLORS.neutral600, marginTop: 4 },
  threadPreviewIdle: { color: COLORS.mute, fontStyle: 'italic' },

  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyMark: {
    width: 14, height: 14, backgroundColor: COLORS.primary,
    borderRadius: 3, transform: [{ rotate: '45deg' }], marginBottom: 18,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.snow },
  emptyText: { fontSize: 14, color: COLORS.mute, marginTop: 6 },
});