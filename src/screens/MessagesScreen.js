import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatSport } from '../utils/format';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { kickoffPill, sportIcon } from '../utils/chat';
import { fetchHiddenGameIds, hideGame, REMOVE_TITLE, removeMessage } from '../lib/hiddenGames';

/* Red "Remove" button revealed when a played chat is swiped left. */
function RemoveAction({ drag, onPress }) {
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + 88 }],
  }));

  return (
    <Reanimated.View style={slide}>
      <TouchableOpacity style={styles.swipeAction} onPress={onPress} activeOpacity={0.85}>
        <Ionicons name="trash-outline" size={22} color={COLORS.white} />
        <Text style={styles.swipeActionText}>Remove</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

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
    const hidden = await fetchHiddenGameIds(userId);

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
      if (g && !hidden.has(g.game_id)) byId[g.game_id] = g;
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

    // Upcoming games first, soonest at the top. Played games sink to the bottom.
    const now = Date.now();
    withMessages.sort((a, b) => {
      const aStart = new Date(a.start_time).getTime();
      const bStart = new Date(b.start_time).getTime();
      const aPast = aStart < now;
      const bPast = bStart < now;

      if (aPast !== bPast) return aPast ? 1 : -1;
      if (aPast) return bStart - aStart;  // most recently played first
      return aStart - bStart;             // soonest kickoff first
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

  function confirmRemove(game) {
    Alert.alert(REMOVE_TITLE, removeMessage(game.title), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const problem = await hideGame(userId, game.game_id);
          if (problem) {
            Alert.alert('Could not remove', problem);
            return;
          }
          setThreads((list) => list.filter((t) => t.game_id !== game.game_id));
        },
      },
    ]);
  }

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

  const firstPast = threads.findIndex((t) => new Date(t.start_time).getTime() < Date.now());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSub}>Chats for your games</Text>
      </View>

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
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>Join or start a game and its chat shows up here.</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const hasMessage = !!item.lastMessage;
          const pill = kickoffPill(item.start_time);
          const past = pill?.tone === 'past';
          // Section headings: upcoming games come first, played ones after (fetchThreads sorts them)
          const heading = index === 0 && !past ? 'Coming up' : index === firstPast ? 'Played' : null;

          const row = (
            <TouchableOpacity
              style={[styles.thread, past && styles.threadPast]}
              activeOpacity={0.85}
              onPress={() => onOpenChat(item)}
              onLongPress={past ? () => confirmRemove(item) : undefined}
              accessibilityLabel={`${item.title} chat${hasMessage ? `, latest: ${item.lastMessage.message}` : ''}`}
            >
              <View style={[styles.tile, past && styles.tilePast]}>
                <Ionicons name={sportIcon(item.sport)} size={22} color={past ? COLORS.neutral600 : COLORS.primary} />
              </View>

              <View style={styles.threadBody}>
                <View style={styles.threadTop}>
                  <Text style={[styles.threadTitle, past && styles.textPast]} numberOfLines={1}>{item.title}</Text>
                  {hasMessage && <Text style={styles.threadTime}>{timeAgo(item.lastMessage.sent_at)}</Text>}
                </View>

                <Text style={[styles.threadPreview, !hasMessage && styles.threadPreviewIdle]} numberOfLines={1}>
                  {hasMessage
                    ? `${item.lastMessage.users?.full_name?.split(' ')[0] || 'Player'}: ${item.lastMessage.message}`
                    : `${formatSport(item.sport)} at ${item.parks?.name || 'the park'}`}
                </Text>

                {pill && (
                  <Text style={[styles.pill, styles[`pill_${pill.tone}`]]}>{pill.text}</Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={18} color={COLORS.neutral400} />
            </TouchableOpacity>
          );

          // Only played games can be removed: swipe left, or press and hold.
          const body = !past ? row : (
            <ReanimatedSwipeable
              friction={2}
              rightThreshold={40}
              overshootRight={false}
              renderRightActions={(progress, drag) => (
                <RemoveAction drag={drag} onPress={() => confirmRemove(item)} />
              )}
            >
              {row}
            </ReanimatedSwipeable>
          );

          return (
            <>
              {heading && <Text style={styles.sectionTitle}>{heading}</Text>}
              {body}
            </>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ink },

  header: { paddingTop: 62, paddingHorizontal: 20, paddingBottom: 4 },
  headerTitle: { fontFamily: FONTS.display, fontSize: 32, lineHeight: 38, color: COLORS.snow, letterSpacing: -0.4 },
  headerSub: { fontSize: 14, color: COLORS.mute, marginTop: 2 },

  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120 },
  sectionTitle: { fontFamily: FONTS.displaySemi, fontSize: 20, color: COLORS.snow, marginTop: 16, marginBottom: 10 },

  thread: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.cardFill, borderRadius: 18, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.line,
  },
  // Played chats stay greyed out
  threadPast: { backgroundColor: 'rgba(23,32,25,0.05)', borderColor: 'rgba(23,32,25,0.06)' },

  tile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.sage },
  tilePast: { backgroundColor: 'rgba(23,32,25,0.08)' },

  threadBody: { flex: 1 },
  threadTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  threadTitle: { fontFamily: FONTS.displaySemi, fontSize: 16.5, lineHeight: 21, color: COLORS.snow, flex: 1 },
  textPast: { color: COLORS.neutral600 },
  threadTime: { fontSize: 11.5, color: COLORS.mute, marginLeft: 8, fontWeight: '700' },
  threadPreview: { fontSize: 13.5, color: COLORS.neutral700, marginTop: 3 },
  threadPreviewIdle: { color: COLORS.mute, fontStyle: 'italic' },

  pill: {
    alignSelf: 'flex-start', marginTop: 7, fontSize: 11, fontWeight: '800',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  pill_soon: { color: COLORS.clay, backgroundColor: COLORS.clayLight },
  pill_later: { color: COLORS.primary, backgroundColor: COLORS.sage },
  pill_past: { color: COLORS.neutral600, backgroundColor: 'rgba(23,32,25,0.06)' },

  empty: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 30 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.sage, marginBottom: 16,
  },
  emptyTitle: { fontFamily: FONTS.displaySemi, fontSize: 22, color: COLORS.snow },
  emptyText: { fontSize: 14, color: COLORS.mute, marginTop: 6, textAlign: 'center', lineHeight: 20 },

  swipeAction: {
    backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center',
    width: 80, marginBottom: 10, marginLeft: 8, borderRadius: 18,
  },
  swipeActionText: { color: COLORS.white, fontWeight: '800', fontSize: 12, marginTop: 4 },
});
