import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import ScreenHeader from '../components/ScreenHeader';

export default function MyGamesScreen({ userId, onSelectGame, onRateGame }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchMyGames(showSpinner = true) {
    if (showSpinner) setLoading(true);
    const now = new Date().toISOString();

    const { data: bookings } = await supabase
      .from('bookings')
      .select('rating_given, games(*, parks(name))')
      .eq('player_id', userId);

    const joined = (bookings || [])
      .filter((b) => b.games)
      .map((b) => ({ ...b.games, myRating: b.rating_given }));

    const { data: orgGames } = await supabase
      .from('games')
      .select('*, parks(name)')
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
            color={COLORS.white}
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
    <LinearGradient
      colors={[COLORS.canvasTop, COLORS.canvasMid, COLORS.canvasBottom]}
      style={styles.container}
    >
      <View style={styles.sproutWrap} pointerEvents="none">
        <Svg width={260} height={260} viewBox="0 0 300 300" fill="none">
          <Path d="M0 260 Q150 225 300 260 L300 320 L0 320 Z" fill={COLORS.soilDark} opacity={0.35} />
          <Path d="M150 260 C150 228 150 200 150 168" stroke={COLORS.soilDark} strokeWidth={5} strokeLinecap="round" />
          <Path d="M150 200 C122 191 105 163 113 133 C143 143 151 171 150 200 Z" fill={COLORS.soil} opacity={0.85} />
          <Path d="M150 182 C178 172 195 143 187 115 C159 125 150 154 150 182 Z" fill={COLORS.soilDark} opacity={0.75} />
        </Svg>
      </View>

      <ScreenHeader
        title="My Games"
        right={
          <TouchableOpacity onPress={() => supabase.auth.signOut()}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        }
      />

      {!hasAny ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptySubtitle}>Join or create a game from the Explore tab</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.game_id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderSectionHeader={({ section }) =>
            section.data.length > 0 ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
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
                        color={COLORS.warning}
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
                    <Ionicons name="star-outline" size={16} color={COLORS.primary} />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  signOutText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.neutral800 },
  emptySubtitle: { fontSize: 14, color: COLORS.neutral500, marginTop: 4, textAlign: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.neutral500, textTransform: 'uppercase', marginBottom: 12, marginTop: 8, letterSpacing: 0.5 },
  card: { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.neutral200 },
  cardPast: { backgroundColor: 'rgba(255,255,255,0.6)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sportBadge: { fontSize: 13, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.softGreen, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  skillBadge: { fontSize: 12, fontWeight: '600', color: COLORS.neutral600, backgroundColor: COLORS.neutral100, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.neutral900, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  meta: { fontSize: 14, color: COLORS.neutral500, marginLeft: 6 },
  actionButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: COLORS.neutral200, backgroundColor: 'rgba(255,255,255,0.6)' },
  rateButton: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.softGreen },
  actionTextDanger: { color: COLORS.danger, fontWeight: '700', fontSize: 13, marginLeft: 5 },
  actionTextPrimary: { color: COLORS.primary, fontWeight: '700', fontSize: 13, marginLeft: 5 },
  ratedRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 12 },
  ratedText: { fontSize: 12, color: COLORS.muted, marginLeft: 7 },
  swipeAction: {
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginBottom: 14,
    borderRadius: 20,
    marginLeft: 10,
  },
  swipeActionText: { color: COLORS.white, fontWeight: '700', fontSize: 12, marginTop: 4 },
  sproutWrap: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
    elevation: -1,
  },
});