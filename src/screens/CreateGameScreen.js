import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import DateTimePicker from '../components/datePicker';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import Celebration from '../components/Celebration';
import { loadCelebrationSettings } from '../lib/celebrationSettings';

/*
 * Create Game, Clubhouse style. Four numbered sections:
 *   1 What   sport, title, level
 *   2 Where  venue (searchable once there are more than a few)
 *   3 When   date, time, length, repeat weekly
 *   4 Who    max players and how many confirm the game
 * The bottom bar shows each player's share and posts the game.
 */
const SPORTS = [
  { label: 'Soccer', value: 'soccer', icon: 'football-outline' },
  { label: 'Basketball', value: 'basketball', icon: 'basketball-outline' },
  { label: 'Flag football', value: 'flag_football', icon: 'american-football-outline' },
  { label: 'Track', value: 'track', icon: 'stopwatch-outline' },
  { label: 'Ultimate', value: 'ultimate', icon: 'disc-outline' },
];
const SKILL_LEVELS = [
  { value: 'Beginner', hint: 'New players welcome' },
  { value: 'Intermediate', hint: 'Regulars, friendly pace' },
  { value: 'Advanced', hint: 'Fast and competitive' },
];
const DURATIONS = [60, 90, 120];
const MIN_ROSTER = 2;
const MAX_ROSTER = 30;
const SEARCH_FROM = 6; // show venue search when there are more venues than this

const durationLabel = (mins) => (mins === 60 ? '1 hr' : mins === 90 ? '1.5 hr' : '2 hr');

function roundToNextHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/* A numbered section with a heading, the Clubhouse way. */
function Section({ step, title, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.stepDot}>
          <Text style={styles.stepText}>{step}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

/* − 10 + for player counts: no keyboard, no typos. */
function Stepper({ label, hint, value, min, max, onChange }) {
  return (
    <View style={styles.stepperRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldHint}>{hint}</Text>
      </View>
      <TouchableOpacity
        style={[styles.stepBtn, value <= min && styles.stepBtnOff]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityLabel={`Fewer: ${label}`}
      >
        <Ionicons name="remove" size={18} color={value <= min ? COLORS.neutral400 : COLORS.primary} />
      </TouchableOpacity>
      <Text style={styles.stepValue} accessibilityLabel={`${label}: ${value}`}>{value}</Text>
      <TouchableOpacity
        style={[styles.stepBtn, value >= max && styles.stepBtnOff]}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        accessibilityLabel={`More: ${label}`}
      >
        <Ionicons name="add" size={18} color={value >= max ? COLORS.neutral400 : COLORS.primary} />
      </TouchableOpacity>
    </View>
  );
}

export default function CreateGameScreen({ userId, onClose, initialParkId = null, initialStart = null }) {
  const [parks, setParks] = useState([]);
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState('soccer');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [parkId, setParkId] = useState(initialParkId || '');
  const [venueSearch, setVenueSearch] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [minPlayers, setMinPlayers] = useState(8);
  // A time picked on the venue page, otherwise the next whole hour
  const [startTime, setStartTime] = useState(initialStart ? new Date(initialStart) : roundToNextHour(new Date()));
  const [duration, setDuration] = useState(90);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [celebration, setCelebration] = useState({ animations: true, sounds: true }); // Profile switches
  const [celebrating, setCelebrating] = useState(null); // { title, subtitle } once the game is saved

  useEffect(() => {
    loadCelebrationSettings().then(setCelebration);
  }, []);

  useEffect(() => {
    async function fetchParks() {
      const { data } = await supabase
        .from('parks')
        .select('park_id, name, sports, hourly_rate, city, verification_status')
        .eq('status', 'active')
        .order('name');
      if (data && data.length > 0) {
        setParks(data);
        // Opened from a venue: switch to a sport that venue offers so it stays selected.
        const preselected = initialParkId ? data.find((p) => p.park_id === initialParkId) : null;
        const venueSports = preselected?.sports || [];
        if (venueSports.length > 0 && !venueSports.includes(sport)) setSport(venueSports[0]);
      }
    }
    fetchParks();
  }, []);

  const availableParks = parks.filter((p) => (p.sports || []).includes(sport));

  useEffect(() => {
    if (parks.length === 0) return; // venues not loaded yet; keep the preselected one
    if (parkId && !availableParks.some((p) => p.park_id === parkId)) {
      setParkId('');
    }
  }, [sport]);

  // Keep "confirm at" no higher than the roster size
  useEffect(() => {
    if (minPlayers > maxPlayers) setMinPlayers(maxPlayers);
  }, [maxPlayers, minPlayers]);

  // Preselected venue comes from Explore. Venue rates remain read-only in the UI.
  const selectedPark = parks.find((p) => p.park_id === parkId) || null;
  const rate = Number(selectedPark?.hourly_rate) || 0;
  const isFreeField = !!selectedPark && rate <= 0;

  // The chosen venue first, then the rest, filtered by the search box
  const query = venueSearch.trim().toLowerCase();
  const shownParks = availableParks
    .filter((p) => p.park_id === parkId || !query || `${p.name} ${p.city || ''}`.toLowerCase().includes(query))
    .sort((a, b) => (a.park_id === parkId ? -1 : b.park_id === parkId ? 1 : 0));

  /* what each player pays, at the roster size the organizer picked */
  const split = (() => {
    if (!selectedPark || isFreeField) return null;
    const total = rate * (duration / 60);
    if (!maxPlayers) return null;
    return {
      total,
      atFull: total / maxPlayers,
      atMin: minPlayers > 0 ? total / minPlayers : null,
    };
  })();

  function onDateChange(event, selected) {
    setShowDatePicker(Platform.OS === 'ios');
    if (!selected) return;
    const next = new Date(startTime);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    setStartTime(next);
  }

  function onTimeChange(event, selected) {
    setShowTimePicker(Platform.OS === 'ios');
    if (!selected) return;
    const next = new Date(startTime);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setStartTime(next);
  }

  const dateLabel = startTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endLabel = new Date(startTime.getTime() + duration * 60000)
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  async function handlePostGame() {
    if (!title.trim() || title.trim().length < 3) {
      return Alert.alert('Add a title', 'Give your game a name of at least 3 characters, like "Thursday 7v7".');
    }
    if (!parkId) return Alert.alert('Pick a venue', 'Choose where you’re playing.');
    if (startTime.getTime() < Date.now()) {
      return Alert.alert('Check the time', 'Pick a start time in the future.');
    }
    if (minPlayers > maxPlayers) {
      return Alert.alert('Check player counts', 'The number to confirm can’t be more than the roster size.');
    }

    setLoading(true);
    try {
      const endTime = new Date(startTime.getTime() + duration * 60000);

      // legacy column — the real share is computed from the park rate at read time
      const legacyPerPlayer = split ? Number(split.atFull.toFixed(2)) : 0;

      if (repeatWeekly) {
        const { error: seriesError } = await supabase.from('game_series').insert({
          organizer_id: userId,
          park_id: parkId,
          title: title.trim(),
          sport,
          skill_level: skillLevel.toLowerCase(),
          day_of_week: startTime.getDay(),
          start_hour: startTime.getHours(),
          start_minute: startTime.getMinutes(),
          duration_minutes: duration,
          max_players: maxPlayers,
          min_players_to_confirm: minPlayers,
          base_price_per_player: legacyPerPlayer,
        });
        if (seriesError) throw seriesError;

        const { error: genError } = await supabase.rpc('generate_series_games');
        if (genError) throw genError;

        if (celebration.animations) {
          const weekday = startTime.toLocaleDateString([], { weekday: 'long' });
          setCelebrating({ title: title.trim(), subtitle: `${title.trim()} · Every ${weekday}, ${timeLabel}` });
          return; // the celebration closes this screen when it ends
        }
        Alert.alert('Weekly game created', 'It’s on the map for the next 4 weeks.');
      } else {
        const { error } = await supabase.from('games').insert({
          sport,
          title: title.trim(),
          park_id: parkId,
          organizer_id: userId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          max_players: maxPlayers,
          min_players_to_confirm: minPlayers,
          base_price_per_player: legacyPerPlayer,
          skill_level: skillLevel.toLowerCase(),
          status: 'open',
        });
        if (error) throw error;
        if (celebration.animations) {
          setCelebrating({ title: title.trim(), subtitle: `${title.trim()} · ${dateLabel}, ${timeLabel}` });
          return; // the celebration closes this screen when it ends
        }
        Alert.alert('Your game is live', 'Players nearby can find it and join.');
      }

      onClose();
    } catch (error) {
      Alert.alert('Could not post the game', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.glassTint} pointerEvents="none" />

      <View style={styles.header}>
        <View style={styles.grabber} />
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>New game</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={COLORS.snow} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* 1 WHAT */}
        <Section step={1} title="What">
          <Text style={styles.fieldLabel}>Sport</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SPORTS.map((sp) => {
              const on = sport === sp.value;
              return (
                <TouchableOpacity
                  key={sp.value}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setSport(sp.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={sp.icon} size={15} color={on ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{sp.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={[styles.fieldLabel, styles.gap]}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Thursday 7v7"
            placeholderTextColor={COLORS.neutral400}
            value={title}
            onChangeText={setTitle}
            maxLength={60}
            returnKeyType="done"
          />

          <Text style={[styles.fieldLabel, styles.gap]}>Level</Text>
          <View style={styles.levelRow}>
            {SKILL_LEVELS.map((lvl) => {
              const on = skillLevel === lvl.value;
              return (
                <TouchableOpacity
                  key={lvl.value}
                  style={[styles.level, on && styles.levelOn]}
                  onPress={() => setSkillLevel(lvl.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.levelName, on && styles.levelNameOn]}>{lvl.value}</Text>
                  <Text style={[styles.levelHint, on && styles.levelHintOn]}>{lvl.hint}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        {/* 2 WHERE */}
        <Section step={2} title="Where">
          {availableParks.length > SEARCH_FROM && (
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={COLORS.mute} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search venues or cities"
                placeholderTextColor={COLORS.neutral400}
                value={venueSearch}
                onChangeText={setVenueSearch}
              />
            </View>
          )}
          {availableParks.length === 0 ? (
            <Text style={styles.empty}>No venues list this sport yet.</Text>
          ) : shownParks.length === 0 ? (
            <Text style={styles.empty}>No venues match "{venueSearch}".</Text>
          ) : (
            shownParks.map((park) => {
              const parkRate = Number(park.hourly_rate) || 0;
              const on = parkId === park.park_id;
              const verified = park.verification_status === 'approved';
              return (
                <TouchableOpacity
                  key={park.park_id}
                  style={[styles.venue, on && styles.venueOn]}
                  onPress={() => setParkId(park.park_id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.venueNameRow}>
                      <Text style={[styles.venueName, on && styles.venueNameOn]} numberOfLines={1}>
                        {park.name}
                      </Text>
                      {verified && <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />}
                    </View>
                    <Text style={styles.venueMeta}>
                      {parkRate > 0 ? `$${parkRate % 1 === 0 ? parkRate.toFixed(0) : parkRate.toFixed(2)}/hr` : 'Free field'}
                      {park.city ? ` · ${park.city}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={on ? COLORS.primary : COLORS.neutral300}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </Section>

        {/* 3 WHEN */}
        <Section step={3} title="When">
          <View style={styles.whenRow}>
            <TouchableOpacity style={[styles.whenBtn, { flex: 1.3 }]} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={17} color={COLORS.primary} />
              <Text style={styles.whenText}>{dateLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.whenBtn, { flex: 1 }]} onPress={() => setShowTimePicker(true)}>
              <Ionicons name="time-outline" size={17} color={COLORS.primary} />
              <Text style={styles.whenText}>{timeLabel}</Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={startTime}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={onDateChange}
              accentColor={COLORS.primary}
              themeVariant="light"
              style={styles.picker}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={startTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minuteInterval={15}
              onChange={onTimeChange}
              textColor={COLORS.snow}
              themeVariant="light"
              style={styles.picker}
            />
          )}
          {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setShowDatePicker(false);
                setShowTimePicker(false);
              }}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.fieldLabel, styles.gap]}>How long</Text>
          <View style={styles.segment}>
            {DURATIONS.map((mins) => {
              const on = duration === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  style={[styles.segmentItem, on && styles.segmentOn]}
                  onPress={() => setDuration(mins)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{durationLabel(mins)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.fieldHint}>Ends at {endLabel}</Text>

          <TouchableOpacity
            style={[styles.repeat, repeatWeekly && styles.repeatOn]}
            onPress={() => setRepeatWeekly(!repeatWeekly)}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: repeatWeekly }}
          >
            <Ionicons name="repeat" size={19} color={repeatWeekly ? COLORS.white : COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.repeatTitle, repeatWeekly && styles.repeatTitleOn]}>Repeat weekly</Text>
              <Text style={[styles.repeatSub, repeatWeekly && styles.repeatSubOn]}>
                {repeatWeekly
                  ? `Every ${startTime.toLocaleDateString([], { weekday: 'long' })} at ${timeLabel}, 4 weeks ahead`
                  : 'Make this a regular game'}
              </Text>
            </View>
            <Ionicons
              name={repeatWeekly ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={repeatWeekly ? COLORS.white : COLORS.neutral300}
            />
          </TouchableOpacity>
        </Section>

        {/* 4 WHO */}
        <Section step={4} title="Who">
          <Stepper
            label="Roster size"
            hint="Most players who can join"
            value={maxPlayers}
            min={MIN_ROSTER}
            max={MAX_ROSTER}
            onChange={setMaxPlayers}
          />
          <View style={styles.rule} />
          <Stepper
            label="Confirms at"
            hint="The game goes ahead once this many join"
            value={minPlayers}
            min={MIN_ROSTER}
            max={maxPlayers}
            onChange={setMinPlayers}
          />
        </Section>

        {/* THE SPLIT */}
        {selectedPark && (
          <View style={styles.splitCard}>
            <Text style={styles.splitLabel}>THE SPLIT</Text>
            {isFreeField ? (
              <>
                <Text style={styles.splitFree}>Free field</Text>
                <Text style={styles.splitNote}>{selectedPark.name} doesn't charge, so nobody pays.</Text>
              </>
            ) : split ? (
              <>
                <View style={styles.splitRow}>
                  <Text style={styles.splitKey}>Field · {durationLabel(duration)}</Text>
                  <Text style={styles.splitVal}>${split.total.toFixed(2)}</Text>
                </View>
                <View style={styles.splitRow}>
                  <Text style={styles.splitKey}>Split between</Text>
                  <Text style={styles.splitVal}>{maxPlayers} players</Text>
                </View>
                {split.atMin && split.atMin !== split.atFull && (
                  <Text style={styles.splitNote}>
                    ${split.atMin.toFixed(2)} each if only {minPlayers} join
                  </Text>
                )}
              </>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* POST BAR */}
      <View style={styles.bar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.barPrice}>
            {!selectedPark ? 'Pick a venue' : isFreeField ? 'Free' : split ? `$${split.atFull.toFixed(2)}` : ''}
          </Text>
          <Text style={styles.barSub}>
            {!selectedPark ? 'to see the split' : isFreeField ? 'nothing to pay' : 'each, when the roster fills'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.postBtn, loading && { opacity: 0.6 }]}
          onPress={handlePostGame}
          disabled={loading || !!celebrating} // saved already: no second post under the celebration
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.postText}>{repeatWeekly ? 'Create weekly game' : 'Post game'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {celebrating && (
        <Celebration
          sport={sport}
          mode="created"
          isWeekly={repeatWeekly}
          title={celebrating.title}
          subtitle={celebrating.subtitle}
          settings={celebration}
          onDone={onClose}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, marginTop: 56, overflow: 'hidden',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 24, elevation: 10,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244,240,230,0.94)', // cream page, a touch of glass at the edges
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },

  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORS.neutral300 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  headerTitle: { fontFamily: FONTS.display, fontSize: 28, lineHeight: 34, color: COLORS.snow, letterSpacing: -0.4 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.cardFill, borderWidth: 1, borderColor: COLORS.line,
  },

  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },

  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  stepText: { color: COLORS.white, fontSize: 12.5, fontWeight: '800' },
  sectionTitle: { fontFamily: FONTS.displaySemi, fontSize: 20, color: COLORS.snow },
  sectionCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: COLORS.line,
  },

  fieldLabel: { color: COLORS.snow, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  fieldHint: { color: COLORS.mute, fontSize: 12.5, lineHeight: 17, marginTop: 6 },
  gap: { marginTop: 16 },

  chipRow: { gap: 8, paddingRight: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20,
    backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.snow, fontSize: 13.5, fontWeight: '600' },
  chipTextOn: { color: COLORS.white, fontWeight: '800' },

  input: {
    height: 50, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: COLORS.snow,
    backgroundColor: COLORS.neutral50, borderWidth: 1, borderColor: COLORS.line,
  },

  levelRow: { flexDirection: 'row', gap: 8 },
  level: {
    flex: 1, padding: 10, borderRadius: 14,
    backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  levelOn: { backgroundColor: COLORS.sage, borderColor: COLORS.primary },
  levelName: { color: COLORS.snow, fontSize: 13, fontWeight: '800' },
  levelNameOn: { color: COLORS.primary },
  levelHint: { color: COLORS.mute, fontSize: 11, marginTop: 3, lineHeight: 14 },
  levelHintOn: { color: COLORS.primary },

  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12,
    borderRadius: 12, marginBottom: 10, backgroundColor: COLORS.neutral50, borderWidth: 1, borderColor: COLORS.line,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.snow, height: '100%' },
  venue: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, marginBottom: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  venueOn: { backgroundColor: COLORS.limeDim, borderColor: COLORS.primary },
  venueNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  venueName: { color: COLORS.snow, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  venueNameOn: { fontWeight: '800' },
  venueMeta: { color: COLORS.mute, fontSize: 12.5, marginTop: 3 },
  empty: { color: COLORS.mute, fontSize: 14, fontStyle: 'italic', paddingVertical: 6 },

  whenRow: { flexDirection: 'row', gap: 10 },
  whenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50,
    borderRadius: 14, backgroundColor: COLORS.neutral50, borderWidth: 1, borderColor: COLORS.line,
  },
  whenText: { color: COLORS.snow, fontSize: 15, fontWeight: '700' },
  picker: { width: '100%', marginTop: 8 },
  doneBtn: {
    alignSelf: 'center', marginTop: 6, paddingHorizontal: 28, paddingVertical: 10,
    borderRadius: 12, backgroundColor: COLORS.primary,
  },
  doneText: { color: COLORS.white, fontWeight: '800' },

  segment: {
    flexDirection: 'row', padding: 3, borderRadius: 14,
    backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  segmentOn: { backgroundColor: COLORS.cardFill, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 1 },
  segmentText: { color: COLORS.mute, fontSize: 14, fontWeight: '700' },
  segmentTextOn: { color: COLORS.primary, fontWeight: '800' },

  repeat: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 13,
    borderRadius: 14, backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  repeatOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  repeatTitle: { color: COLORS.snow, fontSize: 15, fontWeight: '700' },
  repeatTitleOn: { color: COLORS.white },
  repeatSub: { color: COLORS.mute, fontSize: 12, marginTop: 2 },
  repeatSubOn: { color: 'rgba(255,253,248,0.8)' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.sage,
  },
  stepBtnOff: { backgroundColor: COLORS.neutral100 },
  stepValue: { minWidth: 30, textAlign: 'center', color: COLORS.snow, fontSize: 20, fontWeight: '800' },
  rule: { height: 1, backgroundColor: COLORS.line, marginVertical: 14 },

  splitCard: {
    marginTop: 18, padding: 16, borderRadius: 20,
    backgroundColor: COLORS.sage, borderWidth: 1, borderColor: 'rgba(23,68,47,0.18)',
  },
  splitLabel: { color: COLORS.primary, fontSize: 10.5, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  splitKey: { color: COLORS.forestDeep, fontSize: 14 },
  splitVal: { color: COLORS.forestDeep, fontSize: 14, fontWeight: '700' },
  splitFree: { fontFamily: FONTS.displaySemi, fontSize: 22, color: COLORS.primary },
  splitNote: { color: COLORS.primary, fontSize: 12.5, marginTop: 6, fontWeight: '600' },

  bar: {
    position: 'absolute', left: 12, right: 12, bottom: 24,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 18, paddingRight: 8, paddingVertical: 8, borderRadius: 24,
    backgroundColor: COLORS.cardFill, borderWidth: 1, borderColor: COLORS.line,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  barPrice: { color: COLORS.snow, fontSize: 19, fontWeight: '800' },
  barSub: { color: COLORS.mute, fontSize: 12, marginTop: 1 },
  postBtn: {
    height: 50, paddingHorizontal: 22, borderRadius: 18,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  postText: { color: COLORS.white, fontSize: 15.5, fontWeight: '800' },
});
