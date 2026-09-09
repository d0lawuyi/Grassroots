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
import Onboarding from './src/screens/Onboarding';
import { COLORS } from './src/theme/colors';

const ONBOARDING_KEY = 'grassroots:onboarding_complete_v4';

const DEFAULT_LOCATION = {
  latitude: 39.7684,
  longitude: -86.1581,
};

export default function App() {
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);

  const [showCreateGame, setShowCreateGame] = useState(false);
  const [selectedPark, setSelectedPark] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [chatGame, setChatGame] = useState(null);
  const [reviewGame, setReviewGame] = useState(null);
  const [activeTab, setActiveTab] = useState('explore');
  const [splashDone, setSplashDone] = useState(false);
  const [tabKey, setTabKey] = useState(0);

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

    async function checkUnrated() {
      const { data } = await supabase
        .from('bookings')
        .select('rating_given, games(*, parks(name))')
        .eq('player_id', session.user.id)
        .is('rating_given', null);

      const finished = (data || [])
        .filter((b) => b.games && b.games.end_time < new Date().toISOString())
        .map((b) => b.games)
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

      if (finished.length > 0) setReviewGame(finished[0]);
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

     if (onboardingSeen === null) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
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
        <StatusBar style="light" />
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
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Grassroots</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
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
              onCreateGame={() => setShowCreateGame(true)}
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
            />
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <ProfileScreen key={tabKey} userId={session.user.id} />
          )}
        </View>

        {/* BOTTOM TAB BAR */}
        <View style={styles.tabBar}>
          <TouchableOpacity style={styles.tab} onPress={() => switchTab('explore')}>
            <Ionicons
              name="compass-outline"
              size={24}
              color={activeTab === 'explore' ? COLORS.primary : COLORS.mute}
            />
            <Text style={[styles.tabText, activeTab === 'explore' && styles.tabTextActive]}>
              Explore
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={() => switchTab('messages')}>
            <Ionicons
              name="chatbubble-outline"
              size={24}
              color={activeTab === 'messages' ? COLORS.primary : COLORS.mute}
            />
            <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>
              Chats
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={() => switchTab('mygames')}>
            <Ionicons
              name="calendar-outline"
              size={24}
              color={activeTab === 'mygames' ? COLORS.primary : COLORS.mute}
            />
            <Text style={[styles.tabText, activeTab === 'mygames' && styles.tabTextActive]}>
              My Games
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tab} onPress={() => switchTab('profile')}>
            <Ionicons
              name="person-outline"
              size={24}
              color={activeTab === 'profile' ? COLORS.primary : COLORS.mute}
            />
            <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* CREATE GAME MODAL */}
        <Modal
          visible={showCreateGame}
          animationType="slide"
          transparent
          onRequestClose={() => setShowCreateGame(false)}
        >
          <CreateGameScreen
            userId={session.user.id}
            onClose={() => {
              setShowCreateGame(false);
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

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.inkRaised,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
    paddingTop: 8,
    paddingBottom: 16,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },

  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mute,
    marginTop: 3,
  },

  tabTextActive: {
    color: COLORS.primary,
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
});