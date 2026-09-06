import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { COLORS } from '../theme/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const { width } = Dimensions.get('window');

export default function SplashLoadingScreen({ onFinish, duration = 2600 }) {
  const progress = useRef(new Animated.Value(0)).current;
  const letterFade = useRef(new Animated.Value(0)).current;
  const letterRise = useRef(new Animated.Value(14)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Gentle continuous sway, like wind
    Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(letterFade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(letterRise, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(progress, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(exitFade, {
        toValue: 0,
        duration: 420,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onFinish?.());
  }, []);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Stem draws itself as progress fills
  const stemDash = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  // Leaves scale in during the second half
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

  const swayRotate = sway.interpolate({
    inputRange: [0, 1],
    outputRange: ['-2.5deg', '2.5deg'],
  });

  return (
    <Animated.View style={[styles.root, { opacity: exitFade }]}>
      <LinearGradient
        colors={['#0F2A1D', '#1B5E20', '#2E7D32']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft ambient orbs */}
      <View style={[styles.orb, styles.orbTop]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <View style={styles.center}>
        <Animated.View style={{ transform: [{ rotate: swayRotate }] }}>
          <Svg width={190} height={190} viewBox="0 0 200 200" fill="none">
            {/* Soil mound */}
            <Path
              d="M20 158 Q100 132 180 158 L180 200 L20 200 Z"
              fill="#0B1F14"
              opacity={0.55}
            />
            <Path d="M20 158 Q100 132 180 158" stroke="#66BB6A" strokeWidth={2.5} opacity={0.35} fill="none" />

            {/* Stem — draws upward as progress fills */}
            <AnimatedPath
              d="M100 158 C100 130 100 108 100 82"
              stroke="#A7F3D0"
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={120}
              strokeDashoffset={stemDash}
            />

                        {/* Left leaf */}
            <AnimatedG style={{ opacity: leafLeft, transform: [{ scale: leafLeft }] }}>
              <Path
                d="M100 120 C72 111 55 82 64 52 C95 63 103 91 100 120 Z"
                fill="#66BB6A"
              />
            </AnimatedG>

            {/* Right leaf */}
            <AnimatedG style={{ opacity: leafRight, transform: [{ scale: leafRight }] }}>
              <Path
                d="M100 102 C128 92 145 63 136 35 C107 46 100 74 100 102 Z"
                fill="#A7F3D0"
              />
            </AnimatedG>

            {/* Dew highlights */}
            <Circle cx={78} cy={92} r={2.5} fill="#DFF3E2" opacity={0.7} />
            <Circle cx={124} cy={70} r={2} fill="#DFF3E2" opacity={0.5} />
          </Svg>
        </Animated.View>

        <Animated.View
          style={{
            opacity: letterFade,
            transform: [{ translateY: letterRise }],
            alignItems: 'center',
          }}
        >
          <Text style={styles.brand}>GRASSROOTS</Text>
          <Text style={styles.tagline}>PLAY · CONNECT · BUILD COMMUNITY</Text>
        </Animated.View>

        {/* Progress bar */}
        <View style={styles.barTrack}>
          <Animated.View style={[styles.barFill, { width: barWidth }]}>
            <LinearGradient
              colors={['#66BB6A', '#A7F3D0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  orb: { position: 'absolute', borderRadius: 999, opacity: 0.13 },
  orbTop: { width: width * 0.9, height: width * 0.9, backgroundColor: '#A7F3D0', top: -width * 0.35, right: -width * 0.3 },
  orbBottom: { width: width * 0.8, height: width * 0.8, backgroundColor: '#66BB6A', bottom: -width * 0.3, left: -width * 0.35 },
  brand: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 18,
  },
  tagline: {
    color: '#A7F3D0',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginTop: 10,
  },
  barTrack: {
    width: 200,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginTop: 44,
  },
  barFill: { height: '100%', borderRadius: 2, overflow: 'hidden' },
});