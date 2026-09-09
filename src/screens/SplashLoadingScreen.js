import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { COLORS } from '../theme/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const { width } = Dimensions.get('window');

export default function SplashLoadingScreen({ onFinish, duration = 2200 }) {
  const progress = useRef(new Animated.Value(0)).current;
  const letterFade = useRef(new Animated.Value(0)).current;
  const letterRise = useRef(new Animated.Value(14)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(letterFade, {
          toValue: 1, duration: 600,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(letterRise, {
          toValue: 0, duration: 600,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]),
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(exitFade, {
        toValue: 0, duration: 380,
        easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }),
    ]).start(() => onFinish?.());
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const stemDash = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  const leafLeft = progress.interpolate({
    inputRange: [0, 0.4, 0.75],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const leafRight = progress.interpolate({
    inputRange: [0, 0.55, 0.95],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.root, { opacity: exitFade }]}>
      <View style={styles.center}>
        <Svg width={170} height={170} viewBox="0 0 200 200" fill="none">
          <Path
            d="M20 158 Q100 138 180 158"
            stroke={COLORS.line}
            strokeWidth={2}
            fill="none"
          />

          <AnimatedPath
            d="M100 158 C100 130 100 108 100 82"
            stroke={COLORS.primary}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={120}
            strokeDashoffset={stemDash}
          />

          <AnimatedG style={{ opacity: leafLeft, transform: [{ scale: leafLeft }] }}>
            <Path
              d="M100 120 C72 111 55 82 64 52 C95 63 103 91 100 120 Z"
              fill={COLORS.primary}
              opacity={0.85}
            />
          </AnimatedG>

          <AnimatedG style={{ opacity: leafRight, transform: [{ scale: leafRight }] }}>
            <Path
              d="M100 102 C128 92 145 63 136 35 C107 46 100 74 100 102 Z"
              fill={COLORS.primary}
              opacity={0.45}
            />
          </AnimatedG>
        </Svg>

        <Animated.View
          style={{
            opacity: letterFade,
            transform: [{ translateY: letterRise }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.brand}>GRASSROOTS</Text>
        </Animated.View>

        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: barWidth }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  brand: {
    color: COLORS.snow,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 6,
    marginTop: 26,
  },
  barTrack: {
    width: 160,
    height: 2,
    backgroundColor: COLORS.line,
    overflow: 'hidden',
    marginTop: 40,
  },
  barFill: { height: '100%', backgroundColor: COLORS.primary },
});