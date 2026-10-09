import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';

import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { useFonts, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './src/lib/supabase';

import AuthScreen from './src/screens/AuthScreen';
import CreateGameScreen from './src/screens/CreateGameScreen';
import ParkGamesSheet from './src/screens/ParkGamesSheet';
import GameDetailsScreen from './src/screens/GameDetailsScreen';
import MyGamesScreen from './src/screens/MyGamesScreen';
import ExploreScreen from './src/screens/ExploreScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import GameChatScreen from './src/screens/GameChatScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GameReviewScreen from './src/screens/GameReviewScreen';
import SplashLoadingScreen from './src/screens/SplashLoadingScreen';
import MySeriesScreen from './src/screens/MySeriesScreen';
import Onboarding from './src/screens/Onboarding';
import ListVenueScreen from './src/screens/ListVenueScreen';
import AdminReviewScreen from './src/screens/AdminReviewScreen';
import { fetchHiddenGameIds } from './src/lib/hiddenGames';
import { COLORS } from './src/theme/colors';

const ONBOARDING_KEY = 'grassroots:onboarding_complete_v9';

// Dark grey-green for tabs that aren't selected (matches the Clubhouse mockup).
const TAB_IDLE = COLORS.neutral700;

// Rating prompt on launch: once per game, within 2 days of the final whistle.
const REVIEW_PROMPTED_KEY = 'grassroots.reviewPromptedGameIds';
const REVIEW_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

async function readPromptedIds() {
  try {
    const raw = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const TABS = [
  { key: 'explore', label: 'Explore', icon: 'compass-outline', activeIcon: 'compass' },
  { key: 'messages', label: 'Chats', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
  { key: 'mygames', label: 'My games', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

const DEFAULT_LOCATION = {
  latitude: 39.7684,
  longitude: -86.1581,
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [fontsLoaded, fontError] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);

  const [showCreateGame, setShowCreateGame] = useState(false);
  const [createAtParkId, setCreateAtParkId] = useState(null);
  const [selectedPark, setSelectedPark] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [chatGame, setChatGame] = useState(null);
  const [reviewGame, setReviewGame] = useState(null);
  const [activeTab, setActiveTab] = useState('explore');
  const [splashDone, setSplashDone] = useState(false);
  const [tabKey, setTabKey] = useState(0);
  const [showSeries, setShowSeries] = useState(false);
  const [showListVenue, setShowListVenue] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // null = still reading storage, true = seen it, false = show it
  const [onboardingSeen, setOnboardingSeen] = useState(null);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setTabKey((k) => k + 1);
  };

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_KEY);
        setOnboardingSeen(seen === 'true');
      } catch (error) {
        // If storage fails, show it rather than skip it
        setOnboardingSeen(false);
      }
    }
    checkOnboarding();
  }, []);

  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (error) {
      // Not fatal — they will just see it again next launch
    }
    setOnboardingSeen(true);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});

          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (error) {
        console.error('App initialization error:', error);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!session) return;

    // Ask once per game, and only for games that just finished. Skipping it
    // (or rating later from My Games) means the prompt never comes back on launch.
    async function checkUnrated() {
      const { data } = await supabase
        .from('bookings')
        .select('rating_given, games(*, parks(name))')
        .eq('player_id', session.user.id)
        .is('rating_given', null);

      const now = Date.now();
      const [asked, hidden] = await Promise.all([
        readPromptedIds(),
        fetchHiddenGameIds(session.user.id),
      ]);

      const finished = (data || [])
        .map((b) => b.games)
        .filter((g) => {
          if (!g?.end_time) return false;
          const ended = new Date(g.end_time).getTime();
          return ended < now && now - ended < REVIEW_WINDOW_MS;
        })
        .filter((g) => !asked.includes(String(g.game_id)) && !hidden.has(g.game_id))
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

      if (finished.length === 0) return;

      // Remember every game we passed over too, so older ones don't queue up behind this one.
      const ids = finished.map((g) => String(g.game_id));
      await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, JSON.stringify([...asked, ...ids].slice(-200)));
      setReviewGame(finished[0]);
    }

    checkUnrated();
  }, [session]);

  const openGame = (game) => {
    setSelectedGame(game);

    if (game?.parks) {
      setSelectedPark(game.parks);
    }
  };

  const closeDetails = () => {
    setSelectedGame(null);
    setSelectedPark(null);
    setTabKey((k) => k + 1);
  };


    console.log('STATE:', { splashDone, onboardingSeen, authLoading, session: !!session, loading });

  if (!splashDone) {
    return <SplashLoadingScreen onFinish={() => setSplashDone(true)} />;
  }

  // Wait for the heading font; if it fails to load, carry on with system fonts.
  if (onboardingSeen === null || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!onboardingSeen) {
    return <Onboarding onDone={finishOnboarding} />;
  }

  if (authLoading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Grassroots</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.content}>

          {/* EXPLORE TAB */}
          {activeTab === 'explore' && (
            <ExploreScreen
              key={tabKey}
              userId={session.user.id}
              userLocation={userLocation}
              onSelectPark={(park) => setSelectedPark(park)}
              onSelectGame={openGame}
              onCreateGame={(park) => {
                 setCreateAtParkId(park?.park_id || null);
                 setShowCreateGame(true);
               }}
            />
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'messages' && (
            <MessagesScreen
              key={tabKey}
              userId={session.user.id}
              onOpenChat={(game) => setChatGame(game)}
            />
          )}

          {/* MY GAMES TAB */}
          {activeTab === 'mygames' && (
                        <MyGamesScreen
              key={tabKey}
              userId={session.user.id}
              onSelectGame={openGame}
              onRateGame={(game) => setReviewGame(game)}
              onOpenSeries={() => setShowSeries(true)}
            />
          )}
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <ProfileScreen
              key={tabKey}
              userId={session.user.id}
              onOpenListVenue={() => setShowListVenue(true)}
              onOpenAdmin={() => setShowAdmin(true)}
            />
          )}
        </View>

        {/* BOTTOM TAB BAR: floating liquid-glass pill */}
        <View style={styles.tabBarWrap}>
          <View style={styles.tabBarShadow}>
            <View style={styles.tabBar}>
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.tabBarTint} />
              <View style={styles.tabBarSheen} pointerEvents="none" />
              {TABS.map((t) => {
                const on = activeTab === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tab, on && styles.tabActive]}
                    onPress={() => switchTab(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t.label}
                  >
                    <Ionicons name={on ? t.activeIcon : t.icon} size={22} color={on ? COLORS.primary : TAB_IDLE} />
                    <Text style={[styles.tabText, on && styles.tabTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* CREATE GAME MODAL */}
        <Modal
          visible={showCreateGame}
          animationType="slide"
          transparent
          onRequestClose={() => {
            setShowCreateGame(false);
            setCreateAtParkId(null);
          }}
        >
          <CreateGameScreen
            key={createAtParkId || 'new'}
            userId={session.user.id}
            initialParkId={createAtParkId}
            onClose={() => {
              setShowCreateGame(false);
              setCreateAtParkId(null);
              setTabKey((k) => k + 1);
            }}
          />
        </Modal>

        {/* PARK GAMES SHEET */}
        <Modal
          visible={!!selectedPark && !selectedGame}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedPark(null)}
        >
          <View style={styles.sheetBackdrop}>
            <ParkGamesSheet
              park={selectedPark}
              onClose={() => setSelectedPark(null)}
              onSelectGame={(game) => setSelectedGame(game)}
            />
          </View>
        </Modal>

        {/* GAME DETAILS */}
        <Modal
          visible={!!selectedGame}
          animationType="slide"
          onRequestClose={closeDetails}
        >
          <GameDetailsScreen
            game={selectedGame}
            park={selectedPark}
            userId={session.user.id}
            onClose={closeDetails}
            onOpenChat={() => setChatGame(selectedGame)}
          />
        </Modal>

        {/* GAME CHAT */}
        <Modal
          visible={!!chatGame}
          animationType="slide"
          onRequestClose={() => setChatGame(null)}
        >
          <GameChatScreen
            game={chatGame}
            userId={session.user.id}
            onClose={() => setChatGame(null)}
          />
        </Modal>

        {/* GAME REVIEW */}
        <Modal
          visible={!!reviewGame}
          animationType="slide"
          onRequestClose={() => setReviewGame(null)}
        >
          <GameReviewScreen
            game={reviewGame}
            userId={session.user.id}
            onClose={() => {
              setReviewGame(null);
              setTabKey((k) => k + 1);
            }}
          />
                </Modal>

        {/* LIST YOUR VENUE (owners) */}
        <Modal
          visible={showListVenue}
          animationType="slide"
          onRequestClose={() => setShowListVenue(false)}
        >
          <ListVenueScreen
            userId={session.user.id}
            userLocation={userLocation}
            onClose={() => setShowListVenue(false)}
          />
        </Modal>

        {/* VENUE REVIEW (admins) */}
        <Modal
          visible={showAdmin}
          animationType="slide"
          onRequestClose={() => setShowAdmin(false)}
        >
          <AdminReviewScreen
            onClose={() => {
              setShowAdmin(false);
              setTabKey((k) => k + 1);
            }}
          />
        </Modal>

        {/* RECURRING GAMES */}
        <Modal
          visible={showSeries}
          animationType="slide"
          onRequestClose={() => setShowSeries(false)}
        >
          <MySeriesScreen
            userId={session.user.id}
            onClose={() => {
              setShowSeries(false);
              setTabKey((k) => k + 1);
            }}
          />
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}
       

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },

  content: {
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.ink,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.mute,
    fontWeight: '500',
  },

  // Floats over the screen so content scrolls underneath and shows through the glass.
  // Tab screens leave about 120px at the bottom of their lists for it.
  tabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 22,
  },

  tabBar: {
    flexDirection: 'row',
    height: 68,
    borderRadius: 34,
    padding: 5,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'transparent',
  },

  tabBarShadow: {
    borderRadius: 34,
    shadowColor: '#172019',
    shadowOpacity: 0.16,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },

  tabBarTint: {
    ...StyleSheet.absoluteFillObject,
    // Frosted cream glass: half see-through so the blur behind it shows
    backgroundColor: 'rgba(255,253,248,0.5)',
  },

  // Bright 1px highlight along the top edge, the "lit glass" rim
  tabBarSheen: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
  },

  tabActive: {
    backgroundColor: 'rgba(213,226,208,0.9)', // sage
  },

  tabText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: TAB_IDLE,
    marginTop: 2,
  },

  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
});