import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import {
  nextDays, sameDay, gamesOnDay, openStartTimes, clockLabel, gameEnd,
} from '../utils/slots';

/*
 * "Pick a time" on the venue page.
 *   - A strip of the next 7 days.
 *   - Games already booked here that day: tap one to see it and join.
 *   - Open start times: tap one to create a game here at that time.
 */
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TimeSlots({ venue, onPickTime, onPickGame }) {
  const days = useMemo(() => nextDays(), []);
  const [day, setDay] = useState(days[0]);
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState({}); // game_id -> how many have joined
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const from = days[0];
      const to = new Date(days[days.length - 1].getTime() + 24 * 3600000);
      const { data } = await supabase
        .from('games')
        .select('*')
        .eq('park_id', venue.park_id)
        .gte('start_time', new Date(from.getTime() - 24 * 3600000).toISOString())
        .lt('start_time', to.toISOString())
        .order('start_time');
      const rows = (data || []).filter((g) => !['cancelled', 'canceled'].includes(g.status));

      const counts = {};
      if (rows.length) {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('game_id')
          .in('game_id', rows.map((g) => g.game_id));
        for (const b of bookings || []) counts[b.game_id] = (counts[b.game_id] || 0) + 1;
      }
      if (!alive) return;
      setGames(rows);
      setPlayers(counts);
      setLoading(false);
    }
    load();
    return () => {
      alive = false;
    };
  }, [venue.park_id, days]);

  const booked = gamesOnDay(games, day);
  const open = openStartTimes(day, games, venue);
  const verified = venue.verification_status === 'approved';

  return (
    <View>
      <Text style={s.label}>Pick a time</Text>
      <Text style={s.hint}>
        {verified
          ? 'Open means no game is booked here yet. The owner confirms your time when you book.'
          : 'Open means no game is booked here yet. Times aren’t confirmed with an owner.'}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.days}>
        {days.map((d, i) => {
          const on = sameDay(d, day);
          const count = gamesOnDay(games, d).length;
          return (
            <TouchableOpacity
              key={d.toISOString()}
              style={[s.day, on && s.dayOn]}
              onPress={() => setDay(d)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${i === 0 ? 'Today' : WEEKDAY[d.getDay()]} ${d.getDate()}, ${count} games booked`}
            >
              <Text style={[s.dayName, on && s.dayTextOn]}>{i === 0 ? 'Today' : WEEKDAY[d.getDay()]}</Text>
              <Text style={[s.dayNum, on && s.dayTextOn]}>{d.getDate()}</Text>
              <View style={[s.dayDot, count > 0 && (on ? s.dayDotOn : s.dayDotBusy)]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 22 }} />
      ) : (
        <>
          {booked.map((g) => {
            const joined = players[g.game_id] || 0;
            const max = g.max_players || 10;
            const full = joined >= max;
            return (
              <TouchableOpacity
                key={g.game_id}
                style={s.game}
                onPress={() => onPickGame?.(g)}
                activeOpacity={0.85}
                accessibilityLabel={`${g.title || 'Game'} at ${clockLabel(new Date(g.start_time))}, ${joined} of ${max} players`}
              >
                <View style={s.gameTime}>
                  <Text style={s.gameTimeText}>{clockLabel(new Date(g.start_time))}</Text>
                  <Text style={s.gameTimeEnd}>to {clockLabel(gameEnd(g))}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.gameTitle} numberOfLines={1}>{g.title || 'Pickup game'}</Text>
                  <Text style={s.gameMeta}>
                    {joined}/{max} players{g.skill_level ? ` · ${g.skill_level[0].toUpperCase()}${g.skill_level.slice(1)}` : ''}
                  </Text>
                </View>
                <Text style={[s.gameAction, full && s.gameActionFull]}>{full ? 'Full' : 'Join'}</Text>
              </TouchableOpacity>
            );
          })}

          {open.length > 0 ? (
            <View style={s.grid}>
              {open.map((t) => (
                <TouchableOpacity
                  key={t.toISOString()}
                  style={s.slot}
                  onPress={() => onPickTime?.(t)}
                  activeOpacity={0.85}
                  accessibilityLabel={`Create a game at ${clockLabel(t)}`}
                >
                  <Text style={s.slotText}>{clockLabel(t)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={s.none}>
              {booked.length ? 'No other open times this day.' : 'No open times left today. Try another day.'}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  label: { marginTop: 26, color: COLORS.snow, fontSize: 18, fontFamily: FONTS.displaySemi },
  hint: { marginTop: 3, color: COLORS.mute, fontSize: 13, lineHeight: 18 },

  days: { gap: 8, paddingVertical: 14 },
  day: {
    width: 56, paddingVertical: 10, borderRadius: 16, alignItems: 'center',
    backgroundColor: COLORS.cardFill, borderWidth: 1, borderColor: COLORS.line,
  },
  dayOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { color: COLORS.mute, fontSize: 11.5, fontWeight: '700' },
  dayNum: { color: COLORS.snow, fontSize: 19, fontWeight: '800', marginTop: 2 },
  dayTextOn: { color: COLORS.white },
  dayDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5, backgroundColor: 'transparent' },
  dayDotBusy: { backgroundColor: COLORS.clay },
  dayDotOn: { backgroundColor: COLORS.white },

  game: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8,
    borderRadius: 16, backgroundColor: COLORS.cardFill, borderWidth: 1, borderColor: COLORS.line,
  },
  gameTime: {
    width: 70, paddingVertical: 8, borderRadius: 12, alignItems: 'center', backgroundColor: COLORS.clayLight,
  },
  gameTimeText: { color: COLORS.clay, fontSize: 14, fontWeight: '800' },
  gameTimeEnd: { color: COLORS.clay, fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  gameTitle: { color: COLORS.snow, fontSize: 15, fontWeight: '700' },
  gameMeta: { color: COLORS.mute, fontSize: 12.5, marginTop: 2 },
  gameAction: {
    color: COLORS.white, backgroundColor: COLORS.primary, fontSize: 13, fontWeight: '800',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, overflow: 'hidden',
  },
  gameActionFull: { color: COLORS.mute, backgroundColor: COLORS.neutral100 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  slot: {
    width: '22.5%', paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    backgroundColor: COLORS.sage, borderWidth: 1, borderColor: 'rgba(23,68,47,0.18)',
  },
  slotText: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  none: { color: COLORS.mute, fontSize: 13.5, marginTop: 6, fontStyle: 'italic' },
});
