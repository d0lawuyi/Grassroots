import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Linking, Platform, Share, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';

/*
 * "Calendar link" for venue owners: subscribes their phone's calendar to the games
 * booked at their venues. The feed itself is served by services/calendar-feed (C#).
 *
 * Shows only when:
 *   - EXPO_PUBLIC_CALENDAR_FEED_URL is set in .env (the service's public address), and
 *   - this person owns at least one venue.
 */
const FEED_BASE = (process.env.EXPO_PUBLIC_CALENDAR_FEED_URL || '').replace(/\/+$/, '');

export default function CalendarLinkRow({ userId }) {
  const [ownsVenue, setOwnsVenue] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!FEED_BASE || !userId) return;
    supabase
      .from('parks')
      .select('park_id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .then(({ count }) => setOwnsVenue((count || 0) > 0));
  }, [userId]);

  if (!FEED_BASE || !ownsVenue) return null;

  async function getLink(reset = false) {
    const { data, error } = await supabase.rpc(reset ? 'reset_calendar_feed' : 'my_calendar_feed');
    if (error || !data) throw new Error(error?.message || 'No link came back.');
    return `${FEED_BASE}/feeds/${data}.ics`;
  }

  async function run(action) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      Alert.alert('Calendar link', e.message);
    } finally {
      setBusy(false);
    }
  }

  // iPhone: webcal:// opens the Calendar app's "Subscribe" screen directly.
  // Android: Google Calendar adds subscriptions on the web, so share the link instead.
  const subscribe = () =>
    run(async () => {
      const link = await getLink();
      if (Platform.OS === 'ios') {
        await Linking.openURL(link.replace(/^https?:\/\//, 'webcal://'));
      } else {
        await Share.share({
          message: `Add this to Google Calendar (calendar.google.com > Other calendars > + > From URL):\n${link}`,
        });
      }
    });

  const share = () =>
    run(async () => {
      const link = await getLink();
      await Share.share({ message: link });
    });

  const confirmReset = () =>
    Alert.alert(
      'Reset calendar link?',
      'Calendars using the old link will stop updating. Use this if you shared the link by mistake.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await getLink(true);
              Alert.alert('Done', 'Your calendar link was reset. Add the new one to your calendar.');
            }),
        },
      ]
    );

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.row} onPress={subscribe} activeOpacity={0.85} disabled={busy}>
        <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Add bookings to my calendar</Text>
          <Text style={s.sub}>Every game booked at your venues shows up in your phone's calendar.</Text>
        </View>
        {busy ? <ActivityIndicator color={COLORS.primary} /> : <Ionicons name="chevron-forward" size={20} color={COLORS.mute} />}
      </TouchableOpacity>
      <View style={s.links}>
        <TouchableOpacity onPress={share} disabled={busy} hitSlop={8}>
          <Text style={s.link}>Share link</Text>
        </TouchableOpacity>
        <Text style={s.dot}>·</Text>
        <TouchableOpacity onPress={confirmReset} disabled={busy} hitSlop={8}>
          <Text style={[s.link, { color: COLORS.danger }]}>Reset link</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.cardFill,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, paddingBottom: 8 },
  title: { color: COLORS.snow, fontSize: 15, fontWeight: '700' },
  sub: { color: COLORS.mute, fontSize: 12, marginTop: 2, lineHeight: 17 },
  links: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 49, paddingBottom: 13 },
  link: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  dot: { color: COLORS.faint },
});
