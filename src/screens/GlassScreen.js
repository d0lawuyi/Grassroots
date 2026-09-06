// components/GlassScreen.js
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS } from '../constants/colors';

export default function GlassScreen({ children, contentStyle, intensity = 40 }) {
  return (
    <View style={styles.root}>
      {/* Gradient backdrop */}
      <LinearGradient
        colors={[COLORS.gradientStart, COLORS.gradientMid, COLORS.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Glass card sitting on top */}
      <View style={styles.glassWrapper}>
        <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.glassTint} />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  glassWrapper: {
    flex: 1,
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.glassSurface,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    borderRadius: 24,
  },
  content: {
    flex: 1,
    padding: 20,
  },
});