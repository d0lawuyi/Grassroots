import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { cancelGameReminders } from '../lib/notifications';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { countPlayers, soonestFirst, fillLabel, fillFraction, calendarTile } from '../utils/myGames';
import NextUpCard from '../components/NextUpCard';
import { openDirections } from '../utils/directions';
import { fetchHiddenGameIds, hideGame, REMOVE_TITLE, removeMessage } from '../lib/hiddenGames';

export default function MyGamesScreen({ userId, onSelectGame, onRateGame, onOpenSeries }) {
  const [sections, setSections] = useState([]);
  const [nextUp, setNextUp] = useState(null);
  const [nextUpPlayers, setNextUpPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [players, setPlayers] = useState({}); // game_id -> how many joined, for the fill bars

  async function fetchMyGames(showSpinner = true) {
    if (showSpinner) setLoading(true);
    const now = new Date().toISOString();

    const hidden = await fetchHiddenGameIds(userId);

    const { data: bookings } = await supabase
      .from('bookings')
      .select('rating_given, games(*, parks(name, latitude, longitude))')
      .eq('player_id', userId);

    const joined = (bookings || [])
      .filter((b) => b.games)
      .map((b) => ({ ...b.games, myRating: b.rating_given }));

    const { data: orgGames } = await supabase
      .from('games')
      .select('*, parks(name, latitude, longitude)')
      .eq('organizer_id', userId);

    const organizing = soonestFirst((orgGames || []).filter((g) => g.start_time >= now));
    const joinedUpcoming = soonestFirst(joined.filter((g) => g.start_time >= now));

    // Player counts for the fill bars on upcoming cards
    const upcomingIds = [...new Set([...organizing, ...joinedUpcoming].map((g) => g.game_id))];
    if (upcomingIds.length) {
      const { data: counts } = await supabase.from('bookings').select('game_id').in('game_id', upcomingIds);
      setPlayers(countPlayers(counts));
    } else {
      setPlayers({});
    }

    const pastById = {};
    [...(orgGames || []).filter((g) => g.start_time < now), ...joined.filter((g) => g.start_time < now)]
      .forEach((g) => {
        pastById[g.game_id] = { ...(pastById[g.game_id] || {}), ...g };
      });
    const past = Object.values(pastById).filter((g) => !hidden.has(g.game_id)).sort(
      (a, b) => new Date(b.start_time) - new Date(a.start_time)
    );

    setSections([
      { title: 'Organizing', data: organizing },
      { title: 'Joined', data: joinedUpcoming },
      { title: 'Past', data: past },
    ]);

    // Soonest upcoming game becomes the hero card
    const upcomingById = {};
    [...organizing, ...joinedUpcoming].forEach((g) => {
      upcomingById[g.game_id] = g;
    });
    const soonest = Object.values(upcomingById).sort(
      (a, b) => new Date(a.start_time) - new Date(b.start_time)
    )[0];

    setNextUp(soonest || null);

    if (soonest) {
      const { data: roster } = await supabase
        .from('bookings')
        .select('player_id, users(full_name)')
        .eq('game_id', soonest.game_id)
        .order('joined_at', { ascending: true });

      const mapped = (roster || []).map((r) => ({
        full_name: r.users?.full_name || 'Player',
        isYou: r.player_id === userId,
      }));

      // Put "you" first so the lime avatar leads the row
      mapped.sort((a, b) => (b.isYou ? 1 : 0) - (a.isYou ? 1 : 0));
      setNextUpPlayers(mapped);
    } else {
      setNextUpPlayers([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (userId) fetchMyGames();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMyGames(false);
    setRefreshing(false);
  };

  function confirmLeave(game) {
    Alert.alert(
      'Leave this game?',
      `You'll give up your spot in "${game.title}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => leaveGame(game) },
      ]
    );
  }

  async function leaveGame(game) {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('player_id', userId)
      .eq('game_id', game.game_id);
    await cancelGameReminders(game.game_id);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    await fetchMyGames(false);
  }

  function confirmDelete(game) {
    Alert.alert(
      'Delete this game?',
      `"${game.title}" will be removed for everyone who joined. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteGame(game) },
      ]
    );
  }

  async function deleteGame(game) {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('game_id', game.game_id)
      .eq('organizer_id', userId);

    if (error) {
      Alert.alert('Could not delete', error.message);
      return;
    }
    await fetchMyGames(false);
  }

  // Played games only: hides the game and its chat for this user.
  function confirmRemove(game) {
    Alert.alert(REMOVE_TITLE, removeMessage(game.title), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeGame(game) },
    ]);
  }

  async function removeGame(game) {
    const problem = await hideGame(userId, game.game_id);
    if (problem) {
      Alert.alert('Could not remove', problem);
      return;
    }
    await fetchMyGames(false);
  }

  const SWIPE = {
    delete: { icon: 'trash-outline', label: 'Delete', run: (g) => confirmDelete(g) },
    leave: { icon: 'exit-outline', label: 'Leave', run: (g) => confirmLeave(g) },
    remove: { icon: 'trash-outline', label: 'Remove', run: (g) => confirmRemove(g) },
  };

  function RightAction({ drag, game, action }) {
    const styleAnimation = useAnimatedStyle(() => ({
      transform: [{ translateX: drag.value + 98 }],
    }));

    return (
      <Reanimated.View style={styleAnimation}>
        <TouchableOpacity
          style={styles.swipeAction}
          onPress={() => SWIPE[action].run(game)}
          activeOpacity={0.85}
        >
          <Ionicons name={SWIPE[action].icon} size={22} color={COLORS.white} />
          <Text style={styles.swipeActionText}>{SWIPE[action].label}</Text>
        </TouchableOpacity>
      </Reanimated.View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const hasAny = sections.some((sec) => sec.data.length > 0);
  const hasUpcoming = sections.some((sec) => sec.title !== 'Past' && sec.data.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My games</Text>
        <TouchableOpacity style={styles.weeklyPill} onPress={onOpenSeries} accessibilityLabel="Your weekly games">
          <Ionicons name="repeat" size={15} color={COLORS.primary} />
          <Text style={styles.weeklyText}>Weekly</Text>
        </TouchableOpacity>
      </View>

      {!hasAny ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No games coming up</Text>
          <Text style={styles.emptySubtitle}>Join one in Explore or start your own with the + button.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.game_id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 120 }}
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
          ListHeaderComponent={
            <>
              <NextUpCard
                game={nextUp}
                players={nextUpPlayers}
                onOpen={() => nextUp && onSelectGame(nextUp)}
                onOpenChat={() => nextUp && onSelectGame(nextUp)}
                onDirections={() => nextUp && openDirections(nextUp.parks)}
              />
              {!hasUpcoming && (
                <Text style={styles.noneUpcoming}>No games coming up. Join one in Explore or start your own.</Text>
              )}
            </>
          }
          renderSectionHeader={({ section }) =>
            section.data.length > 0 ? (
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionCount}>
                  <Text style={styles.sectionCountText}>{section.data.length}</Text>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item, section }) => {
            const isPast = section.title === 'Past';
            const isOrganizing = section.title === 'Organizing';
            const swipeAction = isOrganizing ? 'delete' : section.title === 'Joined' ? 'leave' : 'remove';
            const tile = calendarTile(item.start_time);
            const joinedCount = players[item.game_id] || 0;
            const time = new Date(item.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            const level = item.skill_level ? item.skill_level[0].toUpperCase() + item.skill_level.slice(1) : null;

            const card = (
              <TouchableOpacity
                style={[styles.card, isPast && styles.cardPast]}
                onPress={() => onSelectGame(item)}
                activeOpacity={0.85}
                accessibilityLabel={`${item.title}, ${formatGameTime(item.start_time)}, ${item.parks?.name || 'Park'}`}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.tile, isPast && styles.tilePast]}>
                    <Text style={[styles.tileWeekday, isPast && styles.textPast]}>{tile.weekday}</Text>
                    <Text style={[styles.tileDay, isPast && styles.textPast]}>{tile.day}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, isPast && styles.textPast]} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.parks?.name || 'Park'} · {time}
                    </Text>
                    <View style={styles.tags}>
                      <Text style={[styles.tag, isPast && styles.tagPast]}>
                        {sportEmoji(item.sport)} {formatSport(item.sport)}
                      </Text>
                      {level && <Text style={[styles.tagQuiet, isPast && styles.tagPast]}>{level}</Text>}
                      {isOrganizing && <Text style={styles.tagOrganizer}>Organizer</Text>}
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={COLORS.neutral400} />
                </View>

                {!isPast && (
                  <View style={styles.fill}>
                    <View style={styles.fillTrack}>
                      <View style={[styles.fillBar, { width: `${fillFraction(joinedCount, item.max_players || 10) * 100}%` }]} />
                    </View>
                    <View style={styles.fillRow}>
                      <Text style={styles.fillText}>{fillLabel(joinedCount, item.max_players)}</Text>
                      <TouchableOpacity
                        onPress={() => (isOrganizing ? confirmDelete(item) : confirmLeave(item))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={isOrganizing ? `Delete ${item.title}` : `Leave ${item.title}`}
                      >
                        <Text style={styles.dangerLink}>{isOrganizing ? 'Delete game' : 'Leave game'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {isPast && (
                  <View style={styles.pastFooter}>
                    {item.myRating ? (
                      <View style={styles.ratedRow}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons
                            key={i}
                            name={item.myRating >= i ? 'star' : 'star-outline'}
                            size={15}
                            color={item.myRating >= i ? COLORS.neutral700 : COLORS.neutral300}
                          />
                        ))}
                        <Text style={styles.ratedText}>You rated this</Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.rateButton} onPress={() => onRateGame(item)} activeOpacity={0.8}>
                        <Ionicons name="star-outline" size={15} color={COLORS.white} />
                        <Text style={styles.rateText}>Rate this game</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.removeLink}
                      onPress={() => confirmRemove(item)}
                      activeOpacity={0.7}
                      accessibilityLabel={`Remove ${item.title} from your games`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={15} color={COLORS.neutral700} />
                      <Text style={styles.removeLinkText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );

            return (
              <ReanimatedSwipeable
                friction={2}
                rightThreshold={40}
                overshootRight={false}
                renderRightActions={(progress, drag) => (
                  <RightAction drag={drag} game={item} action={swipeAction} />
                )}
              >
                {card}
              </ReanimatedSwipeable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: COLORS.ink },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 62, paddingHorizontal: 20, paddingBottom: 10,
  },
  headerTitle: { fontFamily: FONTS.display, fontSize: 32, lineHeight: 38, color: COLORS.snow, letterSpacing: -0.4 },
  weeklyPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18,
    backgroundColor: COLORS.cardFill, borderWidth: 1, borderColor: COLORS.line,
  },
  weeklyText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },

  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.sage, marginBottom: 16,
  },
  emptyTitle: { fontFamily: FONTS.displaySemi, fontSize: 22, color: COLORS.snow },
  emptySubtitle: { fontSize: 14, color: COLORS.mute, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  noneUpcoming: { fontSize: 14, color: COLORS.mute, marginBottom: 8, lineHeight: 20 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 10 },
  sectionTitle: { fontFamily: FONTS.displaySemi, fontSize: 20, color: COLORS.snow },
  sectionCount: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.sage,
  },
  sectionCountText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },

  card: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.line,
  },
  // Played games stay greyed out
  cardPast: { backgroundColor: 'rgba(23,32,25,0.05)', borderColor: 'rgba(23,32,25,0.06)' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  tile: {
    width: 52, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.sage,
  },
  tilePast: { backgroundColor: 'rgba(23,32,25,0.08)' },
  tileWeekday: { color: COLORS.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 1 },
  tileDay: { fontFamily: FONTS.display, color: COLORS.primary, fontSize: 22, lineHeight: 26 },
  textPast: { color: COLORS.neutral600 },

  title: { fontFamily: FONTS.displaySemi, fontSize: 18, lineHeight: 23, color: COLORS.snow },
  meta: { fontSize: 13.5, color: COLORS.mute, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    fontSize: 11.5, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.limeDim,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  tagQuiet: {
    fontSize: 11.5, fontWeight: '600', color: COLORS.neutral600, backgroundColor: COLORS.neutral100,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  tagOrganizer: {
    fontSize: 11.5, fontWeight: '800', color: COLORS.clay, backgroundColor: COLORS.clayLight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  tagPast: { color: COLORS.neutral600, backgroundColor: 'rgba(23,32,25,0.06)' },

  fill: { marginTop: 12 },
  fillTrack: { height: 5, borderRadius: 3, backgroundColor: COLORS.neutral200, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 3, backgroundColor: COLORS.primary },
  fillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 7 },
  fillText: { fontSize: 12.5, color: COLORS.mute, fontWeight: '600' },
  dangerLink: { fontSize: 12.5, color: COLORS.danger, fontWeight: '700' },

  // Played games: rate (or your stars) on the left, Remove on the right
  pastFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  ratedRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratedText: { fontSize: 12, color: COLORS.mute, marginLeft: 7 },
  rateButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: COLORS.primary,
  },
  rateText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  removeLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  removeLinkText: { color: COLORS.neutral700, fontWeight: '700', fontSize: 13 },

  swipeAction: {
    backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center',
    width: 88, marginBottom: 12, borderRadius: 20, marginLeft: 10,
  },
  swipeActionText: { color: COLORS.white, fontWeight: '800', fontSize: 12, marginTop: 4 },
});
