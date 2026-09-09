import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, Image, Modal, RefreshControl, TextInput, Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';
import { DARK_MAP } from '../theme/mapStyle';
import ScreenHeader from '../components/ScreenHeader';

function spotsLabel(count, maxPlayers, minToConfirm, status) {
  const open = Math.max(maxPlayers - count, 0);
  const needed = Math.max((minToConfirm || 0) - count, 0);

  if (open === 0) return { text: 'Full', tone: 'full' };
  if (status === 'confirmed') return { text: `On · ${open} spots left`, tone: 'confirmed' };
  if (needed > 0) return { text: `${needed} more to confirm`, tone: 'forming' };
  return { text: `${open} spots open`, tone: 'normal' };
}

function ParkPin({ live }) {
  return (
    <View style={styles.pinWrap}>
      {live && <View style={styles.pinHalo} />}
      <View style={[styles.pinCore, !live && styles.pinCoreDim]} />
    </View>
  );
}

export default function ExploreScreen({ userId, userLocation, onSelectPark, onSelectGame, onCreateGame }) {
  const [games, setGames] = useState([]);
  const [parks, setParks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('soonest');
  const [mapExpanded, setMapExpanded] = useState(false);

  async function fetchAll() {
    const [gamesRes, parksRes] = await Promise.all([
      supabase
        .from('games')
        .select('*, parks(name), bookings(player_id, users(full_name, profile_photo_url))')
        .in('status', ['open', 'confirmed'])
        .order('start_time', { ascending: true }),
      supabase.from('parks').select('*').eq('status', 'active'),
    ]);

    setGames(gamesRes.data || []);
    setParks(parksRes.data || []);
  }

  useEffect(() => {
    async function init() {
      await fetchAll();
      setLoading(false);
    }
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const getCount = (game) => (game.bookings || []).length;
  const getPlayers = (game) => (game.bookings || []).map((b) => b.users).filter(Boolean);

  // park_ids that currently have a live game — drives pin styling
  const activeParkIds = useMemo(
    () => new Set(games.map((g) => g.park_id).filter(Boolean)),
    [games]
  );

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

  const mappable = parks.filter((p) => p.latitude != null && p.longitude != null);

  const region = {
    latitude: userLocation?.latitude || 39.7684,
    longitude: userLocation?.longitude || -86.1581,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

   const mapProps = {
    // provider: PROVIDER_GOOGLE,
    customMapStyle: DARK_MAP,
    ...(Platform.OS === 'ios' ? { userInterfaceStyle: 'dark' } : {}),
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredGames}
        keyExtractor={(item) => item.game_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
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
          <View>
            <View style={{ marginHorizontal: -20 }}>
              <ScreenHeader title="Explore" subtitle="Games near you" />
            </View>

            <TouchableOpacity
              style={styles.mapPreview}
              activeOpacity={0.9}
              onPress={() => setMapExpanded(true)}
            >
              <MapView
                {...mapProps}
                style={StyleSheet.absoluteFill}
                initialRegion={region}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                {mappable.map((park) => (
                  <Marker
                    key={park.park_id}
                    coordinate={{
                      latitude: Number(park.latitude),
                      longitude: Number(park.longitude),
                    }}
                    tracksViewChanges={false}
                  >
                    <ParkPin live={activeParkIds.has(park.park_id)} />
                  </Marker>
                ))}
              </MapView>

              <View style={styles.mapOverlay}>
                <Ionicons name="expand-outline" size={15} color={COLORS.primary} />
                <Text style={styles.mapOverlayText}>Browse parks</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={19} color={COLORS.mute} />
              <TextInput
                style={styles.searchInput}
                placeholder="Game title or park"
                placeholderTextColor={COLORS.neutral400}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={COLORS.neutral400} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.chip, sortMode === 'soonest' && styles.chipActive]}
                onPress={() => setSortMode('soonest')}
              >
                <Text style={[styles.chipText, sortMode === 'soonest' && styles.chipTextActive]}>
                  Soonest
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chip, sortMode === 'az' && styles.chipActive]}
                onPress={() => setSortMode('az')}
              >
                <Text style={[styles.chipText, sortMode === 'az' && styles.chipTextActive]}>
                  A — Z
                </Text>
              </TouchableOpacity>

              <Text style={styles.resultCount}>{filteredGames.length} games</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyMark} />
            <Text style={styles.emptyTitle}>No games yet</Text>
            <Text style={styles.emptyText}>Try a different search, or start your own run</Text>
          </View>
        }
        renderItem={({ item }) => {
          const count = getCount(item);
          const fillPercent = Math.min((count / item.max_players) * 100, 100);
          const spots = spotsLabel(count, item.max_players, item.min_players_to_confirm, item.status);
          const isConfirmed = item.status === 'confirmed';

          return (
            <TouchableOpacity style={styles.card} onPress={() => onSelectGame(item)} activeOpacity={0.85}>
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
                <View style={styles.cardTopRight}>
                  <Text style={styles.price}>${Number(item.base_price_per_player).toFixed(0)}</Text>
                  <Ionicons name="chevron-forward" size={17} color={COLORS.neutral400} style={{ marginLeft: 5 }} />
                </View>
              </View>

              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.park}>{item.parks?.name || 'Park'}</Text>

              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.neutral500} />
                <Text style={styles.meta}>{formatGameTime(item.start_time)}</Text>
              </View>

              <View style={styles.fillBarContainer}>
                <View
                  style={[
                    styles.fillBar,
                    { width: `${fillPercent}%` },
                    isConfirmed && styles.fillBarConfirmed,
                  ]}
                />
              </View>

              <View style={styles.spotsRow}>
                <AvatarStack players={getPlayers(item)} count={count} maxPlayers={item.max_players} />
                <Text style={[
                  styles.spotsBadge,
                  spots.tone === 'confirmed' && styles.spotsBadgeConfirmed,
                  spots.tone === 'forming' && styles.spotsBadgeForming,
                  spots.tone === 'full' && styles.spotsBadgeFull,
                ]}>
                  {spots.text}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={onCreateGame}>
        <Ionicons name="add" size={28} color={COLORS.ink} />
      </TouchableOpacity>

      <Modal visible={mapExpanded} animationType="slide" onRequestClose={() => setMapExpanded(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.ink }}>
          <MapView {...mapProps} style={{ flex: 1 }} initialRegion={region}>
            <Marker coordinate={region} title="You are here" tracksViewChanges={false}>
              <View style={styles.mePin}>
                <View style={styles.meCore} />
              </View>
            </Marker>

            {mappable.map((park) => (
              <Marker
                key={park.park_id}
                coordinate={{
                  latitude: Number(park.latitude),
                  longitude: Number(park.longitude),
                }}
                title={park.name}
                tracksViewChanges={false}
                onPress={() => {
                  setMapExpanded(false);
                  onSelectPark(park);
                }}
              >
                <ParkPin live={activeParkIds.has(park.park_id)} />
              </Marker>
            ))}
          </MapView>

          <TouchableOpacity style={styles.mapClose} onPress={() => setMapExpanded(false)}>
            <Ionicons name="close" size={22} color={COLORS.ink} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ink },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  /* map */
  mapPreview: {
    height: 170,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: COLORS.inkRaised,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  mapOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(7,9,7,0.8)',
    borderWidth: 1, borderColor: COLORS.line,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  mapOverlayText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  pinWrap: { alignItems: 'center', justifyContent: 'center', width: 34, height: 34 },
  pinHalo: {
    position: 'absolute', width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(215,255,62,0.18)',
  },
  pinCore: {
    width: 13, height: 13, borderRadius: 7,
    backgroundColor: COLORS.primary,
    borderWidth: 2.5, borderColor: COLORS.ink,
  },
  pinCoreDim: { backgroundColor: 'rgba(244,246,242,0.35)' },

  mePin: { alignItems: 'center', justifyContent: 'center', width: 26, height: 26 },
  meCore: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.info,
    borderWidth: 2.5, borderColor: COLORS.ink,
  },

  /* search + filters */
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: COLORS.cardFill,
    borderRadius: 14, paddingHorizontal: 14, height: 46,
    marginTop: 14, borderWidth: 1, borderColor: COLORS.line,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.snow },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: COLORS.line,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.mute },
  chipTextActive: { color: COLORS.ink, fontWeight: '800' },
  resultCount: { marginLeft: 'auto', fontSize: 12, color: COLORS.mute, fontWeight: '600' },

  /* card */
  card: {
    backgroundColor: COLORS.cardFill, borderRadius: 16, marginBottom: 10, padding: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTopRight: { flexDirection: 'row', alignItems: 'center' },
  sportBadge: { color: COLORS.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  skillBadge: {
    fontSize: 11, fontWeight: '600', color: COLORS.neutral600, backgroundColor: COLORS.neutral100,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden',
  },
  price: { color: COLORS.snow, fontSize: 16, fontWeight: '800' },
  title: { color: COLORS.snow, fontSize: 16, fontWeight: '700', marginTop: 8, letterSpacing: -0.3 },
  park: { color: COLORS.mute, fontSize: 13, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  meta: { color: COLORS.neutral500, fontSize: 12, marginLeft: 5 },

  fillBarContainer: {
    backgroundColor: COLORS.neutral200, borderRadius: 3, height: 4,
    marginTop: 10, overflow: 'hidden',
  },
  fillBar: { backgroundColor: COLORS.neutral400, borderRadius: 3, height: '100%' },
  fillBarConfirmed: { backgroundColor: COLORS.primary },
  fillText: { color: COLORS.mute, fontSize: 12 },

  spotsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  spotsBadge: {
    fontSize: 11, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.limeDim,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  spotsBadgeConfirmed: { color: COLORS.ink, backgroundColor: COLORS.primary },
  spotsBadgeForming: { color: COLORS.warning, backgroundColor: 'rgba(253,186,116,0.14)' },
  spotsBadgeFull: { color: COLORS.mute, backgroundColor: COLORS.neutral100 },

  /* avatars */
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    borderWidth: 2, borderColor: COLORS.ink,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 9, fontWeight: '800', color: COLORS.primary },
  avatarExtra: { backgroundColor: COLORS.neutral200 },
  avatarCount: { color: COLORS.mute, fontSize: 12, marginLeft: 8 },

  /* empty */
  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyMark: {
    width: 14, height: 14, backgroundColor: COLORS.primary,
    borderRadius: 3, transform: [{ rotate: '45deg' }], marginBottom: 18,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.snow },
  emptyText: { fontSize: 14, color: COLORS.mute, marginTop: 6, textAlign: 'center' },

  /* fab + map close */
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  mapClose: {
    position: 'absolute', top: 55, right: 20,
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
});