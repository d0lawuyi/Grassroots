import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

import { COLORS } from '../theme/colors';

export default function GameCard({ game, onPress }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            {game.name || 'Local Football Game'}
          </Text>

          <Text style={styles.location}>
            {game.city || 'Nearby'}{game.state ? `, ${game.state}` : ''}
          </Text>
        </View>

        <View style={styles.priceBadge}>
          <Text style={styles.price}>
            ${game.price || '8.50'}
          </Text>
        </View>
      </View>

      <View style={styles.tags}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {game.format || '7v7'}
          </Text>
        </View>

        <View style={styles.tag}>
          <Text style={styles.tagText}>
            {game.skillLevel || 'Intermediate'}
          </Text>
        </View>
      </View>

      <Text style={styles.detail}>
        Saturday • 4:00 PM
      </Text>

      <Text style={styles.detail}>
        ⚽ {game.players || 10}/{game.maxPlayers || 14} players
      </Text>

      <View style={styles.bottomRow}>
        <Text style={styles.distance}>
          {game.distance_miles != null
            ? `${Number(game.distance_miles).toFixed(1)} miles away`
            : 'Nearby park'}
        </Text>

        <Text style={styles.view}>View →</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,

    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: COLORS.black,
    shadowOpacity: 0.05,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 10,

    elevation: 2,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  titleContainer: {
    flex: 1,
    paddingRight: 12,
  },

  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },

  location: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 3,
  },

  priceBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  price: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },

  tags: {
    flexDirection: 'row',
    marginTop: 14,
    marginBottom: 10,
    gap: 8,
  },

  tag: {
    backgroundColor: '#F0F4F0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  tagText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  detail: {
    color: COLORS.muted,
    marginTop: 5,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  distance: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },

  view: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});