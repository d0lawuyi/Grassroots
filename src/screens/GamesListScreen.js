import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

function spotsLabel(count, maxPlayers) {
  const open = Math.max(maxPlayers - count, 0);
  if (open === 0) return { text: 'Full', tone: 'full' };
  if (open <= 2) return { text: `Almost full · ${open} left`, tone: 'urgent' };
  return { text: `${open} spots open`, tone: 'normal' };
}

export default function GamesListScreen({ onSelectGame, onCreateGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('soonest');

  async function fetchGames() {
    const { data } = await supabase
      .from('games')
      .select('*, parks(name), bookings(player_id, users(full_name, profile_photo_url))')
      .in('status', ['open', 'confirmed'])
      .order('start_time', { ascending: true });
    setGames(data || []);
  }

  useEffect(() => {
    async function init() {
      await fetchGames();
      setLoading(false);
    }
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  };

  const getCount = (game) => (game.bookings || []).length;

  const getPlayers = (game) =>
    (game.bookings || [])
      .map((b) => b.users)
      .filter(Boolean);

  const filteredGames = useMemo(() => {
    const query = search.trim().toLowerCase();

    let results = games.filter((game) => {
      if (!query) return true;
      const searchable = [game.title, game.parks?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });

    results = [...results];

    if (sortMode === 'soonest') {
      results.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    }

    if (sortMode === 'az') {
      results.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    }

    return results;
  }, [games, search, sortMode]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find a Game</Text>
        <Text style={styles.headerSubtitle}>Indianapolis, IN</Text>
      </View>

      <BlurView intensity={50} tint="light" style={styles.searchGlass}>
        <Ionicons name="search-outline" size={20} color={COLORS.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Game title or park"
          placeholderTextColor={COLORS.subtle}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={19} color={COLORS.subtle} />
          </TouchableOpacity>
        )}
      </BlurView>

      <View style={styles.filterRow}>
        <FilterChip
          title="Soonest"
          active={sortMode === 'soonest'}
          color={COLORS.primaryLight}
          onPress={() => setSortMode('soonest')}
        />
        <FilterChip
          title="A — Z"
          active={sortMode === 'az'}
          color={COLORS.softGreen}
          onPress={() => setSortMode('az')}
        />
        <View style={styles.resultCount}>
          <Text style={styles.resultText}>{filteredGames.length} games</Text>
        </View>
      </View>

      {filteredGames.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🌱</Text>
          <Text style={styles.emptyTitle}>No games yet</Text>
          <Text style={styles.emptySubtitle}>Try a different search, or be the first to create one</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGames}
          keyExtractor={(item) => item.game_id}
          contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const count = getCount(item);
            const fillPercent = Math.min((count / item.max_players) * 100, 100);
            const spots = spotsLabel(count, item.max_players);
            return (
              <TouchableOpacity style={styles.card} onPress={() => onSelectGame(item)} activeOpacity={0.8}>
                <View style={styles.cardTop}>
                  <View style={styles.badgeRow}>
                    <Text style={styles.sportBadge}>{sportEmoji(item.sport)} {formatSport(item.sport)}</Text>
                    {item.skill_level && (
                      <Text style={styles.skillBadge}>
                        {item.skill_level.charAt(0).toUpperCase() + item.skill_level.slice(1)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardTopRight}>
                    <Text style={styles.price}>${Number(item.base_price_per_player).toFixed(0)}</Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.neutral400} style={{ marginLeft: 6 }} />
                  </View>
                </View>

                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.park}>{item.parks?.name || 'Park'}</Text>

                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={15} color={COLORS.neutral500} />
                  <Text style={styles.meta}>{formatGameTime(item.start_time)}</Text>
                </View>

                <View style={styles.fillBarContainer}>
                  <View style={[styles.fillBar, { width: `${fillPercent}%` }]} />
                </View>

                <View style={styles.spotsRow}>
                  <AvatarStack players={getPlayers(item)} count={count} maxPlayers={item.max_players} />
                  <Text style={[
                    styles.spotsBadge,
                    spots.tone === 'urgent' && styles.spotsBadgeUrgent,
                    spots.tone === 'full' && styles.spotsBadgeFull,
                  ]}>
                    {spots.text}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

            <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={onCreateGame}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </LinearGradient>
  );
}

function AvatarStack({ players, count, maxPlayers, max = 4 }) {
  if (!players || players.length === 0) {
    return <Text style={styles.fillText}>{count}/{maxPlayers} players</Text>;
  }

  const shown = players.slice(0, max);
  const extra = players.length - shown.length;

  return (
    <View style={styles.avatarStack}>
      {shown.map((player, i) => {
        const initials = (player.full_name || '?')
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <View key={i} style={[styles.avatar, i > 0 && { marginLeft: -10 }]}>
            {player.profile_photo_url ? (
              <Image source={{ uri: player.profile_photo_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
        );
      })}

      {extra > 0 && (
        <View style={[styles.avatar, styles.avatarExtra, { marginLeft: -10 }]}>
          <Text style={styles.avatarText}>+{extra}</Text>
        </View>
      )}

      <Text style={styles.avatarCount}>{count}/{maxPlayers}</Text>
    </View>
  );
}

function FilterChip({ title, active, onPress, color }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.filterChip, active && { backgroundColor: color }]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  sproutWrap: { opacity: 0.45, position: 'absolute', right: -20, top: 80 },
  header: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 18 },
  headerTitle: { color: COLORS.text, fontSize: 30, fontWeight: '800' },
  headerSubtitle: { color: COLORS.muted, fontSize: 14, marginTop: 4 },
  searchGlass: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', marginHorizontal: 20, overflow: 'hidden', padding: 12 },
  searchInput: { color: COLORS.text, flex: 1, fontSize: 15, marginLeft: 9 },
  filterRow: { alignItems: 'center', flexDirection: 'row', padding: 20 },
  filterChip: { borderRadius: 20, marginRight: 8, paddingHorizontal: 16, paddingVertical: 9 },
  filterText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: COLORS.text },
  resultCount: { alignItems: 'flex-end', flex: 1 },
  resultText: { color: COLORS.muted, fontSize: 13 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 10, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sportBadge: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  skillBadge: { fontSize: 11, fontWeight: '600', color: COLORS.neutral600, backgroundColor: COLORS.neutral100, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  cardTopRight: { alignItems: 'center', flexDirection: 'row' },
  price: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  park: { color: COLORS.muted, fontSize: 13, marginTop: 2 },
  metaRow: { alignItems: 'center', flexDirection: 'row', marginTop: 6 },
  meta: { color: COLORS.neutral500, fontSize: 12, marginLeft: 5 },
  fillBarContainer: { backgroundColor: COLORS.neutral200, borderRadius: 3, height: 4, marginTop: 10, overflow: 'hidden' },
  fillBar: { backgroundColor: COLORS.primary, borderRadius: 4, height: '100%' },
  fillText: { color: COLORS.muted, fontSize: 12 },
  spotsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  spotsBadge: { fontSize: 11, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.softGreen, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  spotsBadgeUrgent: { color: '#B45309', backgroundColor: '#FEF3C7' },
  spotsBadgeFull: { color: COLORS.neutral600, backgroundColor: COLORS.neutral100 },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primaryLight, borderWidth: 2, borderColor: COLORS.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 9, fontWeight: '700', color: COLORS.primaryDark },
  avatarExtra: { backgroundColor: COLORS.neutral200 },
  avatarCount: { color: COLORS.muted, fontSize: 12, marginLeft: 8 },
  emptyIcon: { fontSize: 42 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { color: COLORS.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
    fab: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, borderRadius: 28, width: 56, height: 56, bottom: 20, position: 'absolute', right: 20, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  fabText: { color: COLORS.white, fontSize: 15, fontWeight: '700', marginLeft: 8 },
});