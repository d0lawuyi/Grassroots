import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, TextInput, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';

export default function ProfileScreen({ userId }) {
  const [profile, setProfile] = useState(null);
  const [badges, setBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [stats, setStats] = useState({ played: 0, organized: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  async function fetchProfile() {
    const [userRes, badgeRes, catalogRes, playedRes, orgRes] = await Promise.all([
      supabase.from('users').select('*').eq('user_id', userId).single(),
      supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', userId),
      supabase.from('badges').select('*').order('sort_order'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('player_id', userId),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('organizer_id', userId),
    ]);

    setProfile(userRes.data);
    setForm({
      full_name: userRes.data?.full_name || '',
      home_city: userRes.data?.home_city || '',
      home_state: userRes.data?.home_state || '',
      origin_city: userRes.data?.origin_city || '',
      origin_state: userRes.data?.origin_state || '',
    });
    setBadges((badgeRes.data || []).map((b) => b.badge_id));
    setAllBadges(catalogRes.data || []);
    setStats({ played: playedRes.count || 0, organized: orgRes.count || 0 });
  }

  useEffect(() => {
    async function init() {
      await fetchProfile();
      setLoading(false);
    }
    if (userId) init();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;

    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop().split('?')[0] || 'jpg';
      const path = `${userId}/avatar.${ext}`;

      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Cache-bust so the new image shows immediately
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_photo_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setProfile((p) => ({ ...p, profile_photo_url: publicUrl }));
    } catch (error) {
      Alert.alert('Upload failed', error.message);
    } finally {
      setUploading(false);
    }
  }

  async function saveProfile() {
    const { error } = await supabase
      .from('users')
      .update({
        full_name: form.full_name.trim() || 'Player',
        home_city: form.home_city.trim() || null,
        home_state: form.home_state.trim() || null,
        origin_city: form.origin_city.trim() || null,
        origin_state: form.origin_state.trim() || null,
      })
      .eq('user_id', userId);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }

    await fetchProfile();
    setEditing(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const rating = Number(profile?.reliability_score ?? 0);
  const initials = (profile?.full_name || 'P')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const locationLine = [profile?.home_city, profile?.home_state].filter(Boolean).join(', ');
  const originLine = [profile?.origin_city, profile?.origin_state].filter(Boolean).join(', ');

  return (
    <LinearGradient
      colors={[COLORS.canvasTop, COLORS.canvasMid, COLORS.canvasBottom]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => (editing ? saveProfile() : setEditing(true))}>
            <Text style={styles.editLink}>{editing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar + name */}
        <View style={styles.identityCard}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarWrap}>
            {uploading ? (
              <View style={styles.avatar}>
                <ActivityIndicator color={COLORS.primaryDark} />
              </View>
            ) : profile?.profile_photo_url ? (
              <Image source={{ uri: profile.profile_photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={13} color={COLORS.white} />
            </View>
          </TouchableOpacity>

          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={form.full_name}
              onChangeText={(t) => setForm({ ...form, full_name: t })}
              placeholder="Your name"
              placeholderTextColor={COLORS.neutral400}
            />
          ) : (
            <Text style={styles.name}>{profile?.full_name || 'Player'}</Text>
          )}

          {/* Star rating */}
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons
                key={i}
                name={
                  rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline'
                }
                size={18}
                color={COLORS.warning}
              />
            ))}
            <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
          </View>

          {!editing && locationLine ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.muted} />
              <Text style={styles.locationText}>{locationLine}</Text>
            </View>
          ) : null}

          {!editing && originLine ? (
            <View style={styles.locationRow}>
              <Ionicons name="home-outline" size={14} color={COLORS.muted} />
              <Text style={styles.locationText}>From {originLine}</Text>
            </View>
          ) : null}
        </View>

        {/* Editable location fields */}
        {editing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Where you play</Text>
            <View style={styles.fieldRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={form.home_city}
                onChangeText={(t) => setForm({ ...form, home_city: t })}
                placeholder="City"
                placeholderTextColor={COLORS.neutral400}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.home_state}
                onChangeText={(t) => setForm({ ...form, home_state: t })}
                placeholder="State"
                placeholderTextColor={COLORS.neutral400}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>

            <Text style={[styles.cardTitle, { marginTop: 18 }]}>Where you're from</Text>
            <View style={styles.fieldRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={form.origin_city}
                onChangeText={(t) => setForm({ ...form, origin_city: t })}
                placeholder="City"
                placeholderTextColor={COLORS.neutral400}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.origin_state}
                onChangeText={(t) => setForm({ ...form, origin_state: t })}
                placeholder="State"
                placeholderTextColor={COLORS.neutral400}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.played}</Text>
            <Text style={styles.statLabel}>games played</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.organized}</Text>
            <Text style={styles.statLabel}>games hosted</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{badges.length}</Text>
            <Text style={styles.statLabel}>badges</Text>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Badges</Text>
          <View style={styles.badgeGrid}>
            {allBadges.map((badge) => {
              const earned = badges.includes(badge.badge_id);
              return (
                <View
                  key={badge.badge_id}
                  style={[styles.badge, !earned && styles.badgeLocked]}
                >
                  <View style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>
                    <Ionicons
                      name={badge.icon}
                      size={20}
                      color={earned ? COLORS.primaryDark : COLORS.neutral400}
                    />
                  </View>
                  <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]}>
                    {badge.name}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>
                    {badge.description}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={styles.signOut} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  headerTitle: { fontSize: 30, fontWeight: '800', color: COLORS.neutral900 },
  editLink: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  identityCard: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20, padding: 22, borderWidth: 1, borderColor: COLORS.neutral200,
  },
  avatarWrap: { marginBottom: 14 },
  avatar: {
    width: 92, height: 92, borderRadius: 46, backgroundColor: COLORS.softGreen,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitials: { fontSize: 30, fontWeight: '800', color: COLORS.primaryDark },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  name: { fontSize: 21, fontWeight: '800', color: COLORS.neutral900 },
  nameInput: {
    fontSize: 21, fontWeight: '800', color: COLORS.neutral900, textAlign: 'center',
    borderBottomWidth: 1, borderBottomColor: COLORS.neutral300, paddingVertical: 4, minWidth: 180,
  },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 8 },
  ratingText: { fontSize: 14, fontWeight: '700', color: COLORS.neutral700, marginLeft: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  locationText: { fontSize: 13, color: COLORS.muted },
  card: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 18,
    marginTop: 14, borderWidth: 1, borderColor: COLORS.neutral200,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.neutral800, marginBottom: 12 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, height: 46,
    fontSize: 15, color: COLORS.neutral900, borderWidth: 1, borderColor: COLORS.neutral200,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: {
    flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16, paddingVertical: 16, borderWidth: 1, borderColor: COLORS.neutral200,
  },
  statNumber: { fontSize: 22, fontWeight: '800', color: COLORS.primaryDark },
  statLabel: { fontSize: 11, color: COLORS.muted, marginTop: 3 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: {
    width: '47%', backgroundColor: COLORS.paleGreen, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: COLORS.primaryLight,
  },
  badgeLocked: { backgroundColor: COLORS.neutral50, borderColor: COLORS.neutral200 },
  badgeIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.softGreen,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  badgeIconLocked: { backgroundColor: COLORS.neutral100 },
  badgeName: { fontSize: 13, fontWeight: '700', color: COLORS.neutral900 },
  badgeNameLocked: { color: COLORS.neutral500 },
  badgeDesc: { fontSize: 11, color: COLORS.muted, marginTop: 2, lineHeight: 15 },
  signOut: { alignItems: 'center', marginTop: 24, paddingVertical: 14 },
  signOutText: { color: COLORS.danger, fontWeight: '700', fontSize: 15 },
});