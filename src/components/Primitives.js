import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

export function SectionLabel({ children, right }) {
  return (
    <View style={p.labelRow}>
      <View style={p.labelBar} />
      <Text style={p.labelText}>{children}</Text>
      {right ? <Text style={p.labelRight}>{right}</Text> : null}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[p.card, style]}>{children}</View>;
}

export function DataRow({ label, value, rule = true, big = false }) {
  return (
    <>
      <View style={p.dataRow}>
        <Text style={p.dataKey}>{label}</Text>
        <Text style={[p.dataVal, big && p.dataValBig]}>{value}</Text>
      </View>
      {rule ? <View style={p.rule} /> : null}
    </>
  );
}

export function FillBar({ percent, height = 4 }) {
  return (
    <View style={[p.barTrack, { height, borderRadius: height / 2 }]}>
      <View
        style={[
          p.barFill,
          { width: `${Math.min(percent, 100)}%`, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

export function Chip({ icon, label, solid = false, onPress, Wrapper = View }) {
  return (
    <Wrapper onPress={onPress} style={[p.chip, solid ? p.chipSolid : p.chipGhost]}>
      {icon ? (
        <Ionicons name={icon} size={12} color={solid ? COLORS.ink : COLORS.snow} />
      ) : null}
      <Text style={[p.chipText, solid ? p.chipTextSolid : p.chipTextGhost]}>
        {label}
      </Text>
    </Wrapper>
  );
}

export function DateBadge({ dow, day }) {
  return (
    <View style={p.dateBadge}>
      <Text style={p.dateDow}>{dow}</Text>
      <Text style={p.dateNum}>{day}</Text>
    </View>
  );
}

export function LivePill({ children }) {
  return (
    <View style={p.livePill}>
      <View style={p.liveDot} />
      <Text style={p.livePillText}>{children}</Text>
    </View>
  );
}

const p = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  labelBar: { width: 16, height: 2, backgroundColor: COLORS.primary, marginRight: 9 },
  labelText: {
    color: COLORS.primary,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 2.4,
  },
  labelRight: {
    marginLeft: 'auto',
    color: COLORS.mute,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  card: {
    backgroundColor: COLORS.cardFill,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
  },

  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
  },
  dataKey: { color: COLORS.mute, fontSize: 13.5, fontWeight: '500' },
  dataVal: { color: COLORS.snow, fontSize: 14, fontWeight: '700' },
  dataValBig: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  rule: { height: 1, backgroundColor: COLORS.line },

  barTrack: { backgroundColor: COLORS.neutral200, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: COLORS.primary },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipSolid: { backgroundColor: COLORS.primary },
  chipGhost: { borderWidth: 1, borderColor: COLORS.line },
  chipText: { fontSize: 12, fontWeight: '800' },
  chipTextSolid: { color: COLORS.ink },
  chipTextGhost: { color: COLORS.snow, fontWeight: '700' },

  dateBadge: {
    width: 42,
    height: 46,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDow: { color: COLORS.ink, fontSize: 8.5, fontWeight: '800', letterSpacing: 1 },
  dateNum: { color: COLORS.ink, fontSize: 18, fontWeight: '800', marginTop: -1 },

  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.limeDim,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 5,
  },
  livePillText: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});