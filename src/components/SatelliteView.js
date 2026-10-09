import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

/*
 * Satellite imagery of a venue, so players can see what the field actually looks like.
 * Uses the phone's own map (Apple Maps on iPhone, Google Maps on Android), so there's
 * no extra key or cost. Imagery is usually months to a couple of years old, not live.
 */

// How much ground to show. 0.0025 degrees is roughly 280 m top to bottom: one park.
const FIELD_SPAN = 0.0025;

const hasCoords = (v) =>
  v && v.latitude != null && v.longitude != null && !Number.isNaN(Number(v.latitude)) && !Number.isNaN(Number(v.longitude));

const regionFor = (v, span = FIELD_SPAN) => ({
  latitude: Number(v.latitude),
  longitude: Number(v.longitude),
  latitudeDelta: span,
  longitudeDelta: span,
});

const pointOf = (v) => ({ latitude: Number(v.latitude), longitude: Number(v.longitude) });

/* Small frosted label, same look as the photo chips in Explore. */
function GlassChip({ icon, text, style }) {
  return (
    <View style={[st.chip, style]} pointerEvents="none">
      <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      <View style={st.chipTint} />
      {icon ? <Ionicons name={icon} size={13} color={COLORS.snow} /> : null}
      <Text style={st.chipText}>{text}</Text>
    </View>
  );
}

/*
 * Still satellite picture for cards with no photos. Not draggable, so the card list
 * still scrolls normally. On Android, liteMode draws a cheap static image.
 */
export function SatellitePreview({ venue, height, radius = 0 }) {
  if (!hasCoords(venue)) return null;
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: COLORS.sage }} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        mapType="satellite"
        initialRegion={regionFor(venue)}
        liteMode={Platform.OS === 'android'}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterest={false}
        showsCompass={false}
        accessible={false}
      >
        <Marker coordinate={pointOf(venue)} pinColor={COLORS.clay} />
      </MapView>
      <GlassChip icon="earth-outline" text="Satellite view" style={{ right: 10, bottom: 10 }} />
    </View>
  );
}

/*
 * Interactive map for the venue page: starts on satellite with street names on top
 * (hybrid), and a toggle to switch to the regular map. Pinch to zoom, drag to look around.
 */
export function VenueSatelliteMap({ venue, height = 240 }) {
  const [satellite, setSatellite] = useState(true);
  if (!hasCoords(venue)) return null;
  return (
    <View style={[st.mapCard, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapType={satellite ? 'hybrid' : 'standard'}
        initialRegion={regionFor(venue)}
        showsPointsOfInterest={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker coordinate={pointOf(venue)} title={venue.name} pinColor={COLORS.clay} />
      </MapView>
      <MapTypeToggle satellite={satellite} onChange={setSatellite} style={{ top: 10, right: 10 }} />
    </View>
  );
}

/* Two-option glass switch: Map | Satellite. Also used on the Explore map. */
export function MapTypeToggle({ satellite, onChange, style }) {
  return (
    <View style={[st.toggle, style]}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <View style={st.chipTint} />
      {[
        { key: false, label: 'Map', icon: 'map-outline' },
        { key: true, label: 'Satellite', icon: 'earth-outline' },
      ].map((o) => {
        const on = satellite === o.key;
        return (
          <TouchableOpacity
            key={o.label}
            onPress={() => onChange(o.key)}
            style={[st.toggleBtn, on && st.toggleBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${o.label} view`}
          >
            <Ionicons name={o.icon} size={14} color={on ? COLORS.white : COLORS.snow} />
            <Text style={[st.toggleText, on && { color: COLORS.white }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  chipTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,253,248,0.55)' },
  chipText: { color: COLORS.snow, fontSize: 12, fontWeight: '700' },

  mapCard: {
    marginTop: 14,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.sage,
  },

  toggle: {
    position: 'absolute',
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999 },
  toggleBtnOn: { backgroundColor: COLORS.primary },
  toggleText: { color: COLORS.snow, fontSize: 12.5, fontWeight: '700' },
});
