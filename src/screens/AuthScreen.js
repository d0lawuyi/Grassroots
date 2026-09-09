import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';

export default function ParkGamesSheet({ park, onClose, onSelectGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGames() {
      setLoading(true);
      const { data, error } = await supabase
        .from('games')
        .select('*, bookings(count)')
        .eq('park_id', park.park_id)
        .in('status', ['open', 'confirmed'])
        .order('start_time', { ascending: true });

      if (!error) setGames(data || []);
      setLoading(false);
    }
    if (park) fetchGames();
  }, [park]);

  const getPlayerCount = (game) => {
    if (game.bookings && game.bookings.length > 0) return game.bookings[0].count;
    return 0;
  };

  if (!park) return null;

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.parkName}>{park.name}</Text>
          <Text style={styles.subtitle}>
            {games.length} upcoming {games.length === 1 ? 'game' : 'games'}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={22} color={COLORS.snow} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyMark} />
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to start a run here</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.game_id}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const count = getPlayerCount(item);
            const fillPercent = Math.min((count / item.max_players) * 100, 100);
            return (
              <TouchableOpacity
                style={styles.gameCard}
                onPress={() => onSelectGame(item)}
                activeOpacity={0.85}
              >
                <View style={styles.gameTop}>
                  <Text style={styles.sportBadge}>
                    {sportEmoji(item.sport)} {formatSport(item.sport)}
                  </Text>
                  <Text style={styles.price}>
                    ${Number(item.base_price_per_player).toFixed(0)}
                  </Text>
                </View>

                <Text style={styles.gameTitle}>{item.title}</Text>

                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={15} color={COLORS.neutral500} />
                  <Text style={styles.metaText}>{formatGameTime(item.start_time)}</Text>
                </View>

                <View style={styles.fillBarContainer}>
                  <View style={[styles.fillBar, { width: `${fillPercent}%` }]} />
                </View>

                <Text style={styles.fillText}>
                  {count}/{item.max_players} players
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.inkRaised,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: COLORS.line,
    marginTop: 120,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.neutral300,
    borderRadius: 3, alignSelf: 'center', marginTop: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  closeButton: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.cardFill,
    borderWidth: 1, borderColor: COLORS.line,
    alignItems: 'center', justifyContent: 'center',
  },
  parkName: {
    fontSize: 22, fontWeight: '800',
    color: COLORS.snow, letterSpacing: -0.7,
  },
  subtitle: { fontSize: 13.5, color: COLORS.mute, marginTop: 3 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyMark: {
    width: 14, height: 14, backgroundColor: COLORS.primary,
    borderRadius: 3, transform: [{ rotate: '45deg' }], marginBottom: 18,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.snow },
  emptySubtitle: { fontSize: 14, color: COLORS.mute, marginTop: 6 },

  gameCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 18, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.line,
  },
  gameTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  sportBadge: {
    fontSize: 12.5, fontWeight: '800', color: COLORS.primary,
    backgroundColor: COLORS.limeDim, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 12, overflow: 'hidden',
  },
  price: { fontSize: 18, fontWeight: '800', color: COLORS.snow },
  gameTitle: {
    fontSize: 17, fontWeight: '700', color: COLORS.snow,
    marginBottom: 8, letterSpacing: -0.3,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  metaText: { fontSize: 14, color: COLORS.neutral500, marginLeft: 6 },
  fillBarContainer: {
    height: 5, backgroundColor: COLORS.neutral200,
    borderRadius: 3, overflow: 'hidden', marginBottom: 7,
  },
  fillBar: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  fillText: { fontSize: 12.5, color: COLORS.mute, fontWeight: '600' },
});