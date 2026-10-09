import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';

const SPORTS = [
  { label: 'Soccer', value: 'soccer' },
  { label: 'Basketball', value: 'basketball' },
  { label: 'Flag Football', value: 'flag_football' },
  { label: 'Track', value: 'track' },
  { label: 'Ultimate', value: 'ultimate' },
];
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const DURATIONS = [60, 90, 120];

function roundToNextHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export default function CreateGameScreen({ userId, onClose, initialParkId = null }) {
  const [parks, setParks] = useState([]);
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState('soccer');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [parkId, setParkId] = useState(initialParkId || '');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [minPlayers, setMinPlayers] = useState('8');
  const [startTime, setStartTime] = useState(roundToNextHour(new Date()));
  const [duration, setDuration] = useState(90);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchParks() {
      const { data } = await supabase
        .from('parks')
        .select('park_id, name, sports, hourly_rate')
        .eq('status', 'active');
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

  // Preselected venue comes from Explore. Venue rates remain read-only in the UI.
  const selectedPark = parks.find((p) => p.park_id === parkId) || null;
  const rate = Number(selectedPark?.hourly_rate) || 0;
  const isFreeField = !!selectedPark && rate <= 0;

  /* what each player pays, at the roster size the organizer picked */
  const split = (() => {
    if (!selectedPark || isFreeField) return null;
    const hours = duration / 60;
    const total = rate * hours;
    const max = parseInt(maxPlayers) || 0;
    const min = parseInt(minPlayers) || 0;
    if (!max) return null;

    return {
      total,
      atFull: total / max,
      atMin: min > 0 ? total / min : null,
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

  const dateLabel = startTime.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const timeLabel = startTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  async function handlePostGame() {
    if (!title.trim() || title.trim().length < 3) {
      return Alert.alert('Missing Info', 'Please give your game a descriptive title (at least 3 characters)');
    }
    if (!parkId) return Alert.alert('Missing Info', 'Please select a venue');

    if (startTime.getTime() < Date.now()) {
      return Alert.alert('Check the time', 'Pick a start time in the future.');
    }

    const max = parseInt(maxPlayers) || 10;
    const min = parseInt(minPlayers) || 0;

    if (min > max) {
      return Alert.alert('Check player counts', 'Minimum to confirm cannot be more than max players.');
    }

    setLoading(true);
    try {
      const endTime = new Date(startTime.getTime() + duration * 60000);

      // legacy column — the real share is computed from the park rate at read time
      const legacyPerPlayer = split ? Number(split.atFull.toFixed(2)) : 0;

      if (repeatWeekly) {
        const { error: seriesError } = await supabase
          .from('game_series')
          .insert({
            organizer_id: userId,
            park_id: parkId,
            title: title.trim(),
            sport: sport,
            skill_level: skillLevel.toLowerCase(),
            day_of_week: startTime.getDay(),
            start_hour: startTime.getHours(),
            start_minute: startTime.getMinutes(),
            duration_minutes: duration,
            max_players: max,
            min_players_to_confirm: min,
            base_price_per_player: legacyPerPlayer,
          });

        if (seriesError) throw seriesError;

        const { error: genError } = await supabase.rpc('generate_series_games');
        if (genError) throw genError;

        Alert.alert('Series created', 'Your weekly game is live for the next 4 weeks');
      } else {
        const { error } = await supabase.from('games').insert({
          sport: sport,
          title: title.trim(),
          park_id: parkId,
          organizer_id: userId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          max_players: max,
          min_players_to_confirm: min,
          base_price_per_player: legacyPerPlayer,
          skill_level: skillLevel.toLowerCase(),
          status: 'open',
        });

        if (error) throw error;
        Alert.alert('Success', 'Your game is live');
      }

      onClose();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.glassTint} pointerEvents="none" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={26} color={COLORS.snow} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New game</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>SPORT</Text>
        <View style={styles.pillRow}>
          {SPORTS.map((sp) => (
            <TouchableOpacity
              key={sp.value}
              style={[styles.pill, sport === sp.value && styles.pillActive]}
              onPress={() => setSport(sp.value)}
            >
              <Text style={[styles.pillText, sport === sp.value && styles.pillTextActive]}>
                {sp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>VENUE</Text>
        <View style={styles.parkList}>
          {availableParks.length === 0 ? (
            <Text style={styles.noParks}>No venues listed for this sport yet</Text>
          ) : (
            availableParks.map((park) => {
              const parkRate = Number(park.hourly_rate) || 0;
              const active = parkId === park.park_id;

              return (
                <TouchableOpacity
                  key={park.park_id}
                  style={[styles.parkCard, active && styles.parkCardActive]}
                  onPress={() => setParkId(park.park_id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.parkName, active && styles.parkNameActive]}>
                      {park.name}
                    </Text>
                    <Text style={styles.parkRate}>
                      {parkRate > 0 ? `$${parkRate.toFixed(0)} per hour` : 'Free field'}
                    </Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <Text style={styles.label}>SKILL LEVEL</Text>
        <View style={styles.pillRow}>
          {SKILL_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.pill, skillLevel === level && styles.pillActive]}
              onPress={() => setSkillLevel(level)}
            >
              <Text style={[styles.pillText, skillLevel === level && styles.pillTextActive]}>
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>GAME TITLE</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="football-outline" size={19} color={COLORS.mute} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. Downtown 7v7"
            placeholderTextColor={COLORS.neutral400}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <Text style={styles.label}>WHEN</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.dateButton, { flex: 1.3 }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>{dateLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateButton, { flex: 1 }]}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={18} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>{timeLabel}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <View style={styles.pickerSheet}>
            <DateTimePicker
              value={startTime}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={onDateChange}
              textColor={COLORS.snow}
              themeVariant="dark"
              style={styles.picker}
            />
          </View>
        )}

        {showTimePicker && (
          <View style={styles.pickerSheet}>
            <DateTimePicker
              value={startTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minuteInterval={15}
              onChange={onTimeChange}
              textColor={COLORS.snow}
              themeVariant="dark"
              style={styles.picker}
            />
          </View>
        )}

        {Platform.OS === 'ios' && (showDatePicker || showTimePicker) && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => {
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>HOW LONG</Text>
        <View style={styles.pillRow}>
          {DURATIONS.map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[styles.pill, duration === mins && styles.pillActive]}
              onPress={() => setDuration(mins)}
            >
              <Text style={[styles.pillText, duration === mins && styles.pillTextActive]}>
                {mins === 60 ? '1 hr' : mins === 90 ? '1.5 hr' : '2 hr'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.repeatCard, repeatWeekly && styles.repeatCardActive]}
          onPress={() => setRepeatWeekly(!repeatWeekly)}
          activeOpacity={0.85}
        >
          <View style={[styles.repeatIcon, repeatWeekly && styles.repeatIconActive]}>
            <Ionicons
              name={repeatWeekly ? 'repeat' : 'repeat-outline'}
              size={19}
              color={repeatWeekly ? COLORS.ink : COLORS.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.repeatTitle}>Repeat weekly</Text>
            <Text style={styles.repeatSub}>
              {repeatWeekly
                ? `Every ${startTime.toLocaleDateString([], { weekday: 'long' })} at ${timeLabel}`
                : 'Make this a regular game'}
            </Text>
          </View>
          <Ionicons
            name={repeatWeekly ? 'checkmark-circle' : 'ellipse-outline'}
            size={23}
            color={repeatWeekly ? COLORS.primary : COLORS.neutral300}
          />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>MAX PLAYERS</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="10"
                placeholderTextColor={COLORS.neutral400}
                keyboardType="numeric"
                value={maxPlayers}
                onChangeText={setMaxPlayers}
              />
            </View>
          </View>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>MIN TO CONFIRM</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="8"
                placeholderTextColor={COLORS.neutral400}
                keyboardType="numeric"
                value={minPlayers}
                onChangeText={setMinPlayers}
              />
            </View>
          </View>
        </View>

        {/* ---- THE SPLIT, computed not entered ---- */}
        {selectedPark && (
          <>
            <Text style={styles.label}>THE SPLIT</Text>

            {isFreeField ? (
              <View style={styles.splitCard}>
                <Text style={styles.splitFree}>Free field</Text>
                <Text style={styles.splitNote}>
                  {selectedPark.name} does not charge, so nobody pays anything
                </Text>
              </View>
            ) : split ? (
              <View style={styles.splitCard}>
                <View style={styles.splitRow}>
                  <Text style={styles.splitKey}>
                    Field cost · {duration === 60 ? '1 hr' : duration === 90 ? '1.5 hr' : '2 hr'}
                  </Text>
                  <Text style={styles.splitVal}>${split.total.toFixed(2)}</Text>
                </View>

                <View style={styles.splitRule} />

                <View style={styles.splitRow}>
                  <Text style={styles.splitBigKey}>Each player pays</Text>
                  <Text style={styles.splitBigVal}>${split.atFull.toFixed(2)}</Text>
                </View>

                {split.atMin && split.atMin !== split.atFull && (
                  <Text style={styles.splitNote}>
                    ${split.atMin.toFixed(2)} each if only {minPlayers} show up
                  </Text>
                )}
              </View>
            ) : null}
          </>
        )}

        <TouchableOpacity
          style={[styles.postButton, loading && styles.buttonDisabled]}
          onPress={handlePostGame}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <Text style={styles.postButtonText}>
              {repeatWeekly ? 'Create weekly game' : 'Post to the map'}
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: 60,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.glassSurface,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 22, borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.snow, letterSpacing: -0.3 },
  content: { padding: 22, paddingBottom: 40 },

  label: {
    fontSize: 10, fontWeight: '800', color: COLORS.primary,
    letterSpacing: 2, marginBottom: 11,
  },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 24 },
  pill: {
    paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: COLORS.line,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.mute, fontWeight: '600', fontSize: 13.5 },
  pillTextActive: { color: COLORS.ink, fontWeight: '800' },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14,
    paddingHorizontal: 16, height: 54, marginBottom: 24,
    borderWidth: 1, borderColor: COLORS.line,
  },
  icon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: COLORS.snow, height: '100%' },

  dateButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 14, height: 54,
    borderWidth: 1, borderColor: COLORS.line, marginBottom: 24,
  },
  dateButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.snow },
  doneButton: {
    alignSelf: 'center', paddingHorizontal: 30, paddingVertical: 11,
    backgroundColor: COLORS.primary, borderRadius: 13, marginBottom: 20,
  },
  doneButtonText: { color: COLORS.ink, fontWeight: '800' },
  pickerSheet: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    marginBottom: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  picker: { width: '100%' },

  parkList: { marginBottom: 24, gap: 10 },
  parkCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line,
    backgroundColor: COLORS.cardFill,
  },
  parkCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.limeDim },
  parkName: { fontSize: 15.5, fontWeight: '600', color: COLORS.neutral800 },
  parkNameActive: { color: COLORS.snow, fontWeight: '700' },
  parkRate: { fontSize: 12.5, color: COLORS.mute, marginTop: 3, fontWeight: '600' },
  noParks: { fontSize: 14, color: COLORS.mute, fontStyle: 'italic', paddingVertical: 8 },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 },
  halfInputContainer: { flex: 1 },

  repeatCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, marginBottom: 24,
    borderWidth: 1, borderColor: COLORS.line,
    backgroundColor: COLORS.cardFill,
  },
  repeatCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.limeDim },
  repeatIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  repeatIconActive: { backgroundColor: COLORS.primary },
  repeatTitle: { fontSize: 15, fontWeight: '700', color: COLORS.snow },
  repeatSub: { fontSize: 12, color: COLORS.mute, marginTop: 3 },

  /* split preview */
  splitCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.line, marginBottom: 24,
  },
  splitRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
  },
  splitKey: { color: COLORS.mute, fontSize: 13.5, fontWeight: '500' },
  splitVal: { color: COLORS.snow, fontSize: 14, fontWeight: '700' },
  splitRule: { height: 1, backgroundColor: COLORS.line, marginVertical: 8 },
  splitBigKey: { color: COLORS.snow, fontSize: 15, fontWeight: '700' },
  splitBigVal: {
    color: COLORS.primary, fontSize: 24,
    fontWeight: '800', letterSpacing: -0.8,
  },
  splitFree: { color: COLORS.primary, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  splitNote: { color: COLORS.faint, fontSize: 12, marginTop: 8, fontWeight: '600', lineHeight: 17 },

  postButton: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  postButtonText: { color: COLORS.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});