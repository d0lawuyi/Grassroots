import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

/*
 * "Your level" on the Profile screen: 1 (new) to 5 (very strong).
 * Saved as users.skill_rating. When the organizer taps "Make teams", the C++ solver uses
 * it to balance the sides. Not picked yet counts as 3.
 */
export const SKILL_LEVELS = [
  { value: 1, label: 'New', hint: 'Just starting out or getting back into it' },
  { value: 2, label: 'Casual', hint: 'Play now and then, know the basics' },
  { value: 3, label: 'Solid', hint: 'Play regularly, hold your own' },
  { value: 4, label: 'Strong', hint: 'One of the better players most nights' },
  { value: 5, label: 'Elite', hint: 'Played at a high level: club, college or above' },
];

export default function SkillLevelPicker({ value, onChange }) {
  const picked = SKILL_LEVELS.find((l) => l.value === value);

  return (
    <View style={s.card}>
      <View style={s.row}>
        {SKILL_LEVELS.map((level) => {
          const on = level.value === value;
          return (
            <TouchableOpacity
              key={level.value}
              style={[s.chip, on && s.chipOn]}
              onPress={() => onChange(level.value)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${level.label}: ${level.hint}`}
            >
              <Text style={[s.chipNum, on && s.chipTextOn]}>{level.value}</Text>
              <Text style={[s.chipLabel, on && s.chipTextOn]} numberOfLines={1}>
                {level.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={s.hint}>
        {picked
          ? picked.hint
          : 'Pick the one that fits best. It keeps teams fair when the organizer splits them up.'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    padding: 14, marginBottom: 10, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.cardFill,
  },
  row: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.neutral100,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipNum: { color: COLORS.snow, fontSize: 16, fontWeight: '800' },
  chipLabel: { color: COLORS.mute, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  chipTextOn: { color: COLORS.white },
  hint: { color: COLORS.mute, fontSize: 12, lineHeight: 17, marginTop: 10 },
});
