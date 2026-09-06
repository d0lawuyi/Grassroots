import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
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

  if (!game) return null;

  return (
    <LinearGradient
      colors={[COLORS.canvasTop, COLORS.canvasMid, COLORS.canvasBottom]}
      style={styles.container}
    >
      <View style={styles.sproutWrap} pointerEvents="none">
        <Svg width={220} height={220} viewBox="0 0 300 300" fill="none">
          <Path d="M0 260 Q150 225 300 260 L300 320 L0 320 Z" fill={COLORS.soilDark} opacity={0.3} />
          <Path d="M150 260 C150 228 150 200 150 168" stroke={COLORS.soilDark} strokeWidth={5} strokeLinecap="round" />
          <Path d="M150 200 C122 191 105 163 113 133 C143 143 151 171 150 200 Z" fill={COLORS.soil} opacity={0.75} />
          <Path d="M150 182 C178 172 195 143 187 115 C159 125 150 154 150 182 Z" fill={COLORS.soilDark} opacity={0.65} />
        </Svg>
      </View>

      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-down" size={22} color={COLORS.neutral700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Game Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
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
            <Ionicons name="location-outline" size={22} color={COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Location</Text>
              <Text style={styles.infoValue}>{park?.name || 'Park'}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={22} color={COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>{formatGameTime(game.start_time)}</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { marginBottom: 0 }]}>
            <Ionicons name="cash-outline" size={22} color={COLORS.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Cost per player</Text>
              <Text style={styles.infoValue}>${Number(game.base_price_per_player).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rosterCard}>
          <View style={styles.rosterHeader}>
            <Text style={styles.rosterTitle}>Roster</Text>
            <Text style={styles.rosterCount}>{playerCount} / {maxPlayers}</Text>
          </View>

          <View style={styles.fillBarContainer}>
            <View style={[styles.fillBar, { width: `${fillPercent}%` }]} />
          </View>

          <Text style={styles.rosterNote}>
            Game confirms at {game.min_players_to_confirm} players
          </Text>

          {loadingRoster ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />
          ) : players.length === 0 ? (
            <Text style={styles.rosterEmpty}>No one has joined yet — be the first</Text>
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
                    <View style={styles.playerAvatar}>
                      {row.users?.profile_photo_url ? (
                        <Image source={{ uri: row.users.profile_photo_url }} style={styles.playerAvatarImage} />
                      ) : (
                        <Text style={styles.playerAvatarText}>{initials}</Text>
                      )}
                    </View>

                    <Text style={styles.playerName}>
                      {isYou ? 'You' : name}
                    </Text>

                    {isOrganizer && (
                      <Text style={styles.organizerTag}>Organizer</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {hasJoined ? (
          <View>
            <View style={[styles.joinButton, styles.joinButtonJoined]}>
              <Text style={[styles.joinButtonText, styles.joinButtonTextJoined]}>You're In ✓</Text>
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
            activeOpacity={0.8}
          >
            {joining ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.joinButtonText}>
                {isFull ? 'Game Full' : `Join Game · $${Number(game.base_price_per_player).toFixed(0)}`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sproutWrap: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', opacity: 0.4, zIndex: -1, elevation: -1 },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'transparent', paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.neutral200,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.neutral900 },
  content: { padding: 24 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sportBadge: {
    fontSize: 14, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.softGreen,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: 'hidden',
  },
  skillBadge: {
    fontSize: 13, fontWeight: '600', color: COLORS.neutral600, backgroundColor: COLORS.neutral100,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, overflow: 'hidden',
  },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.neutral900, marginBottom: 20 },
  infoCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.neutral200,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  infoText: { marginLeft: 14 },
  infoLabel: { fontSize: 12, color: COLORS.neutral400, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 16, fontWeight: '700', color: COLORS.neutral800, marginTop: 2 },
  rosterCard: {
    backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.neutral200,
  },
  rosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  rosterTitle: { fontSize: 17, fontWeight: '700', color: COLORS.neutral800 },
  rosterCount: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  fillBarContainer: { height: 8, backgroundColor: COLORS.neutral100, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  fillBar: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  rosterNote: { fontSize: 13, color: COLORS.neutral500 },
  rosterEmpty: { fontSize: 14, color: COLORS.neutral400, marginTop: 16, fontStyle: 'italic' },
  playerList: { marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.neutral100, paddingTop: 12 },
  playerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  playerAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12,
  },
  playerAvatarImage: { width: '100%', height: '100%' },
  playerAvatarText: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },
  playerName: { fontSize: 15, fontWeight: '600', color: COLORS.neutral800, flex: 1 },
  organizerTag: {
    fontSize: 11, fontWeight: '700', color: COLORS.primaryDark, backgroundColor: COLORS.softGreen,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.neutral200, backgroundColor: 'rgba(255,255,255,0.9)' },
  joinButton: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  joinButtonJoined: { backgroundColor: COLORS.softGreen, elevation: 0, shadowOpacity: 0 },
  joinButtonFull: { backgroundColor: COLORS.neutral300, elevation: 0, shadowOpacity: 0 },
  joinButtonText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
  joinButtonTextJoined: { color: COLORS.primary },
  leaveLink: { alignItems: 'center', marginTop: 12 },
  leaveLinkText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },
});