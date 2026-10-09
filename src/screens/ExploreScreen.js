import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, FlatList, Image, StyleSheet,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import MapView, { Marker } from 'react-native-maps';
import { SatellitePreview, VenueSatelliteMap, MapTypeToggle } from '../components/SatelliteView';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { MAP_STYLE } from '../theme/mapStyle';
import LegacyExploreScreen from './LegacyExploreScreen';

const SPORTS = [
  { id: 'all', label: 'All sports', icon: null },
  { id: 'soccer', label: 'Soccer', icon: 'football-outline' },
  { id: 'basketball', label: 'Basketball', icon: 'basketball-outline' },
  { id: 'flag_football', label: 'Flag football', icon: 'american-football-outline' },
  { id: 'track', label: 'Track', icon: 'stopwatch-outline' },
  { id: 'ultimate', label: 'Ultimate', icon: 'disc-outline' },
];

const PRICES = [
  { id: 'all', label: 'Any price' },
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' },
];

const SCREEN_W = Dimensions.get('window').width;

const isVerified = (venue) => venue?.verification_status === 'approved';
const photosOf = (venue) =>
  Array.isArray(venue?.photos) ? venue.photos.filter((x) => typeof x === 'string' && /^https?:\/\//.test(x)) : [];
const sportName = (s) => String(s).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const sportsLine = (venue) =>
  Array.isArray(venue?.sports) && venue.sports.length ? venue.sports.map(sportName).join(', ') : 'Sports not listed';
const placeLine = (venue) => [venue?.city, venue?.state].filter(Boolean).join(', ');

function rate(venue) {
  const v = Number(venue?.hourly_rate);
  if (venue?.hourly_rate == null || !Number.isFinite(v) || v < 0) return { text: 'Rate not listed', free: false, known: false };
  if (v === 0) return { text: 'Free', free: true, known: true };
  return { text: `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}/hr`, free: false, known: true };
}

/* Small frosted chip that sits on top of a photo. */
function PhotoChip({ icon, text, style }) {
  return (
    <View style={[s.photoChip, style]}>
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <View style={s.photoChipTint} />
      {icon ? <Ionicons name={icon} size={13} color={COLORS.primary} /> : null}
      <Text style={s.photoChipText}>{text}</Text>
    </View>
  );
}

function PhotoOrPlaceholder({ venue, height, radius }) {
  const photo = photosOf(venue)[0];
  if (photo) {
    return <Image source={{ uri: photo }} style={{ width: '100%', height, borderRadius: radius }} accessibilityIgnoresInvertColors />;
  }
  // No photos yet: show the field from above instead, when we know where it is.
  if (venue?.latitude != null && venue?.longitude != null) {
    return <SatellitePreview venue={venue} height={height} radius={radius} />;
  }
  return (
    <View style={[s.placeholder, { height, borderRadius: radius }]}>
      <Ionicons name="image-outline" size={30} color={COLORS.primary} />
      <Text style={s.placeholderText}>No photo yet</Text>
    </View>
  );
}

function VenueCard({ venue, onPress }) {
  const r = rate(venue);
  const verified = isVerified(venue);
  const photoCount = photosOf(venue).length;
  const place = placeLine(venue);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={s.card} accessibilityRole="button" accessibilityLabel={`${venue.name}, ${r.text}`}>
      <View>
        <PhotoOrPlaceholder venue={venue} height={196} radius={24} />
        <PhotoChip
          icon={verified ? 'shield-checkmark' : 'information-circle-outline'}
          text={verified ? 'Verified venue' : 'Not yet verified'}
          style={{ left: 10, top: 10 }}
        />
        {photoCount > 1 ? <PhotoChip text={`1 / ${photoCount}`} style={{ right: 10, bottom: 10 }} /> : null}
      </View>
      <Text style={s.cardTitle} numberOfLines={1}>{venue.name}</Text>
      <Text style={s.cardMeta} numberOfLines={1}>{place ? `${sportsLine(venue)} · ${place}` : sportsLine(venue)}</Text>
      <View style={s.cardPriceRow}>
        <Text style={[s.price, !r.known && { color: COLORS.mute }]}>{r.text}</Text>
        {verified && r.known && !r.free ? <Text style={s.verifiedRate}>Verified rate</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

function Fact({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={s.fact}>
      <Ionicons name={icon} size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={s.factLabel}>{label}</Text>
        <Text style={s.factValue}>{value}</Text>
      </View>
    </View>
  );
}

function VenueDetail({ venue, onClose, onCreateGame, onViewGames }) {
  const photos = photosOf(venue);
  const r = rate(venue);
  const verified = isVerified(venue);
  const place = [venue?.address, placeLine(venue)].filter(Boolean).join(', ');
  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} bounces={false}>
        <View>
          {photos.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {photos.map((url) => (
                <Image key={url} source={{ uri: url }} style={{ width: SCREEN_W, height: 330 }} />
              ))}
            </ScrollView>
          ) : (
            <PhotoOrPlaceholder venue={venue} height={260} radius={0} />
          )}
          {photos.length > 1 ? <PhotoChip text={`${photos.length} photos, swipe`} style={{ right: 16, bottom: 46 }} /> : null}
        </View>

        <View style={s.sheet}>
          <Text style={s.detailTitle}>{venue?.name}</Text>
          {place ? <Text style={s.detailMeta}>{place}</Text> : null}
          <Text style={s.detailMeta}>{sportsLine(venue)}</Text>

          {verified ? (
            <View style={s.verifiedBox}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
              <Text style={s.verifiedBoxText}>
                Verified by Grassroots. We confirmed the owner, location, price and photos.
              </Text>
            </View>
          ) : (
            <View style={s.noticeBox}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.warning} />
              <Text style={s.noticeText}>
                This venue isn't verified yet. The price and availability haven't been confirmed with an owner.
              </Text>
            </View>
          )}

          <View style={s.factCard}>
            <Fact icon="pricetag-outline" label="Price" value={r.free ? 'Free to use' : r.known ? `${r.text.replace('/hr', '')} per hour` : null} />
            <Fact icon="time-outline" label="When to book" value={venue?.availability} />
            <Fact icon="leaf-outline" label="Surface" value={venue?.surface} />
            <Fact icon="bulb-outline" label="Lights" value={venue?.lights_until ? `Until ${venue.lights_until}` : null} />
            <Fact icon="car-outline" label="Parking" value={venue?.parking} />
            <Fact icon="document-text-outline" label="Field rules" value={venue?.rules} />
          </View>

          {venue?.latitude != null && venue?.longitude != null ? (
            <>
              <Text style={s.sectionLabel}>From above</Text>
              <Text style={s.sectionHint}>Satellite imagery, so it may be a little out of date. Pinch to zoom.</Text>
              <VenueSatelliteMap venue={venue} />
            </>
          ) : null}

          <TouchableOpacity style={s.linkRow} onPress={onViewGames}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={s.linkRowText}>See games already planned here</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.mute} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity onPress={onClose} style={s.backBtn} accessibilityLabel="Back to Explore">
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
        <View style={s.photoChipTint} />
        <Ionicons name="chevron-back" size={22} color={COLORS.snow} />
      </TouchableOpacity>

      <View style={s.bookBarWrap}>
        <View style={s.bookBar}>
          <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
          <View style={s.photoChipTint} />
          <View style={{ flex: 1, paddingLeft: 14 }}>
            <Text style={s.bookPrice}>{r.text}</Text>
            <Text style={s.bookSub}>{verified ? 'Split between your players' : 'Price not confirmed'}</Text>
          </View>
          <TouchableOpacity style={s.bookBtn} onPress={onCreateGame}>
            <Text style={s.bookBtnText}>Create a game</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ExploreScreen({ userLocation, onSelectGame, onCreateGame, onSelectPark, userId }) {
  const [tab, setTab] = useState('venues');
  const [view, setView] = useState('list');
  const [mapSatellite, setMapSatellite] = useState(false); // Explore map: regular or satellite
  const [venues, setVenues] = useState([]);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState('all');
  const [cost, setCost] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loadError, setLoadError] = useState('');

  async function load() {
    const { data, error } = await supabase.from('parks').select('*').eq('status', 'active').order('name');
    if (error) {
      setLoadError(error.message);
      setVenues([]);
    } else {
      setLoadError('');
      setVenues(data || []);
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const result = useMemo(
    () =>
      venues
        .filter((v) => {
          const q = query.trim().toLowerCase();
          if (q && !`${v.name || ''} ${v.city || ''} ${v.state || ''} ${v.address || ''}`.toLowerCase().includes(q)) return false;
          if (sport !== 'all' && !(Array.isArray(v.sports) && v.sports.includes(sport))) return false;
          if (cost === 'free' && Number(v.hourly_rate) !== 0) return false;
          if (cost === 'paid' && !(Number(v.hourly_rate) > 0)) return false;
          return true;
        })
        .sort((a, b) => Number(isVerified(b)) - Number(isVerified(a))),
    [venues, query, sport, cost]
  );

  const verifiedCount = result.filter(isVerified).length;
  const markers = result.filter(
    (v) => v.latitude != null && v.longitude != null && Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude))
  );
  const region = {
    latitude: userLocation?.latitude ?? 39.7684,
    longitude: userLocation?.longitude ?? -86.1581,
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  };

  const header = (
    <View>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={s.brandRow}>
            <Text style={s.wordmark}>grassroots</Text>
            <View style={s.brandBall}>
              <Ionicons name="football" size={13} color={COLORS.white} />
            </View>
          </View>
          <Text style={s.tagline}>Find a field. Create a game. Split the cost.</Text>
        </View>
        <TouchableOpacity style={s.createBtn} onPress={() => onCreateGame?.(null)} accessibilityLabel="Create a game">
          <Ionicons name="add" size={18} color={COLORS.ink} />
          <Text style={s.createBtnText}>Create game</Text>
        </TouchableOpacity>
      </View>

      <View style={s.segment}>
        {[
          ['venues', 'Venues'],
          ['games', 'Games'],
        ].map(([id, label]) => (
          <TouchableOpacity
            key={id}
            onPress={() => setTab(id)}
            style={[s.segmentBtn, tab === id && s.segmentOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
          >
            <Text style={[s.segmentText, tab === id && s.segmentTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (tab === 'games') {
    return (
      <View style={s.container}>
        {header}
        <LegacyExploreScreen
          userLocation={userLocation}
          userId={userId}
          onSelectGame={onSelectGame}
          onSelectPark={onSelectPark}
          onCreateGame={onCreateGame}
        />
      </View>
    );
  }

  const filters = (
    <View>
      <View style={s.searchRow}>
        <View style={s.search}>
          <Ionicons name="search" color={COLORS.mute} size={19} />
          <TextInput
            style={s.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search venues or neighborhoods"
            placeholderTextColor={COLORS.faint}
            returnKeyType="search"
            accessibilityLabel="Search venues"
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={COLORS.faint} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setView(view === 'list' ? 'map' : 'list')}
          style={s.mapBtn}
          accessibilityLabel={view === 'list' ? 'Show map' : 'Show list'}
        >
          <Ionicons name={view === 'list' ? 'map-outline' : 'list-outline'} size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {SPORTS.map((sp) => {
          const on = sport === sp.id;
          return (
            <TouchableOpacity
              key={sp.id}
              onPress={() => setSport(sp.id)}
              style={[s.chip, on && s.chipOn]}
              accessibilityState={{ selected: on }}
            >
              {sp.icon ? <Ionicons name={sp.icon} size={15} color={on ? COLORS.ink : COLORS.snow} /> : null}
              <Text style={[s.chipText, on && s.chipTextOn]}>{sp.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.countRow}>
        <Text style={s.count}>
          <Text style={s.countStrong}>{result.length}</Text> {result.length === 1 ? 'venue' : 'venues'}
          {verifiedCount > 0 ? `, ${verifiedCount} verified` : ''}
        </Text>
        <View style={s.priceChips}>
          {PRICES.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setCost(p.id)}
              style={[s.priceChip, cost === p.id && s.priceChipOn]}
              accessibilityState={{ selected: cost === p.id }}
            >
              <Text style={[s.priceChipText, cost === p.id && s.priceChipTextOn]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={s.container}>
      {view === 'list' ? (
        <FlatList
          data={loading || loadError ? [] : result}
          keyExtractor={(v) => String(v.park_id)}
          contentContainerStyle={s.list}
          // Cards without photos show a live satellite map; keep only a few mounted at once
          initialNumToRender={4}
          windowSize={5}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              {header}
              {filters}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={COLORS.primary}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await load();
                } finally {
                  setRefreshing(false);
                }
              }}
            />
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ marginTop: 36 }} color={COLORS.primary} />
            ) : loadError ? (
              <Text style={s.empty}>Couldn't load venues. Pull down to try again.</Text>
            ) : (
              <View style={s.emptyBox}>
                <Text style={s.emptyTitle}>No venues match</Text>
                <Text style={s.empty}>Try another sport or price, or clear your search.</Text>
              </View>
            )
          }
          renderItem={({ item }) => <VenueCard venue={item} onPress={() => setSelected(item)} />}
        />
      ) : (
        <View style={{ flex: 1 }}>
          {header}
          {filters}
          <View style={s.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              mapType={mapSatellite ? 'hybrid' : 'standard'}
              customMapStyle={mapSatellite ? undefined : MAP_STYLE}
              initialRegion={region}
            >
              {markers.map((v) => (
                <Marker
                  key={String(v.park_id)}
                  coordinate={{ latitude: Number(v.latitude), longitude: Number(v.longitude) }}
                  title={v.name}
                  description={`${rate(v).text}${isVerified(v) ? ' · Verified' : ''}`}
                  pinColor={isVerified(v) ? COLORS.primary : COLORS.clay}
                  onCalloutPress={() => setSelected(v)}
                />
              ))}
            </MapView>
            <MapTypeToggle satellite={mapSatellite} onChange={setMapSatellite} style={{ top: 12, right: 12 }} />
          </View>
        </View>
      )}

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected ? (
          <VenueDetail
            venue={selected}
            onClose={() => setSelected(null)}
            onCreateGame={() => {
              const v = selected;
              setSelected(null);
              onCreateGame?.(v);
            }}
            onViewGames={() => {
              const v = selected;
              setSelected(null);
              onSelectPark?.(v);
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },

  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  wordmark: { fontFamily: FONTS.display, fontSize: 30, lineHeight: 34, color: COLORS.snow, letterSpacing: -0.6 },
  brandBall: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.clay, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  tagline: { color: COLORS.mute, fontSize: 13, marginTop: 4 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 44, paddingLeft: 12, paddingRight: 16,
    borderRadius: 22, backgroundColor: COLORS.primary, marginTop: 2,
  },
  createBtnText: { color: COLORS.ink, fontWeight: '700', fontSize: 15 },

  segment: {
    flexDirection: 'row', marginHorizontal: 18, marginBottom: 12, padding: 4, borderRadius: 23,
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  segmentBtn: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  segmentOn: { backgroundColor: COLORS.sage },
  segmentText: { color: COLORS.mute, fontWeight: '600', fontSize: 15 },
  segmentTextOn: { color: COLORS.primary, fontWeight: '800' },

  searchRow: { flexDirection: 'row', gap: 8, marginHorizontal: 18 },
  search: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, height: 48, paddingHorizontal: 15, borderRadius: 24,
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  input: { flex: 1, color: COLORS.snow, fontSize: 15 },
  mapBtn: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder,
  },

  chips: { paddingHorizontal: 18, gap: 8, paddingVertical: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19,
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.snow, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: COLORS.ink, fontWeight: '700' },

  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 18, marginBottom: 12 },
  count: { color: COLORS.mute, fontSize: 13 },
  countStrong: { color: COLORS.snow, fontWeight: '800' },
  priceChips: { flexDirection: 'row', gap: 2 },
  priceChip: { height: 30, paddingHorizontal: 10, borderRadius: 15, justifyContent: 'center' },
  priceChipOn: { backgroundColor: COLORS.sage },
  priceChipText: { color: COLORS.mute, fontSize: 13, fontWeight: '600' },
  priceChipTextOn: { color: COLORS.primary, fontWeight: '800' },

  list: { paddingBottom: 120 },
  card: { marginHorizontal: 18, marginBottom: 26 },
  placeholder: { width: '100%', backgroundColor: COLORS.sage, alignItems: 'center', justifyContent: 'center', gap: 6 },
  placeholderText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  photoChip: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 11,
    borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  photoChipTint: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.glass },
  photoChipText: { color: COLORS.snow, fontSize: 12.5, fontWeight: '700' },
  cardTitle: { fontFamily: FONTS.display, fontSize: 23, lineHeight: 28, color: COLORS.snow, marginTop: 12, letterSpacing: -0.2 },
  cardMeta: { color: COLORS.mute, fontSize: 14, marginTop: 2 },
  cardPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  price: { color: COLORS.clay, fontSize: 19, fontWeight: '800' },
  verifiedRate: {
    color: COLORS.primary, backgroundColor: COLORS.sage, fontSize: 12, fontWeight: '700',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11, overflow: 'hidden',
  },

  emptyBox: { alignItems: 'center', paddingTop: 30 },
  emptyTitle: { fontFamily: FONTS.displaySemi, fontSize: 20, color: COLORS.snow },
  empty: { color: COLORS.mute, textAlign: 'center', padding: 10, lineHeight: 20 },

  mapWrap: { flex: 1, marginHorizontal: 12, marginBottom: 8, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line },

  sheet: { marginTop: -30, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: COLORS.ink, padding: 20 },
  detailTitle: { fontFamily: FONTS.display, fontSize: 30, lineHeight: 35, color: COLORS.snow, letterSpacing: -0.4 },
  detailMeta: { color: COLORS.mute, fontSize: 14.5, marginTop: 4 },
  verifiedBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: COLORS.sage,
  },
  verifiedBoxText: { flex: 1, color: COLORS.primary, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  noticeBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: 14, borderRadius: 16,
    backgroundColor: COLORS.clayLight,
  },
  noticeText: { flex: 1, color: COLORS.snow, fontSize: 14, lineHeight: 20 },
  sectionLabel: { marginTop: 26, color: COLORS.snow, fontSize: 18, fontFamily: FONTS.displaySemi },
  sectionHint: { marginTop: 3, color: COLORS.mute, fontSize: 13 },
  factCard: { marginTop: 14, borderRadius: 20, backgroundColor: COLORS.cardFill, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.line },
  fact: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  factLabel: { color: COLORS.mute, fontSize: 12.5 },
  factValue: { color: COLORS.snow, fontSize: 15, marginTop: 2, lineHeight: 20 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, marginTop: 6 },
  linkRowText: { flex: 1, color: COLORS.primary, fontWeight: '700', fontSize: 15 },

  backBtn: {
    position: 'absolute', top: 54, left: 16, width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  bookBarWrap: { position: 'absolute', left: 12, right: 12, bottom: 24 },
  bookBar: {
    flexDirection: 'row', alignItems: 'center', height: 76, borderRadius: 38, overflow: 'hidden', paddingRight: 8,
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  bookPrice: { color: COLORS.clay, fontSize: 18, fontWeight: '800' },
  bookSub: { color: COLORS.mute, fontSize: 12.5, marginTop: 1 },
  bookBtn: { height: 60, paddingHorizontal: 22, borderRadius: 30, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { color: COLORS.ink, fontWeight: '800', fontSize: 16 },
});
