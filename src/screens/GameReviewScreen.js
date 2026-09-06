import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient
      colors={[COLORS.canvasTop, COLORS.canvasMid, COLORS.canvasBottom]}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="chevron-down" size={22} color={COLORS.neutral700} />
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
                  size={40}
                  color={rating >= i ? COLORS.warning : COLORS.neutral300}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.prompt}>
            {rating > 0 ? PROMPTS[rating] : 'Tap to rate'}
          </Text>

          <Text style={styles.label}>Anything to add?</Text>
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
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitText}>Submit</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={onClose}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.neutral200,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.neutral900 },
  content: { padding: 24, paddingBottom: 40 },
  gameCard: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: COLORS.neutral200,
  },
  sportBadge: {
    fontSize: 13, fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.softGreen,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    alignSelf: 'flex-start', overflow: 'hidden', marginBottom: 10,
  },
  gameTitle: { fontSize: 20, fontWeight: '800', color: COLORS.neutral900, marginBottom: 6 },
  gameMeta: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
  question: { fontSize: 19, fontWeight: '800', color: COLORS.neutral900, textAlign: 'center', marginTop: 32 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 18 },
  prompt: {
    fontSize: 15, fontWeight: '600', color: COLORS.primary,
    textAlign: 'center', marginTop: 12, minHeight: 22,
  },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.neutral700, marginTop: 30, marginBottom: 10 },
  reviewInput: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    minHeight: 110, fontSize: 15, color: COLORS.neutral900,
    borderWidth: 1, borderColor: COLORS.neutral200,
  },
  charCount: { fontSize: 11, color: COLORS.neutral400, textAlign: 'right', marginTop: 6 },
  submitButton: {
    backgroundColor: COLORS.primary, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  submitDisabled: { backgroundColor: COLORS.neutral300, elevation: 0, shadowOpacity: 0 },
  submitText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  skipButton: { alignItems: 'center', marginTop: 16, paddingVertical: 10 },
  skipText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
});