import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient
      colors={[COLORS.canvasTop, COLORS.canvasMid, COLORS.canvasBottom]}
      style={styles.container}
    >
      <ScreenHeader title="Messages" subtitle="Chats for your games" />

      <FlatList
        data={threads}
        keyExtractor={(item) => item.game_id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>Join or create a game to start talking</Text>
          </View>
        }
        renderItem={({ item }) => (
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

              <Text style={styles.threadPreview} numberOfLines={1}>
                {item.lastMessage
                  ? `${item.lastMessage.users?.full_name?.split(' ')[0] || 'Player'}: ${item.lastMessage.message}`
                  : `${formatSport(item.sport)} at ${item.parks?.name || 'the park'}`}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={COLORS.neutral400} />
          </TouchableOpacity>
        )}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 },
  thread: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16, padding: 13, marginBottom: 9,
    borderWidth: 1, borderColor: COLORS.neutral200,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.softGreen,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarEmoji: { fontSize: 22 },
  threadBody: { flex: 1, marginRight: 8 },
  threadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  threadTitle: { fontSize: 15, fontWeight: '700', color: COLORS.neutral900, flex: 1 },
  threadTime: { fontSize: 11, color: COLORS.neutral400, marginLeft: 8 },
  threadPreview: { fontSize: 13, color: COLORS.muted, marginTop: 3 },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { fontSize: 42, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.neutral800 },
  emptyText: { fontSize: 14, color: COLORS.muted, marginTop: 4 },
});