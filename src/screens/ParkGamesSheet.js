import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';

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
          <Text style={styles.subtitle}>{games.length} upcoming games</Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={26} color="#111827" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to organize one here</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.game_id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => {
            const count = getPlayerCount(item);
            const fillPercent = Math.min((count / item.max_players) * 100, 100);
            return (
              <TouchableOpacity style={styles.gameCard} onPress={() => onSelectGame(item)} activeOpacity={0.8}>
                <View style={styles.gameTop}>
                  <Text style={styles.sportBadge}>{sportEmoji(item.sport)} {formatSport(item.sport)}</Text>
                  <Text style={styles.price}>${Number(item.base_price_per_player).toFixed(0)}</Text>
                </View>
                <Text style={styles.gameTitle}>{item.title}</Text>
                <View style={styles.metaItem}>
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                  <Text style={styles.metaText}>{formatGameTime(item.start_time)}</Text>
                </View>
                <View style={styles.fillBarContainer}>
                  <View style={[styles.fillBar, { width: `${fillPercent}%` }]} />
                </View>
                <Text style={styles.fillText}>{count}/{item.max_players} players</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: 120 },
  handle: { width: 40, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, alignSelf: 'center', marginTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  parkName: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  gameCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  gameTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sportBadge: { fontSize: 13, fontWeight: '700', color: '#16A34A', backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, overflow: 'hidden' },
  price: { fontSize: 18, fontWeight: '800', color: '#111827' },
  gameTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  metaText: { fontSize: 14, color: '#6B7280', marginLeft: 6 },
  fillBarContainer: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  fillBar: { height: '100%', backgroundColor: '#16A34A', borderRadius: 3 },
  fillText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
});