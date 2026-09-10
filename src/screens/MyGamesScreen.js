import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { cancelGameReminders } from '../lib/notifications';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';
import ScreenHeader from '../components/ScreenHeader';
import NextUpCard from '../components/NextUpCard';
import { openDirections } from '../utils/directions';

export default function MyGamesScreen({ userId, onSelectGame, onRateGame, onOpenSeries }) {
  const [sections, setSections] = useState([]);
  const [nextUp, setNextUp] = useState(null);
  const [nextUpPlayers, setNextUpPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchMyGames(showSpinner = true) {
    if (showSpinner) setLoading(true);
    const now = new Date().toISOString();

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

    const organizing = (orgGames || []).filter((g) => g.start_time >= now);
    const joinedUpcoming = joined.filter((g) => g.start_time >= now);

    const pastById = {};
    [...(orgGames || []).filter((g) => g.start_time < now), ...joined.filter((g) => g.start_time < now)]
      .forEach((g) => {
        pastById[g.game_id] = { ...(pastById[g.game_id] || {}), ...g };
      });
    const past = Object.values(pastById).sort(
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

  function RightAction({ drag, game, action }) {
    const styleAnimation = useAnimatedStyle(() => ({
      transform: [{ translateX: drag.value + 98 }],
    }));

    return (
      <Reanimated.View style={styleAnimation}>
        <TouchableOpacity
          style={styles.swipeAction}
          onPress={() => (action === 'delete' ? confirmDelete(game) : confirmLeave(game))}
          activeOpacity={0.85}
        >
          <Ionicons
            name={action === 'delete' ? 'trash-outline' : 'exit-outline'}
            size={22}
            color={COLORS.snow}
          />
          <Text style={styles.swipeActionText}>
            {action === 'delete' ? 'Delete' : 'Leave'}
          </Text>
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

  const hasAny = sections.some((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
            <ScreenHeader
        title="My Games"
        right={
          <TouchableOpacity onPress={onOpenSeries}>
            <Ionicons name="repeat" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        }
      />

      {!hasAny ? (
        <View style={styles.center}>
          <View style={styles.emptyMark} />
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptySubtitle}>Join or start a run from the Explore tab</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.game_id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 20 }}
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
            <NextUpCard
              game={nextUp}
              players={nextUpPlayers}
              onOpen={() => nextUp && onSelectGame(nextUp)}
              onOpenChat={() => nextUp && onSelectGame(nextUp)}
              onDirections={() => nextUp && openDirections(nextUp.parks)}
            />
          }
          
          renderSectionHeader={({ section }) =>
            section.data.length > 0 ? (
              <View style={styles.sectionHead}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionCount}>{section.data.length}</Text>
              </View>
            ) : null
          }
          renderItem={({ item, section }) => {
            const isPast = section.title === 'Past';
            const swipeAction =
              section.title === 'Organizing' ? 'delete' :
              section.title === 'Joined' ? 'leave' : null;

            const card = (
              <TouchableOpacity
                style={[styles.card, isPast && styles.cardPast]}
                onPress={() => onSelectGame(item)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.sportBadge}>
                      {sportEmoji(item.sport)} {formatSport(item.sport)}
                    </Text>
                    {item.skill_level && (
                      <Text style={styles.skillBadge}>
                        {item.skill_level.charAt(0).toUpperCase() + item.skill_level.slice(1)}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.neutral400} />
                </View>

                <Text style={styles.title}>{item.title}</Text>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={15} color={COLORS.neutral500} />
                  <Text style={styles.meta}>{item.parks?.name || 'Park'}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={15} color={COLORS.neutral500} />
                  <Text style={styles.meta}>{formatGameTime(item.start_time)}</Text>
                </View>

                {section.title === 'Joined' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => confirmLeave(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="exit-outline" size={16} color={COLORS.danger} />
                    <Text style={styles.actionTextDanger}>Leave game</Text>
                  </TouchableOpacity>
                )}

                {section.title === 'Organizing' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => confirmDelete(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                    <Text style={styles.actionTextDanger}>Delete game</Text>
                  </TouchableOpacity>
                )}

                {isPast && item.myRating ? (
                  <View style={styles.ratedRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Ionicons
                        key={i}
                        name={item.myRating >= i ? 'star' : 'star-outline'}
                        size={15}
                        color={item.myRating >= i ? COLORS.primary : COLORS.neutral300}
                      />
                    ))}
                    <Text style={styles.ratedText}>You rated this</Text>
                  </View>
                ) : isPast ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rateButton]}
                    onPress={() => onRateGame(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="star-outline" size={16} color={COLORS.ink} />
                    <Text style={styles.actionTextPrimary}>Rate this game</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );

            if (!swipeAction) return card;

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
  signOutText: { color: COLORS.mute, fontSize: 13, fontWeight: '600' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 40, backgroundColor: COLORS.ink,
  },

  emptyMark: {
    width: 15, height: 15, backgroundColor: COLORS.primary,
    borderRadius: 3, transform: [{ rotate: '45deg' }], marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.snow },
  emptySubtitle: { fontSize: 14, color: COLORS.mute, marginTop: 6, textAlign: 'center' },

  sectionHead: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14, marginTop: 10,
  },
  sectionBar: { width: 16, height: 2, backgroundColor: COLORS.primary, marginRight: 9 },
  sectionTitle: {
    fontSize: 10.5, fontWeight: '800', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 2.4,
  },
  sectionCount: {
    marginLeft: 'auto', fontSize: 11, fontWeight: '800',
    color: COLORS.mute, letterSpacing: 1,
  },

  card: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: COLORS.line,
  },
  cardPast: { backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(244,246,242,0.06)' },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sportBadge: {
    fontSize: 12, fontWeight: '800', color: COLORS.primary,
    backgroundColor: COLORS.limeDim, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  skillBadge: {
    fontSize: 11.5, fontWeight: '600', color: COLORS.neutral600,
    backgroundColor: COLORS.neutral100, paddingHorizontal: 9,
    paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  title: {
    fontSize: 18, fontWeight: '700', color: COLORS.snow,
    marginBottom: 8, letterSpacing: -0.4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  meta: { fontSize: 14, color: COLORS.neutral500, marginLeft: 6 },

  actionButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    marginTop: 14, paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)',
    backgroundColor: 'rgba(255,107,107,0.08)',
  },
  rateButton: {
    borderColor: COLORS.primary, backgroundColor: COLORS.primary,
  },
  actionTextDanger: { color: COLORS.danger, fontWeight: '700', fontSize: 13, marginLeft: 5 },
  actionTextPrimary: { color: COLORS.ink, fontWeight: '800', fontSize: 13, marginLeft: 5 },

  ratedRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 14 },
  ratedText: { fontSize: 12, color: COLORS.mute, marginLeft: 7 },

  swipeAction: {
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginBottom: 14,
    borderRadius: 20,
    marginLeft: 10,
  },
  swipeActionText: { color: COLORS.snow, fontWeight: '800', fontSize: 12, marginTop: 4 },
});