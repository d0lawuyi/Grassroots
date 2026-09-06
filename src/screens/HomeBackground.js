// src/components/HomeBackground.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS } from '../theme/colors';

export default function HomeBackground({ children }) {
  return (
    <View style={styles.root}>
      {/* Sky-to-soil gradient backdrop */}
      <LinearGradient
        colors={[COLORS.paleGreen, COLORS.softGreen, COLORS.gradientMid]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Sprout illustration, anchored to the bottom */}
      <View style={styles.illustrationWrap} pointerEvents="none">
        <Svg width="100%" height={260} viewBox="0 0 300 300" fill="none">
          {/* Ground mound */}
          <Path d="M0 230 Q150 190 300 230 L300 300 L0 300 Z" fill={COLORS.gradientEnd} />
          <Path d="M0 230 Q150 190 300 230" stroke={COLORS.primaryDark} strokeWidth={4} fill="none" />
          {/* Stem */}
          <Path d="M150 230 C150 195 150 165 150 130" stroke={COLORS.primaryDark} strokeWidth={6} strokeLinecap="round" />
          {/* Left leaf */}
          <Path d="M150 165 C118 155 98 122 108 88 C142 100 152 132 150 165 Z" fill={COLORS.accent} />
          {/* Right leaf */}
          <Path d="M150 145 C182 133 202 98 192 66 C160 78 150 112 150 145 Z" fill={COLORS.primary} />
        </Svg>
      </View>

      {/* Glass layer — everything below this gets blurred */}
      <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.glassTint} pointerEvents="none" />

      {/* Actual home screen content, sits on top of the glass */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  illustrationWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.glassSurface,
  },
  content: { flex: 1 },
});