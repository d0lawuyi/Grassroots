import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { formatGameTime, formatSport, sportEmoji } from '../utils/format';
import { COLORS } from '../theme/colors';

const PROMPTS = {
  1: 'Rough one',
  2: 'Could be better',
  3: 'Solid game',
  4: 'Really good',
  5: 'Great game',
};

export default function GameReviewScreen({ game, userId, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (rating === 0) {
      Alert.alert('Pick a rating', 'Tap a star to rate this game.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('bookings')
      .update({
        rating_given: rating,
        review_text: review.trim() || null,
      })
      .eq('game_id', game.game_id)
      .eq('player_id', userId);

    setSaving(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }

    onSubmitted?.();
    onClose();
  }

  if (!game) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-down" size={22} color={COLORS.snow} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate this game</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.gameCard}>
            <Text style={styles.sportBadge}>
              {sportEmoji(game.sport)} {formatSport(game.sport)}
            </Text>
            <Text style={styles.gameTitle}>{game.title}</Text>
            <Text style={styles.gameMeta}>{game.parks?.name || 'Park'}</Text>
            <Text style={styles.gameMeta}>{formatGameTime(game.start_time)}</Text>
          </View>

          <Text style={styles.question}>How was it?</Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setRating(i)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Ionicons
                  name={rating >= i ? 'star' : 'star-outline'}
                  size={38}
                  color={rating >= i ? COLORS.primary : COLORS.neutral300}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.prompt}>
            {rating > 0 ? PROMPTS[rating] : 'Tap to rate'}
          </Text>

          <Text style={styles.label}>ANYTHING TO ADD</Text>
          <TextInput
            style={styles.reviewInput}
            placeholder="Good turnout, field was in great shape..."
            placeholderTextColor={COLORS.neutral400}
            value={review}
            onChangeText={setReview}
            multiline
            maxLength={400}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{review.length}/400</Text>

          <TouchableOpacity
            style={[styles.submitButton, (rating === 0 || saving) && styles.submitDisabled]}
            onPress={submit}
            disabled={rating === 0 || saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.ink} />
            ) : (
              <Text style={[styles.submitText, rating === 0 && styles.submitTextDisabled]}>
                Submit
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={onClose}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.cardFill,
    borderWidth: 1, borderColor: COLORS.line,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.snow, letterSpacing: -0.3 },

  content: { padding: 24, paddingBottom: 40 },
  gameCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: COLORS.line,
  },
  sportBadge: {
    fontSize: 12.5, fontWeight: '800', color: COLORS.primary, backgroundColor: COLORS.limeDim,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    alignSelf: 'flex-start', overflow: 'hidden', marginBottom: 12,
  },
  gameTitle: {
    fontSize: 21, fontWeight: '800', color: COLORS.snow,
    marginBottom: 7, letterSpacing: -0.6,
  },
  gameMeta: { fontSize: 14, color: COLORS.mute, marginTop: 2 },

  question: {
    fontSize: 24, fontWeight: '800', color: COLORS.snow,
    textAlign: 'center', marginTop: 36, letterSpacing: -0.7,
  },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  prompt: {
    fontSize: 15, fontWeight: '700', color: COLORS.primary,
    textAlign: 'center', marginTop: 14, minHeight: 22,
  },

  label: {
    fontSize: 10, fontWeight: '800', color: COLORS.primary,
    letterSpacing: 2, marginTop: 34, marginBottom: 11,
  },
  reviewInput: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: 16,
    minHeight: 110, fontSize: 15, color: COLORS.snow, lineHeight: 21,
    borderWidth: 1, borderColor: COLORS.line,
  },
  charCount: { fontSize: 11, color: COLORS.faint, textAlign: 'right', marginTop: 7 },

  submitButton: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 26,
  },
  submitDisabled: { backgroundColor: COLORS.neutral200 },
  submitText: { color: COLORS.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  submitTextDisabled: { color: COLORS.mute },
  skipButton: { alignItems: 'center', marginTop: 16, paddingVertical: 10 },
  skipText: { color: COLORS.mute, fontSize: 14, fontWeight: '600' },
});