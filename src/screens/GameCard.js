import React from 'react';

import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../theme/colors';

const ACCENTS = [
  {
    bg: COLORS.primaryLight,
    color: COLORS.primaryDark,
  },

  {
    bg: COLORS.plumLight,
    color: COLORS.plum,
  },

  {
    bg: COLORS.coralLight,
    color: COLORS.coral,
  },

  {
    bg: COLORS.tealLight,
    color: COLORS.teal,
  },

  {
    bg: COLORS.sandLight,
    color: COLORS.sand,
  },
];

export default function GameCard({
  game,
  onPress,
  index = 0,
}) {
  const accent =
    ACCENTS[index % ACCENTS.length];

  const distance =
    game.distance_miles != null
      ? `${Number(
          game.distance_miles
        ).toFixed(1)} mi`
      : 'nearby';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
      ]}
    >
      <BlurView
        intensity={45}
        tint="light"
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconBox,
              {
                backgroundColor:
                  accent.bg,
              },
            ]}
          >
            <Ionicons
              name="football-outline"
              size={21}
              color={accent.color}
            />
          </View>

          <View style={styles.distanceBadge}>
            <Ionicons
              name="navigate-outline"
              size={13}
              color={COLORS.muted}
            />

            <Text
              style={styles.distanceText}
            >
              {distance}
            </Text>
          </View>
        </View>

        <Text
          style={styles.title}
          numberOfLines={2}
        >
          {game.name ||
            'Pickup football'}
        </Text>

        <Text
          style={styles.location}
          numberOfLines={1}
        >
          {[
            game.city,
            game.state,
          ]
            .filter(Boolean)
            .join(', ') ||
            'Indianapolis'}
        </Text>

        <View style={styles.tags}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>
              {game.format || '7v7'}
            </Text>
          </View>

          <View style={styles.tag}>
            <Text style={styles.tagText}>
              {game.skillLevel ||
                'Open level'}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.metaLabel}>
              SPOTS
            </Text>

            <Text style={styles.metaValue}>
              {game.players || 10}
              {' / '}
              {game.maxPlayers || 14}
            </Text>
          </View>

          <View>
            <Text style={styles.metaLabel}>
              FIELD
            </Text>

            <Text style={styles.metaValue}>
              {game.price
                ? `$${game.price}`
                : 'Free'}
            </Text>
          </View>

          <View style={styles.openButton}>
            <Ionicons
              name="arrow-forward"
              size={19}
              color={COLORS.text}
            />
          </View>
        </View>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 11,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },

  card: {
    overflow: 'hidden',

    borderRadius: 24,

    padding: 17,

    backgroundColor: COLORS.glass,

    borderWidth: 1,
    borderColor: COLORS.glassBorder,

    shadowColor: COLORS.shadow,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 3,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  iconBox: {
    width: 43,
    height: 43,

    borderRadius: 14,

    justifyContent: 'center',
    alignItems: 'center',
  },

  distanceBadge: {
    minHeight: 31,

    paddingHorizontal: 10,

    borderRadius: 999,

    backgroundColor:
      'rgba(255,255,255,0.52)',

    flexDirection: 'row',
    alignItems: 'center',

    gap: 5,
  },

  distanceText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
  },

  title: {
    color: COLORS.text,

    fontSize: 21,
    lineHeight: 25,

    fontWeight: '900',

    letterSpacing: -0.4,

    marginTop: 17,
  },

  location: {
    color: COLORS.muted,
    fontSize: 13,

    marginTop: 4,
  },

  tags: {
    flexDirection: 'row',

    gap: 7,

    marginTop: 15,
  },

  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,

    borderRadius: 999,

    backgroundColor:
      'rgba(255,255,255,0.48)',
  },

  tagText: {
    color: COLORS.text,

    fontSize: 11,
    fontWeight: '700',
  },

  divider: {
    height: 1,

    backgroundColor:
      'rgba(70,80,95,0.09)',

    marginVertical: 15,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: 22,
  },

  metaLabel: {
    color: COLORS.subtle,

    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  metaValue: {
    color: COLORS.text,

    fontSize: 13,
    fontWeight: '800',

    marginTop: 2,
  },

  openButton: {
    marginLeft: 'auto',

    width: 42,
    height: 42,

    borderRadius: 14,

    backgroundColor:
      'rgba(255,255,255,0.64)',

    justifyContent: 'center',
    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
});