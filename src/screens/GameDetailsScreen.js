import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';

export default function GameDetailsScreen({ game, park, userId, onClose }) {
  const [players, setPlayers] = useState([]);
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(true);

  async function fetchRoster() {
    if (!game) return;
    setLoadingRoster(true);

    const { data } = await supabase
      .from('bookings')
      .select('booking_id, player_id, joined_at, users(full_name, profile_photo_url)')
      .eq('game_id', game.game_id)
      .order('joined_at', { ascending: true });

    const rows = data || [];
    setPlayers(rows);
    setHasJoined(rows.some((r) => r.player_id === userId));
    setLoadingRoster(false);
  }

  useEffect(() => {
    fetchRoster();
  }, [game, userId]);

  const playerCount = players.length;
  const maxPlayers = game?.max_players || 10;
  const isFull = playerCount >= maxPlayers;

  const handleJoin = async () => {
    if (hasJoined || joining) return;

    if (isFull) {
      Alert.alert('Game Full', 'This game has reached its player limit.');
      return;
    }

    setJoining(true);
    try {
      // Re-check capacity against the database in case someone joined while this screen was open
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

  if (!game) return null;

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

          <View style={styles.infoRule} />

          <View style={[styles.infoRow, { marginBottom: 0 }]}>
            <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>COST PER PLAYER</Text>
              <Text style={styles.infoValueBig}>
                ${Number(game.base_price_per_player).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

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
            {confirmed ? (
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
              {players.map((row) => {
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
                    <View style={[styles.playerAvatar, isYou && styles.playerAvatarYou]}>
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
            <View style={[styles.joinButton, styles.joinButtonJoined]}>
              <Ionicons name="checkmark-circle" size={19} color={COLORS.primary} />
              <Text style={[styles.joinButtonText, styles.joinButtonTextJoined]}>
                You are in
              </Text>
            </View>
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
                {isFull ? 'Game full' : `Join game · $${Number(game.base_price_per_player).toFixed(0)}`}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {!hasJoined && !isFull && (
          <Text style={styles.footerNote}>You only pay once the game confirms</Text>
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

  /* info card */
  infoCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoRule: { height: 1, backgroundColor: COLORS.line, marginVertical: 14 },
  infoText: { marginLeft: 14, flex: 1 },
  infoLabel: {
    fontSize: 9.5, color: COLORS.mute, fontWeight: '800', letterSpacing: 1.8,
  },
  infoValue: { fontSize: 16, fontWeight: '700', color: COLORS.snow, marginTop: 4 },
  infoValueBig: {
    fontSize: 22, fontWeight: '800', color: COLORS.primary,
    marginTop: 3, letterSpacing: -0.7,
  },

  /* roster */
  rosterCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.line,
  },
  rosterHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  rosterTitle: {
    fontSize: 10.5, fontWeight: '800', color: COLORS.primary, letterSpacing: 2.2,
  },
  rosterCount: { alignItems: 'baseline' },
  rosterCountNow: { fontSize: 17, fontWeight: '800', color: COLORS.snow },
  rosterCountMax: { fontSize: 13, fontWeight: '700', color: COLORS.mute },

  fillBarContainer: {
    height: 5, backgroundColor: COLORS.neutral200,
    borderRadius: 3, overflow: 'hidden', marginBottom: 11,
  },
  fillBar: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },

  noteRow: { flexDirection: 'row', alignItems: 'center' },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.primary, marginRight: 7,
  },
  noteConfirmed: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  rosterNote: { fontSize: 13, color: COLORS.mute, fontWeight: '500' },
  rosterEmpty: { fontSize: 14, color: COLORS.mute, marginTop: 18, fontStyle: 'italic' },

  playerList: {
    marginTop: 18, borderTopWidth: 1,
    borderTopColor: COLORS.line, paddingTop: 14,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  playerAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.neutral200,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12,
  },
  playerAvatarYou: { backgroundColor: COLORS.primary },
  playerAvatarImage: { width: '100%', height: '100%' },
  playerAvatarText: { fontSize: 12, fontWeight: '800', color: COLORS.snow },
  playerAvatarTextYou: { color: COLORS.ink },
  playerName: { fontSize: 15, fontWeight: '600', color: COLORS.neutral800, flex: 1 },
  playerNameYou: { color: COLORS.snow, fontWeight: '800' },
  organizerTag: {
    fontSize: 10.5, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.limeDim,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, overflow: 'hidden',
    letterSpacing: 0.3,
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