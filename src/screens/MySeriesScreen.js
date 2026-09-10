import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function scheduleLabel(series) {
  const h = series.start_hour;
  const m = String(series.start_minute).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${DAYS[series.day_of_week]}s at ${hour12}:${m} ${ampm}`;
}

export default function MySeriesScreen({ userId, onClose }) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchSeries(showSpinner = true) {
    if (showSpinner) setLoading(true);

    const { data } = await supabase
      .from('game_series')
      .select('*, parks(name)')
      .eq('organizer_id', userId)
      .order('created_at', { ascending: false });

    // Count upcoming generated games per series
    const withCounts = await Promise.all(
      (data || []).map(async (s) => {
        const { count } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('series_id', s.series_id)
          .gte('start_time', new Date().toISOString());
        return { ...s, upcoming: count || 0 };
      })
    );

    setSeries(withCounts);
    setLoading(false);
  }

  useEffect(() => {
    if (userId) fetchSeries();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSeries(false);
    setRefreshing(false);
  };

  async function togglePause(s) {
    const { error } = await supabase
      .from('game_series')
      .update({ is_active: !s.is_active })
      .eq('series_id', s.series_id);

    if (error) {
      Alert.alert('Could not update', error.message);
      return;
    }
    await fetchSeries(false);
  }

  function confirmDelete(s) {
    Alert.alert(
      'Delete this series?',
      `"${s.title}" will stop repeating. Upcoming games that nobody has joined will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSeries(s) },
      ]
    );
  }

  async function deleteSeries(s) {
    // Remove future instances that have no bookings
    const { data: futureGames } = await supabase
      .from('games')
      .select('game_id, bookings(booking_id)')
      .eq('series_id', s.series_id)
      .gte('start_time', new Date().toISOString());

    const emptyIds = (futureGames || [])
      .filter((g) => (g.bookings || []).length === 0)
      .map((g) => g.game_id);

    if (emptyIds.length > 0) {
      await supabase.from('games').delete().in('game_id', emptyIds);
    }

    const { error } = await supabase
      .from('game_series')
      .delete()
      .eq('series_id', s.series_id);

    if (error) {
      Alert.alert('Could not delete', error.message);
      return;
    }
    await fetchSeries(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-down" size={22} color={COLORS.snow} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recurring games</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={series}
        keyExtractor={(item) => item.series_id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyMark} />
            <Text style={styles.emptyTitle}>No recurring games</Text>
            <Text style={styles.emptyText}>
              Turn on "Repeat weekly" when you create a game
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.is_active && styles.cardPaused]}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.schedule}>{scheduleLabel(item)}</Text>
              </View>
              {!item.is_active && (
                <Text style={styles.pausedBadge}>PAUSED</Text>
              )}
            </View>

            <Text style={styles.meta} numberOfLines={1}>
              {sportEmoji(item.sport)} {formatSport(item.sport)} · {item.parks?.name || 'Park'}
            </Text>

            <Text style={styles.meta}>
              {item.upcoming} upcoming {item.upcoming === 1 ? 'game' : 'games'} scheduled
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => togglePause(item)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.is_active ? 'pause-outline' : 'play-outline'}
                  size={15}
                  color={COLORS.snow}
                />
                <Text style={styles.actionText}>
                  {item.is_active ? 'Pause' : 'Resume'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => confirmDelete(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                <Text style={[styles.actionText, styles.actionTextDanger]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ink },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.cardFill,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.snow },
  listContent: { padding: 20, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.cardFill, borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.line,
  },
  cardPaused: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.snow, letterSpacing: -0.3 },
  schedule: { fontSize: 13, fontWeight: '700', color: COLORS.primary, marginTop: 3 },
  pausedBadge: {
    fontSize: 9, fontWeight: '800', color: COLORS.mute, letterSpacing: 1,
    backgroundColor: 'rgba(244,246,242,0.07)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
  },
  meta: { fontSize: 12.5, color: COLORS.mute, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.line,
  },
  actionText: { fontSize: 12.5, fontWeight: '700', color: COLORS.snow },
  actionTextDanger: { color: COLORS.danger },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyMark: {
    width: 14, height: 14, backgroundColor: COLORS.primary,
    borderRadius: 3, transform: [{ rotate: '45deg' }], marginBottom: 18,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.snow },
  emptyText: { fontSize: 14, color: COLORS.mute, marginTop: 6, textAlign: 'center' },
});