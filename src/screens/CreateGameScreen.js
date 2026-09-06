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

export default function CreateGameScreen({ userId, onClose }) {
  const [parks, setParks] = useState([]);
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState('soccer');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [parkId, setParkId] = useState('');
  const [maxPlayers, setMaxPlayers] = useState('10');
  const [minPlayers, setMinPlayers] = useState('8');
  const [price, setPrice] = useState('8');
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
        .select('park_id, name, sports')
        .eq('status', 'active');
      if (data && data.length > 0) setParks(data);
    }
    fetchParks();
  }, []);

  const availableParks = parks.filter((p) => (p.sports || []).includes(sport));

  // Clear the selected park if it doesn't support the newly chosen sport
  useEffect(() => {
    if (parkId && !availableParks.some((p) => p.park_id === parkId)) {
      setParkId('');
    }
  }, [sport]);

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
      return Alert.alert('Check player counts', 'Minimum to confirm can’t be more than max players.');
    }

    setLoading(true);
    try {
      const endTime = new Date(startTime.getTime() + duration * 60000);

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
            base_price_per_player: parseFloat(price) || 0,
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
          base_price_per_player: parseFloat(price) || 0,
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
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.glassTint} pointerEvents="none" />

      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={28} color={COLORS.neutral900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Game</Text>
        <View style={{ width: 28 }} />
      </View>





      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.label}>Sport</Text>
        <View style={styles.pillRow}>
          {SPORTS.map((s) => (
            <TouchableOpacity
              key={s.value}
              style={[styles.pill, sport === s.value && styles.pillActive]}
              onPress={() => setSport(s.value)}
            >
              <Text style={[styles.pillText, sport === s.value && styles.pillTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Select Venue</Text>
        <View style={styles.parkList}>
          {availableParks.length === 0 ? (
            <Text style={styles.noParks}>No venues listed for this sport yet</Text>
          ) : (
            availableParks.map((park) => (
              <TouchableOpacity
                key={park.park_id}
                style={[styles.parkCard, parkId === park.park_id && styles.parkCardActive]}
                onPress={() => setParkId(park.park_id)}
              >
                <Text style={styles.parkName}>{park.name}</Text>
                {parkId === park.park_id && (
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={styles.label}>Skill Level</Text>
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

        <Text style={styles.label}>Game Title</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="football-outline" size={20} color={COLORS.neutral500} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="e.g. Downtown 7v7"
            placeholderTextColor={COLORS.neutral400}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <Text style={styles.label}>When</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.dateButton, { flex: 1.3 }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={19} color={COLORS.primary} />
            <Text style={styles.dateButtonText}>{dateLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dateButton, { flex: 1 }]}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={19} color={COLORS.primary} />
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
              textColor={COLORS.neutral900}
              themeVariant="light"
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
              textColor={COLORS.neutral900}
              themeVariant="light"
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

        <Text style={styles.label}>How long</Text>
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
              size={20}
              color={repeatWeekly ? COLORS.white : COLORS.primary}
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
            size={24}
            color={repeatWeekly ? COLORS.primary : COLORS.neutral300}
          />
        </TouchableOpacity>

        <View style={styles.row}>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Max Players</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="10"
                keyboardType="numeric"
                value={maxPlayers}
                onChangeText={setMaxPlayers}
              />
            </View>
          </View>
          <View style={styles.halfInputContainer}>
            <Text style={styles.label}>Min to Confirm</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="8"
                keyboardType="numeric"
                value={minPlayers}
                onChangeText={setMinPlayers}
              />
            </View>
          </View>
        </View>

        <Text style={styles.label}>Price per Player</Text>
        <View style={styles.inputWrapper}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.input}
            placeholder="8"
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />
        </View>

        <TouchableOpacity
          style={[styles.postButton, loading && styles.buttonDisabled]}
          onPress={handlePostGame}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.postButtonText}>
              {repeatWeekly ? 'Create Weekly Game' : 'Post Game'}
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
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 60,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
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
    padding: 24, borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.neutral900 },
  content: { padding: 24, paddingBottom: 40 },

  label: { fontSize: 15, fontWeight: '700', color: COLORS.neutral700, marginBottom: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.neutral500, fontWeight: '600' },
  pillTextActive: { color: COLORS.white },

  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16,
    paddingHorizontal: 16, height: 56, marginBottom: 24,
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  icon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: COLORS.neutral900, height: '100%' },
  dollarSign: { fontSize: 16, color: COLORS.neutral900, fontWeight: '700', marginRight: 4 },

  dateButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 16, height: 56,
    borderWidth: 1, borderColor: COLORS.glassBorder, marginBottom: 24,
  },
  dateButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.neutral800 },
  doneButton: {
    alignSelf: 'center', paddingHorizontal: 28, paddingVertical: 10,
    backgroundColor: COLORS.softGreen, borderRadius: 14, marginBottom: 20,
  },
  doneButtonText: { color: COLORS.primaryDark, fontWeight: '700' },
  pickerSheet: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
  },
  picker: { width: '100%' },
  parkList: { marginBottom: 24, gap: 12 },
  parkCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  parkCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.softGreen },
  parkName: { fontSize: 16, fontWeight: '600', color: COLORS.neutral900 },
  noParks: { fontSize: 14, color: COLORS.neutral500, fontStyle: 'italic', paddingVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  halfInputContainer: { flex: 1 },

  repeatCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, marginBottom: 24,
    borderWidth: 1, borderColor: COLORS.glassBorder,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  repeatCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.softGreen },
  repeatIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  repeatIconActive: { backgroundColor: COLORS.primary },
  repeatTitle: { fontSize: 15, fontWeight: '700', color: COLORS.neutral900 },
  repeatSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },

  postButton: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  buttonDisabled: { opacity: 0.7 },
  postButtonText: { color: COLORS.white, fontSize: 18, fontWeight: '700' },
});