import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const TONES = [
  'rgba(23,32,25,0.30)',
  'rgba(23,32,25,0.22)',
  'rgba(23,32,25,0.16)',
  'rgba(23,32,25,0.11)',
];

function countdown(startTime) {
  const ms = new Date(startTime).getTime() - Date.now();
  if (ms < 0) return 'NOW';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `IN ${Math.max(Math.floor(ms / 60000), 1)} MIN`;
  if (hours < 24) return `IN ${hours} ${hours === 1 ? 'HOUR' : 'HOURS'}`;
  const days = Math.floor(hours / 24);
  return `IN ${days} ${days === 1 ? 'DAY' : 'DAYS'}`;
}

export default function NextUpCard({ game, players = [], onOpen, onOpenChat, onDirections }) {
  if (!game) return null;

  const time = new Date(game.start_time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const open = Math.max((game.max_players || 0) - players.length, 0);
  const shown = players.slice(0, 4);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={s.card}>
      <View style={s.head}>
        <View style={s.bar} />
        <Text style={s.label}>NEXT UP</Text>
        <Text style={s.count}>{countdown(game.start_time)}</Text>
      </View>

      <Text style={s.title}>{game.title}</Text>
      <Text style={s.sub}>
        {game.parks?.name || 'Park'} · {time}
      </Text>

      <View style={s.chipWrap}>
        <TouchableOpacity style={s.chip} onPress={onOpenChat} activeOpacity={0.8}>
          <Ionicons name="chatbubble" size={11} color={COLORS.ink} />
          <Text style={s.chipText}>Group chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.chipGhost} onPress={onDirections} activeOpacity={0.8}>
          <Ionicons name="navigate" size={11} color={COLORS.snow} />
          <Text style={s.chipGhostText}>Directions</Text>
        </TouchableOpacity>
      </View>

      <View style={s.roster}>
        {shown.map((player, i) => {
          const isYou = player.isYou;
          const initials = (player.full_name || '?')
            .split(' ')
            .map((n) => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <View key={i} style={s.rosterItem}>
              <View
                style={[
                  s.face,
                  { backgroundColor: isYou ? COLORS.primary : TONES[i % TONES.length] },
                ]}
              >
                <Text style={[s.faceText, isYou && s.faceTextYou]}>{initials}</Text>
              </View>
              <Text style={[s.name, isYou && s.nameYou]}>
                {isYou ? 'You' : (player.full_name || 'Player').split(' ')[0]}
              </Text>
            </View>
          );
        })}

        {open > 0 && (
          <View style={s.rosterItem}>
            <View style={[s.face, s.faceEmpty]}>
              <Ionicons name="add" size={14} color={COLORS.mute} />
            </View>
            <Text style={s.name}>{open} open</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardFill,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 18,
    marginBottom: 20,
  },

  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  bar: { width: 16, height: 2, backgroundColor: COLORS.primary, marginRight: 9 },
  label: {
    color: COLORS.primary,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  count: {
    marginLeft: 'auto',
    color: COLORS.mute,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  title: {
    color: COLORS.snow,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  sub: { color: COLORS.mute, fontSize: 13.5, marginTop: 5, fontWeight: '500' },

  chipWrap: { flexDirection: 'row', gap: 8, marginTop: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipText: { color: COLORS.ink, fontSize: 12, fontWeight: '800' },
  chipGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipGhostText: { color: COLORS.snow, fontSize: 12, fontWeight: '700' },

  roster: { flexDirection: 'row', marginTop: 22, gap: 18 },
  rosterItem: { alignItems: 'center' },
  face: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderStyle: 'dashed',
  },
  faceText: { fontSize: 12, fontWeight: '800', color: COLORS.snow },
  faceTextYou: { color: COLORS.ink },
  name: { color: COLORS.mute, fontSize: 11, marginTop: 7, fontWeight: '600' },
  nameYou: { color: COLORS.snow, fontWeight: '800' },
});