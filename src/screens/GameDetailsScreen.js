import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';

const TONES = [
  'rgba(244,246,242,0.30)',
  'rgba(244,246,242,0.22)',
  'rgba(244,246,242,0.16)',
  'rgba(244,246,242,0.11)',
];

export default function GameDetailsScreen({ game, park, userId, onClose }) {
  const [players, setPlayers] = useState([]);
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [parkRate, setParkRate] = useState(null);
  const [onMyWay, setOnMyWay] = useState(false);
  const [marking, setMarking] = useState(false);

  const shareAnim = useRef(new Animated.Value(0)).current;

  async function fetchRoster() {
    if (!game) return;
    setLoadingRoster(true);

    const { data } = await supabase
      .from('bookings')
      .select('booking_id, player_id, joined_at, on_my_way_at, users(full_name, profile_photo_url)')
      .eq('game_id', game.game_id)
      .order('joined_at', { ascending: true });

    const rows = data || [];
    setPlayers(rows);
    setHasJoined(rows.some((r) => r.player_id === userId));

    const mine = rows.find((r) => r.player_id === userId);
    setOnMyWay(!!mine?.on_my_way_at);

    setLoadingRoster(false);
  }

  async function fetchRate() {
    if (!game?.park_id) return;

    const { data } = await supabase
      .from('parks')
      .select('hourly_rate')
      .eq('park_id', game.park_id)
      .single();

    setParkRate(data?.hourly_rate ?? 0);
  }

  useEffect(() => {
    fetchRoster();
    fetchRate();
  }, [game, userId]);

  const playerCount = players.length;
  const maxPlayers = game?.max_players || 10;
  const isFull = playerCount >= maxPlayers;

  /* ---- the split ---- */

  const durationHours = (() => {
    if (!game?.start_time || !game?.end_time) return 1.5;
    const ms = new Date(game.end_time) - new Date(game.start_time);
    return Math.max(ms / 3600000, 0);
  })();

  const feePercent = Number(game?.grassroots_fee_percent) || 0;
  const fieldTotal = (Number(parkRate) || 0) * durationHours;
  const chargedTotal = fieldTotal * (1 + feePercent / 100);
  const isFreeField = fieldTotal <= 0;

  const splitAcross = Math.max(playerCount + (hasJoined ? 0 : 1), 1);
  const yourShare = isFreeField ? 0 : chargedTotal / splitAcross;
  const shareAtFull = isFreeField ? 0 : chargedTotal / maxPlayers;

  useEffect(() => {
    shareAnim.setValue(0);
    const anim = Animated.timing(shareAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [playerCount, parkRate, shareAnim]);

  const handleJoin = async () => {
    if (hasJoined || joining) return;

    if (isFull) {
      Alert.alert('Game Full', 'This game has reached its player limit.');
      return;
    }

    setJoining(true);
    try {
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.game_id);

      if ((count || 0) >= maxPlayers) {
        Alert.alert('Game Full', 'Someone just took the last spot.');
        await fetchRoster();
        return;
      }

      const { error } = await supabase
        .from('bookings')
        .insert({
          game_id: game.game_id,
          player_id: userId,
          status: 'joined',
          amount_paid: game.base_price_per_player,
        });
      if (error) throw error;

      await fetchRoster();
    } catch (error) {
      Alert.alert('Could Not Join', error.message);
    } finally {
      setJoining(false);
    }
  };

  const markOnMyWay = async () => {
    if (onMyWay || marking) return;
    setMarking(true);

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ on_my_way_at: new Date().toISOString() })
        .eq('game_id', game.game_id)
        .eq('player_id', userId);

      if (error) throw error;

      // let the squad know
      await supabase.from('game_chat').insert({
        game_id: game.game_id,
        sender_id: userId,
        message: 'On my way',
      });

      setOnMyWay(true);
      await fetchRoster();
    } catch (error) {
      Alert.alert('Could not update', error.message);
    } finally {
      setMarking(false);
    }
  };

  const confirmLeave = () => {
    Alert.alert(
      'Leave this game?',
      `You'll give up your spot in "${game.title}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: handleLeave },
      ]
    );
  };

  const handleLeave = async () => {
    setJoining(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('game_id', game.game_id)
        .eq('player_id', userId);
      if (error) throw error;

      await fetchRoster();
    } catch (error) {
      Alert.alert('Could Not Leave', error.message);
    } finally {
      setJoining(false);
    }
  };

  const fillPercent = Math.min((playerCount / maxPlayers) * 100, 100);
  const needed = Math.max((game?.min_players_to_confirm || 0) - playerCount, 0);
  const confirmed = needed === 0;

  const onWayCount = players.filter((p) => p.on_my_way_at).length;

  /* "On my way" only makes sense near kickoff */
  const showOnMyWay = (() => {
    if (!hasJoined || !game?.start_time) return false;
    const ms = new Date(game.start_time).getTime() - Date.now();
    return ms < 90 * 60000 && ms > -120 * 60000;
  })();

  if (!game) return null;

  const durationLabel =
    durationHours >= 1
      ? `${durationHours % 1 === 0 ? durationHours : durationHours.toFixed(1)} hr`
      : `${Math.round(durationHours * 60)} min`;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-down" size={22} color={COLORS.snow} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Game Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.badgeRow}>
          <Text style={styles.sportBadge}>{sportEmoji(game.sport)} {formatSport(game.sport)}</Text>
          {game.skill_level && (
            <Text style={styles.skillBadge}>
              {game.skill_level.charAt(0).toUpperCase() + game.skill_level.slice(1)}
            </Text>
          )}
        </View>

        <Text style={styles.title}>{game.title}</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>LOCATION</Text>
              <Text style={styles.infoValue}>{park?.name || 'Park'}</Text>
            </View>
          </View>

          <View style={styles.infoRule} />

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>TIME</Text>
              <Text style={styles.infoValue}>{formatGameTime(game.start_time)}</Text>
            </View>
          </View>
        </View>

        {/* ---- THE RECEIPT ---- */}
        <View style={styles.receiptCard}>
          <View style={styles.receiptHead}>
            <Text style={styles.receiptLabel}>FIELD RESERVATION</Text>
            {!isFreeField && (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.livePillText}>SPLIT</Text>
              </View>
            )}
          </View>

          {isFreeField ? (
            <View style={styles.freeRow}>
              <Text style={styles.freeTitle}>Free field</Text>
              <Text style={styles.freeNote}>
                This park does not charge, so there is nothing to split
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.recRow}>
                <Text style={styles.recKey}>
                  {park?.name || 'Park'} · {durationLabel}
                </Text>
                <Text style={styles.recVal}>${chargedTotal.toFixed(2)}</Text>
              </View>

              <View style={styles.recRow}>
                <Text style={styles.recKey}>Players in so far</Text>
                <Text style={styles.recVal}>{playerCount}</Text>
              </View>

              <View style={styles.recRule} />

              <View style={styles.recRow}>
                <Text style={styles.recYouKey}>
                  {hasJoined ? 'Your share' : 'Your share if you join'}
                </Text>
                <Animated.Text
                  style={[
                    styles.recYouVal,
                    {
                      opacity: shareAnim,
                      transform: [
                        {
                          translateY: shareAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [8, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  ${yourShare.toFixed(2)}
                </Animated.Text>
              </View>

              {!isFull && shareAtFull < yourShare && (
                <Text style={styles.dropNote}>
                  Drops to ${shareAtFull.toFixed(2)} once the roster fills
                </Text>
              )}
            </>
          )}
        </View>

        {/* ---- ROSTER ---- */}
        <View style={styles.rosterCard}>
          <View style={styles.rosterHeader}>
            <Text style={styles.rosterTitle}>ROSTER</Text>
            <Text style={styles.rosterCount}>
              <Text style={styles.rosterCountNow}>{playerCount}</Text>
              <Text style={styles.rosterCountMax}> / {maxPlayers}</Text>
            </Text>
          </View>

          <View style={styles.fillBarContainer}>
            <View style={[styles.fillBar, { width: `${fillPercent}%` }]} />
          </View>

          <View style={styles.noteRow}>
            {onWayCount > 0 ? (
              <>
                <View style={styles.liveDot} />
                <Text style={styles.noteConfirmed}>
                  {onWayCount} on the way
                </Text>
              </>
            ) : confirmed ? (
              <>
                <View style={styles.liveDot} />
                <Text style={styles.noteConfirmed}>Confirmed and going ahead</Text>
              </>
            ) : (
              <Text style={styles.rosterNote}>
                {needed} more {needed === 1 ? 'player' : 'players'} to confirm this game
              </Text>
            )}
          </View>

          {loadingRoster ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />
          ) : players.length === 0 ? (
            <Text style={styles.rosterEmpty}>No one has joined yet, be the first</Text>
          ) : (
            <View style={styles.playerList}>
              {players.map((row, i) => {
                const name = row.users?.full_name || 'Player';
                const initials = name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const isOrganizer = row.player_id === game.organizer_id;
                const isYou = row.player_id === userId;

                return (
                  <View key={row.booking_id} style={styles.playerRow}>
                    <View
                      style={[
                        styles.playerAvatar,
                        { backgroundColor: isYou ? COLORS.primary : TONES[i % TONES.length] },
                      ]}
                    >
                      {row.users?.profile_photo_url ? (
                        <Image source={{ uri: row.users.profile_photo_url }} style={styles.playerAvatarImage} />
                      ) : (
                        <Text style={[styles.playerAvatarText, isYou && styles.playerAvatarTextYou]}>
                          {initials}
                        </Text>
                      )}
                    </View>

                    <Text style={[styles.playerName, isYou && styles.playerNameYou]}>
                      {isYou ? 'You' : name}
                    </Text>

                    {row.on_my_way_at && (
                      <View style={styles.onWayTag}>
                        <Ionicons name="navigate" size={10} color={COLORS.primary} />
                        <Text style={styles.onWayText}>On the way</Text>
                      </View>
                    )}

                    {isOrganizer && (
                      <Text style={styles.organizerTag}>Organizer</Text>
                    )}
                  </View>
                );
              })}

              {Array.from({ length: Math.max(maxPlayers - playerCount, 0) })
                .slice(0, 3)
                .map((_, i) => (
                  <View key={`open-${i}`} style={styles.playerRow}>
                    <View style={styles.openAvatar}>
                      <Ionicons name="add" size={15} color={COLORS.mute} />
                    </View>
                    <Text style={styles.openName}>Open spot</Text>
                  </View>
                ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {hasJoined ? (
          <View>
            {showOnMyWay ? (
              <TouchableOpacity
                style={[styles.joinButton, onMyWay && styles.joinButtonJoined]}
                onPress={markOnMyWay}
                disabled={onMyWay || marking}
                activeOpacity={0.85}
              >
                {marking ? (
                  <ActivityIndicator color={COLORS.ink} />
                ) : (
                  <>
                    <Ionicons
                      name={onMyWay ? 'checkmark-circle' : 'navigate'}
                      size={19}
                      color={onMyWay ? COLORS.primary : COLORS.ink}
                    />
                    <Text
                      style={[
                        styles.joinButtonText,
                        onMyWay && styles.joinButtonTextJoined,
                      ]}
                    >
                      {onMyWay ? 'You are on the way' : 'On my way'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={[styles.joinButton, styles.joinButtonJoined]}>
                <Ionicons name="checkmark-circle" size={19} color={COLORS.primary} />
                <Text style={[styles.joinButtonText, styles.joinButtonTextJoined]}>
                  You are in
                </Text>
              </View>
            )}

            <TouchableOpacity onPress={confirmLeave} disabled={joining} style={styles.leaveLink}>
              <Text style={styles.leaveLinkText}>Leave game</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinButton, isFull && styles.joinButtonFull]}
            onPress={handleJoin}
            disabled={joining || isFull}
            activeOpacity={0.85}
          >
            {joining ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Text style={[styles.joinButtonText, isFull && styles.joinButtonTextFull]}>
                {isFull
                  ? 'Game full'
                  : isFreeField
                    ? 'Join game'
                    : `Join game · $${yourShare.toFixed(2)}`}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {!hasJoined && !isFull && (
          <Text style={styles.footerNote}>
            {isFreeField
              ? 'Free to join, nothing to pay'
              : 'You only pay once the game confirms'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },

  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'transparent', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.cardFill,
    borderWidth: 1, borderColor: COLORS.line,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.snow, letterSpacing: -0.2 },

  content: { padding: 24, paddingBottom: 40 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sportBadge: {
    fontSize: 13, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.limeDim,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: 'hidden',
  },
  skillBadge: {
    fontSize: 12.5, fontWeight: '600', color: COLORS.neutral600, backgroundColor: COLORS.neutral100,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden',
  },
  title: {
    fontSize: 30, fontWeight: '800', color: COLORS.snow,
    marginBottom: 22, letterSpacing: -1.1, lineHeight: 34,
  },

  infoCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoRule: { height: 1, backgroundColor: COLORS.line, marginVertical: 14 },
  infoText: { marginLeft: 14, flex: 1 },
  infoLabel: { fontSize: 9.5, color: COLORS.mute, fontWeight: '800', letterSpacing: 1.8 },
  infoValue: { fontSize: 16, fontWeight: '700', color: COLORS.snow, marginTop: 4 },

  /* receipt */
  receiptCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  receiptHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  receiptLabel: { color: COLORS.mute, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.limeDim,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: COLORS.primary, marginRight: 5,
  },
  livePillText: { color: COLORS.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },

  recRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 8,
  },
  recKey: { color: COLORS.mute, fontSize: 14, fontWeight: '500', flex: 1, marginRight: 10 },
  recVal: { color: COLORS.snow, fontSize: 14, fontWeight: '700' },
  recRule: { height: 1, backgroundColor: COLORS.line, marginVertical: 9 },
  recYouKey: { color: COLORS.snow, fontSize: 15, fontWeight: '700' },
  recYouVal: { color: COLORS.primary, fontSize: 26, fontWeight: '800', letterSpacing: -0.9 },
  dropNote: { color: COLORS.faint, fontSize: 12, marginTop: 6, fontWeight: '600' },

  freeRow: { paddingVertical: 4 },
  freeTitle: { color: COLORS.primary, fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  freeNote: { color: COLORS.mute, fontSize: 13, marginTop: 6, lineHeight: 19 },

  /* roster */
  rosterCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.line,
  },
  rosterHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  rosterTitle: { fontSize: 10.5, fontWeight: '800', color: COLORS.primary, letterSpacing: 2.2 },
  rosterCount: { alignItems: 'baseline' },
  rosterCountNow: { fontSize: 17, fontWeight: '800', color: COLORS.snow },
  rosterCountMax: { fontSize: 13, fontWeight: '700', color: COLORS.mute },

  fillBarContainer: {
    height: 5, backgroundColor: COLORS.neutral200,
    borderRadius: 3, overflow: 'hidden', marginBottom: 11,
  },
  fillBar: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },

  noteRow: { flexDirection: 'row', alignItems: 'center' },
  noteConfirmed: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  rosterNote: { fontSize: 13, color: COLORS.mute, fontWeight: '500' },
  rosterEmpty: { fontSize: 14, color: COLORS.mute, marginTop: 18, fontStyle: 'italic' },

  playerList: {
    marginTop: 18, borderTopWidth: 1,
    borderTopColor: COLORS.line, paddingTop: 14,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  playerAvatar: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12,
  },
  playerAvatarImage: { width: '100%', height: '100%' },
  playerAvatarText: { fontSize: 12, fontWeight: '800', color: COLORS.snow },
  playerAvatarTextYou: { color: COLORS.ink },
  playerName: { fontSize: 15, fontWeight: '600', color: COLORS.neutral800, flex: 1 },
  playerNameYou: { color: COLORS.snow, fontWeight: '800' },
  organizerTag: {
    fontSize: 10.5, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.limeDim,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden',
    letterSpacing: 0.3, marginLeft: 6,
  },

  onWayTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.limeDim,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, marginLeft: 6,
  },
  onWayText: {
    fontSize: 10, fontWeight: '800',
    color: COLORS.primary, letterSpacing: 0.3,
  },

  openAvatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: COLORS.line, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  openName: { fontSize: 14, color: COLORS.mute, flex: 1 },

  /* footer */
  footer: {
    padding: 20, paddingBottom: 34, borderTopWidth: 1,
    borderTopColor: COLORS.line, backgroundColor: COLORS.inkRaised,
  },
  joinButton: {
    flexDirection: 'row', gap: 8,
    backgroundColor: COLORS.primary, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  joinButtonJoined: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: COLORS.primary,
  },
  joinButtonFull: { backgroundColor: COLORS.neutral200 },
  joinButtonText: { color: COLORS.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  joinButtonTextJoined: { color: COLORS.primary },
  joinButtonTextFull: { color: COLORS.mute },

  leaveLink: { alignItems: 'center', marginTop: 14 },
  leaveLinkText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },
  footerNote: {
    color: COLORS.faint, fontSize: 11.5,
    textAlign: 'center', marginTop: 12,
  },
});