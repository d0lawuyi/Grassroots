import React, { useEffect, useRef } from 'react';

import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';

export default function LandingScreen({ navigation }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),

      Animated.timing(rise, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const findGame = () => {
    navigation.navigate('Main', {
      screen: 'Explore',
    });
  };

  const hostGame = () => {
    navigation.navigate('Main', {
      screen: 'Create',
    });
  };

  return (
    <LinearGradient
      colors={[
        '#DCE3EC',
        '#E7E2E9',
        '#F0E9E5',
        '#E4EAE7',
      ]}
      style={styles.background}
    >
      <SafeAreaView style={styles.safe}>
        {/* Background color blobs */}

        <View style={[styles.orb, styles.orbBlue]} />
        <View style={[styles.orb, styles.orbPlum]} />
        <View style={[styles.orb, styles.orbCoral]} />

        {/* Sprout growing from the bottom */}
        <View style={styles.sproutWrap} pointerEvents="none">
          <Svg width="100%" height={220} viewBox="0 0 300 300" fill="none">
            {/* Ground mound */}
            <Path d="M0 250 Q150 210 300 250 L300 320 L0 320 Z" fill={COLORS.fieldLight} opacity={0.55} />
            {/* Stem */}
            <Path d="M150 250 C150 215 150 185 150 150" stroke={COLORS.primaryDark} strokeWidth={5} strokeLinecap="round" />
            {/* Left leaf */}
            <Path d="M150 185 C120 175 102 144 111 112 C143 123 152 153 150 185 Z" fill={COLORS.field} opacity={0.85} />
            {/* Right leaf */}
            <Path d="M150 165 C180 154 198 122 189 92 C159 103 150 134 150 165 Z" fill={COLORS.primaryDark} opacity={0.7} />
          </Svg>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        ></ScrollView>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Animated.View
            style={{
              opacity: fade,
              transform: [{ translateY: rise }],
            }}
          >
            {/* NAV */}

            <View style={styles.nav}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Ionicons
                    name="football-outline"
                    size={20}
                    color={COLORS.primaryDark}
                  />
                </View>

                <Text style={styles.brand}>
                  GRASSROOTS
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.signInButton,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  navigation.navigate('Auth')
                }
              >
                <Text style={styles.signInText}>
                  Sign in
                </Text>
              </Pressable>
            </View>

            {/* HERO GLASS */}

            <BlurView
              intensity={55}
              tint="light"
              style={styles.heroGlass}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />

                  <Text style={styles.liveText}>
                    INDY PICKUP
                  </Text>
                </View>
              </View>

              <Text style={styles.heroTitle}>
                Find the game
                {'\n'}
                before the group chat does
              </Text>

              <Text style={styles.heroSubtitle}>
                Local fields, nearby players and pickup
                football without the endless searching
              </Text>

              <View style={styles.actions}>
                <Pressable
                  onPress={findGame}
                  style={({ pressed }) => [
                    styles.mainButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.mainButtonText}>
                    Find a game
                  </Text>

                  <Ionicons
                    name="arrow-forward"
                    size={19}
                    color={COLORS.white}
                  />
                </Pressable>

                <Pressable
                  onPress={hostGame}
                  style={({ pressed }) => [
                    styles.hostButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={COLORS.text}
                  />

                  <Text style={styles.hostButtonText}>
                    Host one
                  </Text>
                </Pressable>
              </View>
            </BlurView>

            {/* MINI STATS */}

            <View style={styles.statsRow}>
              <BlurView
                intensity={35}
                tint="light"
                style={styles.statCard}
              >
                <Text style={styles.statNumber}>
                  NEARBY
                </Text>

                <Text style={styles.statLabel}>
                  games around you
                </Text>
              </BlurView>

              <BlurView
                intensity={35}
                tint="light"
                style={styles.statCard}
              >
                <Text style={styles.statNumber}>
                  ALL LEVELS
                </Text>

                <Text style={styles.statLabel}>
                  just bring boots
                </Text>
              </BlurView>
            </View>

            {/* HOW IT WORKS */}

            <View style={styles.sectionHeader}>
              <Text style={styles.eyebrow}>
                NO OVERTHINKING
              </Text>

              <Text style={styles.sectionTitle}>
                Get on the field
              </Text>
            </View>

            <View style={styles.featureGrid}>
              <GlassFeature
                icon="navigate-outline"
                title="Find the spot"
                text="See what's close without digging through ten different chats"
                tint={COLORS.primaryLight}
              />

              <GlassFeature
                icon="people-outline"
                title="Know the vibe"
                text="See the format, level and player count before you pull up"
                tint={COLORS.plumLight}
              />

              <GlassFeature
                icon="calendar-outline"
                title="Run your own"
                text="Pick the park, set the time and let people join"
                tint={COLORS.coralLight}
              />
            </View>

            {/* LAST CTA */}

            <BlurView
              intensity={40}
              tint="light"
              style={styles.bottomGlass}
            >
              <View style={styles.bottomIcon}>
                <Ionicons
                  name="football"
                  size={25}
                  color={COLORS.field}
                />
              </View>

              <View style={styles.bottomCopy}>
                <Text style={styles.bottomTitle}>
                  Your city already plays
                </Text>

                <Text style={styles.bottomText}>
                  You just need to know where
                </Text>
              </View>

              <Pressable
                style={styles.arrowButton}
                onPress={findGame}
              >
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={COLORS.text}
                />
              </Pressable>
            </BlurView>

            <Text style={styles.footer}>
              GRASSROOTS • INDIANAPOLIS
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function GlassFeature({
  icon,
  title,
  text,
  tint,
}) {
  return (
    <BlurView
      intensity={40}
      tint="light"
      style={styles.feature}
    >
      <View
        style={[
          styles.featureIcon,
          { backgroundColor: tint },
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={COLORS.text}
        />
      </View>

      <Text style={styles.featureTitle}>
        {title}
      </Text>

      <Text style={styles.featureText}>
        {text}
      </Text>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  safe: {
    flex: 1,
  },

  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },

  orb: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },

  orbBlue: {
    width: 260,
    height: 260,
    backgroundColor: '#B9C9DC',
    top: 80,
    right: -100,
  },

  orbPlum: {
    width: 210,
    height: 210,
    backgroundColor: '#D3C3D5',
    top: 330,
    left: -110,
  },

  orbCoral: {
    width: 220,
    height: 220,
    backgroundColor: '#DFC2BC',
    bottom: 140,
    right: -120,
  },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 22,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    marginRight: 10,
  },

  brand: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  signInButton: {
    paddingHorizontal: 15,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.48)',
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },

  signInText: {
    color: COLORS.text,
    fontWeight: '700',
  },

  heroGlass: {
    overflow: 'hidden',
    borderRadius: 30,
    padding: 22,

    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,

    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 25,
    shadowOffset: {
      width: 0,
      height: 12,
    },

    elevation: 5,
  },

  heroTopRow: {
    flexDirection: 'row',
    marginBottom: 25,
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.field,
    marginRight: 7,
  },

  liveText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  heroTitle: {
    color: COLORS.text,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.3,
  },

  heroSubtitle: {
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
    maxWidth: 320,
  },

  actions: {
    marginTop: 27,
  },

  mainButton: {
    minHeight: 56,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 18,

    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    gap: 9,
  },

  mainButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },

  hostButton: {
    minHeight: 54,
    marginTop: 10,

    backgroundColor: 'rgba(255,255,255,0.54)',

    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,

    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    gap: 7,
  },

  hostButtonText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 15,
  },

  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  statCard: {
    flex: 1,
    overflow: 'hidden',
    padding: 15,

    borderRadius: 19,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,

    backgroundColor: COLORS.glass,
  },

  statNumber: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  statLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },

  sectionHeader: {
    marginTop: 36,
    marginBottom: 14,
  },

  eyebrow: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 5,
    letterSpacing: -0.6,
  },

  featureGrid: {
    gap: 10,
  },

  feature: {
    overflow: 'hidden',
    borderRadius: 22,

    padding: 17,

    borderWidth: 1,
    borderColor: COLORS.glassBorder,

    backgroundColor: COLORS.glass,
  },

  featureIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,

    justifyContent: 'center',
    alignItems: 'center',

    marginBottom: 17,
  },

  featureTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '850',
  },

  featureText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 310,
  },

  bottomGlass: {
    overflow: 'hidden',

    marginTop: 20,
    padding: 16,

    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,

    backgroundColor: COLORS.glass,

    flexDirection: 'row',
    alignItems: 'center',
  },

  bottomIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,

    backgroundColor: COLORS.fieldLight,

    justifyContent: 'center',
    alignItems: 'center',

    marginRight: 12,
  },

  bottomCopy: {
    flex: 1,
  },

  bottomTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 15,
  },

  bottomText: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },

  arrowButton: {
    width: 43,
    height: 43,

    borderRadius: 15,

    backgroundColor: 'rgba(255,255,255,0.60)',

    justifyContent: 'center',
    alignItems: 'center',
  },

  footer: {
    textAlign: 'center',

    marginTop: 25,

    color: COLORS.subtle,

    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
});