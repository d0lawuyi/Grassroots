import React from 'react';

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../theme/colors';

const ACCENTS = [
  { bg: COLORS.primaryLight, color: COLORS.primary },
  { bg: COLORS.plumLight, color: COLORS.plum },
  { bg: COLORS.coralLight, color: COLORS.coral },
  { bg: COLORS.tealLight, color: COLORS.teal },
  { bg: COLORS.sandLight, color: COLORS.sand },
];

export default function GameCard({ game, onPress, index = 0 }) {
  const accent = ACCENTS[index % ACCENTS.length];

  const distance =
    game.distance_miles != null
      ? `${Number(game.distance_miles).toFixed(1)} mi`
      : 'nearby';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.iconBox, { backgroundColor: accent.bg }]}>
            <Ionicons name="football-outline" size={20} color={accent.color} />
          </View>

          <View style={styles.distanceBadge}>
            <Ionicons name="navigate-outline" size={12} color={COLORS.mute} />
            <Text style={styles.distanceText}>{distance}</Text>
          </View>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {game.name || 'Pickup football'}
        </Text>

        <Text style={styles.location} numberOfLines={1}>
          {[game.city, game.state].filter(Boolean).join(', ') || 'Indianapolis'}
        </Text>

        <View style={styles.tags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{game.format || '7v7'}</Text>
          </View>

          <View style={styles.tag}>
            <Text style={styles.tagText}>{game.skillLevel || 'Open level'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.metaLabel}>SPOTS</Text>
            <Text style={styles.metaValue}>
              {game.players || 10}
              {' / '}
              {game.maxPlayers || 14}
            </Text>
          </View>

          <View>
            <Text style={styles.metaLabel}>FIELD</Text>
            <Text style={styles.metaValue}>
              {game.price ? `$${game.price}` : 'Free'}
            </Text>
          </View>

          <View style={styles.openButton}>
            <Ionicons name="arrow-forward" size={18} color={COLORS.ink} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 11 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },

  card: {
    overflow: 'hidden',
    borderRadius: 22,
    padding: 17,
    backgroundColor: COLORS.cardFill,
    borderWidth: 1,
    borderColor: COLORS.line,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },

  distanceBadge: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  distanceText: {
    color: COLORS.mute,
    fontSize: 11,
    fontWeight: '800',
  },

  title: {
    color: COLORS.snow,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 17,
  },
  location: {
    color: COLORS.mute,
    fontSize: 13,
    marginTop: 4,
  },

  tags: { flexDirection: 'row', gap: 7, marginTop: 15 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  tagText: {
    color: COLORS.neutral800,
    fontSize: 11,
    fontWeight: '700',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.line,
    marginVertical: 15,
  },

  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  metaLabel: {
    color: COLORS.mute,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  metaValue: {
    color: COLORS.snow,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },

  openButton: {
    marginLeft: 'auto',
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});