import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from '../components/maps';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';
import { DARK_MAP } from '../theme/mapStyle';
import { MapTypeToggle } from '../components/SatelliteView';

const SPORTS = [
  { label: 'Soccer', value: 'soccer' },
  { label: 'Basketball', value: 'basketball' },
  { label: 'Flag Football', value: 'flag_football' },
  { label: 'Track', value: 'track' },
  { label: 'Ultimate', value: 'ultimate' },
];

const MAX_PHOTOS = 6;

const CREAM_SOFT = 'rgba(255,253,248,0.72)';

/* Each status is a coloured pill: label, text colour, pill colour. */
const STATUS = {
  draft:             { label: 'Draft',             fg: COLORS.mute,   bg: COLORS.neutral100 },
  submitted:         { label: 'Under review',      fg: COLORS.forest, bg: COLORS.sage },
  changes_requested: { label: 'Changes requested', fg: COLORS.clay,   bg: COLORS.clayLight },
  approved:          { label: 'Verified and live', fg: COLORS.white,  bg: COLORS.forest },
  rejected:          { label: 'Not approved',      fg: COLORS.danger, bg: 'rgba(180,35,24,0.10)' },
};

const EMPTY = {
  submission_id: null,
  status: 'draft',
  name: '',
  sports: [],
  address: '',
  city: '',
  state: '',
  latitude: null,
  longitude: null,
  is_free: false,
  hourly_rate: '',
  availability: '',
  surface: '',
  lights_until: '',
  parking: '',
  rules: '',
  photos: [],
  proof_path: null,
  admin_note: null,
};

const DEFAULT_REGION = { latitude: 39.7684, longitude: -86.1581 };

function fileKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp' };

/* Uploads one picked image into the owner's own folder and returns its storage path. */
async function uploadImage(bucket, folder, asset) {
  const contentType = asset.mimeType || 'image/jpeg';
  const path = `${folder}/${fileKey()}.${EXTENSIONS[contentType] || 'jpg'}`;
  const response = await fetch(asset.uri);
  const body = await response.arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

function canEdit(status) {
  return status === 'draft' || status === 'changes_requested';
}

/* What still blocks "Submit for review". Mirrors the database rules. */
function missingForSubmit(form) {
  const missing = [];
  if (form.name.trim().length < 2) missing.push('a venue name');
  if (form.sports.length === 0) missing.push('at least one sport');
  if (form.latitude == null || form.longitude == null) missing.push('the location pin');
  if (!form.is_free && !(Number(form.hourly_rate) > 0)) missing.push('an hourly rate (or mark it free)');
  if (form.photos.length === 0) missing.push('at least one photo');
  if (!form.proof_path) missing.push('proof that you own or manage it');
  return missing;
}

export default function ListVenueScreen({ userId, userLocation, onClose }) {
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draftKey, setDraftKey] = useState(fileKey());
  const mapRef = useRef(null);
  // Satellite by default: owners can see the actual field and pin its entrance exactly
  const [mapSatellite, setMapSatellite] = useState(true);

  async function loadMine() {
    const { data, error } = await supabase
      .from('venue_submissions')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      Alert.alert('Could not load your venues', error.message);
      return;
    }
    setMine(data || []);
  }

  useEffect(() => {
    loadMine().finally(() => setLoading(false));
  }, []);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  function startNew() {
    setDraftKey(fileKey());
    setForm({
      ...EMPTY,
      latitude: null,
      longitude: null,
    });
  }

  function openExisting(row) {
    setDraftKey(row.submission_id);
    setForm({
      ...EMPTY,
      ...row,
      hourly_rate: row.hourly_rate != null && !row.is_free ? String(row.hourly_rate) : '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      availability: row.availability || '',
      surface: row.surface || '',
      lights_until: row.lights_until || '',
      parking: row.parking || '',
      rules: row.rules || '',
      photos: row.photos || [],
      sports: row.sports || [],
    });
  }

  function toggleSport(value) {
    setForm((f) => ({
      ...f,
      sports: f.sports.includes(value) ? f.sports.filter((s) => s !== value) : [...f.sports, value],
    }));
  }

  async function useMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location is off', 'Allow location, or press and hold the map to drop the pin.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setForm((f) => ({ ...f, ...coordinate }));
      mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
    } catch (error) {
      Alert.alert('Could not get your location', error.message);
    }
  }

  async function pickImages(limit) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo access needed', 'Allow photo access to add pictures of your venue.');
      return [];
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      quality: 0.7,
    });
    return result.canceled ? [] : result.assets.slice(0, limit);
  }

  async function addPhotos() {
    const room = MAX_PHOTOS - form.photos.length;
    if (room <= 0) return;
    const assets = await pickImages(room);
    if (assets.length === 0) return;
    setUploading(true);
    try {
      const urls = [];
      for (const asset of assets) {
        const path = await uploadImage('venue-photos', `${userId}/${draftKey}`, asset);
        urls.push(supabase.storage.from('venue-photos').getPublicUrl(path).data.publicUrl);
      }
      setForm((f) => ({ ...f, photos: [...f.photos, ...urls] }));
    } catch (error) {
      Alert.alert('Photo upload failed', error.message);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url) {
    setForm((f) => ({ ...f, photos: f.photos.filter((p) => p !== url) }));
  }

  async function addProof() {
    const [asset] = await pickImages(1);
    if (!asset) return;
    setUploading(true);
    try {
      const path = await uploadImage('venue-proofs', `${userId}/${draftKey}`, asset);
      set('proof_path', path);
    } catch (error) {
      Alert.alert('Upload failed', error.message);
    } finally {
      setUploading(false);
    }
  }

  async function save(status) {
    if (status === 'submitted') {
      const missing = missingForSubmit(form);
      if (missing.length > 0) {
        Alert.alert('Almost there', `Before submitting, add ${missing.join(', ')}.`);
        return;
      }
    } else if (form.name.trim().length < 2) {
      Alert.alert('Name your venue', 'Add a venue name to save a draft.');
      return;
    }

    const row = {
      status,
      name: form.name.trim(),
      sports: form.sports,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      latitude: form.latitude,
      longitude: form.longitude,
      is_free: form.is_free,
      hourly_rate: form.is_free ? 0 : Number(form.hourly_rate) || null,
      availability: form.availability.trim() || null,
      surface: form.surface.trim() || null,
      lights_until: form.lights_until.trim() || null,
      parking: form.parking.trim() || null,
      rules: form.rules.trim() || null,
      photos: form.photos,
      proof_path: form.proof_path,
    };

    setSaving(true);
    const query = form.submission_id
      ? supabase.from('venue_submissions').update(row).eq('submission_id', form.submission_id)
      : supabase.from('venue_submissions').insert(row);
    const { error } = await query;
    setSaving(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }

    if (status === 'submitted') {
      Alert.alert(
        'Sent for review',
        'We check ownership, location, pricing and legitimacy. Your venue goes live in Explore once it is approved.'
      );
    }
    setForm(null);
    await loadMine();
  }

  async function deleteDraft() {
    Alert.alert('Delete this draft?', 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('venue_submissions').delete().eq('submission_id', form.submission_id);
          if (error) {
            Alert.alert('Could not delete', error.message);
            return;
          }
          setForm(null);
          await loadMine();
        },
      },
    ]);
  }

  /* ---------------- list of my venues ---------------- */
  if (!form) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.content}>
          <TouchableOpacity onPress={onClose} style={s.back} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={COLORS.snow} />
          </TouchableOpacity>
          <Text style={s.title}>Your venues</Text>

          <View style={s.hero}>
            <Text style={s.heroTitle}>Own or manage a field or court?</Text>
            <Text style={s.heroBody}>
              List it here. Once approved, players can book it and the rental is split between them.
            </Text>
            <TouchableOpacity style={s.heroBtn} onPress={startNew} activeOpacity={0.85}>
              <Ionicons name="add" size={19} color={COLORS.forest} />
              <Text style={s.heroBtnText}>List a venue</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.primary} />
          ) : mine.length > 0 ? (
            <>
              <View style={s.listHead}>
                <Text style={s.listTitle}>Your listings</Text>
                <View style={s.countBadge}>
                  <Text style={s.countText}>{mine.length}</Text>
                </View>
              </View>
              {mine.map((row) => {
                const st = STATUS[row.status] || STATUS.draft;
                return (
                  <TouchableOpacity key={row.submission_id} style={s.venueRow} onPress={() => openExisting(row)} activeOpacity={0.85}>
                    {row.photos?.[0] ? (
                      <Image source={{ uri: row.photos[0] }} style={s.thumb} />
                    ) : (
                      <View style={[s.thumb, s.thumbEmpty]}>
                        <Ionicons name="image-outline" size={20} color={COLORS.mute} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={s.venueName} numberOfLines={1}>{row.name}</Text>
                      <StatusPill status={st} />
                      {row.admin_note && (row.status === 'changes_requested' || row.status === 'rejected') ? (
                        <View style={s.rowNote}>
                          <Text style={s.rowNoteText} numberOfLines={2}>{row.admin_note}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.mute} />
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  /* ---------------- form ---------------- */
  const editable = canEdit(form.status);
  const st = STATUS[form.status] || STATUS.draft;
  const pin = form.latitude != null && form.longitude != null ? { latitude: form.latitude, longitude: form.longitude } : null;
  const center = pin || userLocation || DEFAULT_REGION;
  const missing = missingForSubmit(form);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setForm(null)} style={s.back} accessibilityLabel="Back to your venues">
          <Ionicons name="arrow-back" size={25} color={COLORS.snow} />
        </TouchableOpacity>

        <Text style={s.title}>{form.submission_id ? form.name || 'Your venue' : 'List a venue'}</Text>
        <StatusPill status={st} />

        {form.admin_note && !['draft', 'approved'].includes(form.status) ? (
          <View style={s.noteBox}>
            <Ionicons name="chatbox-ellipses-outline" size={20} color={COLORS.clay} />
            <Text style={s.noteBoxText}>{form.admin_note}</Text>
          </View>
        ) : null}

        {!editable ? (
          <View style={s.lockBox}>
            <Ionicons name="lock-closed-outline" size={18} color={COLORS.mute} />
            <Text style={s.lockText}>
              {form.status === 'submitted'
                ? 'This venue is being reviewed, so it cannot be edited right now.'
                : form.status === 'approved'
                ? 'This venue is live. Contact Grassroots to change verified details.'
                : 'This listing was not approved.'}
            </Text>
          </View>
        ) : null}

        <Section step={1} title="The venue">
          <Text style={s.label}>Venue name</Text>
          <TextInput
            style={s.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="Central Green Field"
            placeholderTextColor={COLORS.faint}
            editable={editable}
            maxLength={80}
          />

          <Text style={[s.label, s.gap]}>Sports played here</Text>
          <View style={s.chips}>
            {SPORTS.map((sp) => {
              const on = form.sports.includes(sp.value);
              return (
                <TouchableOpacity
                  key={sp.value}
                  style={[s.chip, on && s.chipOn]}
                  onPress={() => editable && toggleSport(sp.value)}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[s.chipText, on && s.chipTextOn]}>{sp.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Section>

        <Section step={2} title="Where it is">
          <Text style={s.label}>Address</Text>
          <TextInput
            style={s.input}
            value={form.address}
            onChangeText={(v) => set('address', v)}
            placeholder="Street address"
            placeholderTextColor={COLORS.faint}
            editable={editable}
          />
          <View style={s.row}>
            <TextInput
              style={[s.input, { flex: 2 }]}
              value={form.city}
              onChangeText={(v) => set('city', v)}
              placeholder="City"
              placeholderTextColor={COLORS.faint}
              editable={editable}
            />
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={form.state}
              onChangeText={(v) => set('state', v)}
              placeholder="State"
              placeholderTextColor={COLORS.faint}
              autoCapitalize="characters"
              maxLength={2}
              editable={editable}
            />
          </View>

          <View style={[s.rowBetween, s.gapSmall]}>
            <Text style={[s.label, { marginBottom: 0 }]}>Location pin</Text>
            {editable ? (
              <TouchableOpacity onPress={useMyLocation} style={s.linkBtn}>
                <Ionicons name="locate" size={15} color={COLORS.primary} />
                <Text style={s.linkText}>Use my location</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={s.hint}>Press and hold the map to place the pin on the field's entrance.</Text>
          <View style={s.mapWrap}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              mapType={mapSatellite ? 'hybrid' : 'standard'}
              customMapStyle={mapSatellite ? undefined : DARK_MAP}
              initialRegion={{ ...center, latitudeDelta: pin ? 0.01 : 0.12, longitudeDelta: pin ? 0.01 : 0.12 }}
              onLongPress={(e) => editable && setForm((f) => ({ ...f, ...e.nativeEvent.coordinate }))}
            >
              {pin ? (
                <Marker
                  coordinate={pin}
                  draggable={editable}
                  onDragEnd={(e) => setForm((f) => ({ ...f, ...e.nativeEvent.coordinate }))}
                />
              ) : null}
            </MapView>
            <MapTypeToggle satellite={mapSatellite} onChange={setMapSatellite} style={{ top: 10, right: 10 }} />
          </View>
        </Section>

        <Section step={3} title="Price and booking">
          <View style={s.toggleRow}>
            <Text style={s.toggleText}>Free to use</Text>
            <Switch
              value={form.is_free}
              onValueChange={(v) => editable && set('is_free', v)}
              trackColor={{ true: COLORS.primary, false: COLORS.neutral300 }}
              thumbColor={COLORS.white}
            />
          </View>
          {!form.is_free ? (
            <View style={s.priceRow}>
              <Text style={s.dollar}>$</Text>
              <TextInput
                style={[s.input, s.priceInput]}
                value={form.hourly_rate}
                onChangeText={(v) => set('hourly_rate', v.replace(/[^0-9.]/g, ''))}
                placeholder="40"
                placeholderTextColor={COLORS.faint}
                keyboardType="decimal-pad"
                editable={editable}
              />
              <Text style={s.perHour}>per hour</Text>
            </View>
          ) : null}

          <Text style={[s.label, s.gap]}>When can people book it?</Text>
          <TextInput
            style={[s.input, s.multi]}
            value={form.availability}
            onChangeText={(v) => set('availability', v)}
            placeholder="Weekdays 5 to 11 PM, weekends 8 AM to 9 PM"
            placeholderTextColor={COLORS.faint}
            multiline
            editable={editable}
          />
        </Section>

        <Section step={4} title="Details and photos">
          <Text style={s.label}>Details players ask about</Text>
          <TextInput style={s.input} value={form.surface} onChangeText={(v) => set('surface', v)} placeholder="Surface, e.g. natural grass" placeholderTextColor={COLORS.faint} editable={editable} />
          <TextInput style={s.input} value={form.lights_until} onChangeText={(v) => set('lights_until', v)} placeholder="Lights until, e.g. 11 PM" placeholderTextColor={COLORS.faint} editable={editable} />
          <TextInput style={s.input} value={form.parking} onChangeText={(v) => set('parking', v)} placeholder="Parking, e.g. free lot by the entrance" placeholderTextColor={COLORS.faint} editable={editable} />
          <TextInput style={[s.input, s.multi]} value={form.rules} onChangeText={(v) => set('rules', v)} placeholder="Field rules, e.g. no metal cleats, no pets" placeholderTextColor={COLORS.faint} multiline editable={editable} />

          <View style={[s.rowBetween, s.gapSmall]}>
            <Text style={[s.label, { marginBottom: 0 }]}>Photos</Text>
            <View style={s.countBadge}>
              <Text style={s.countText}>{form.photos.length} of {MAX_PHOTOS}</Text>
            </View>
          </View>
          <Text style={s.hint}>Show the whole field first. Players see these before they book.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
            {form.photos.map((url, i) => (
              <View key={url}>
                <Image source={{ uri: url }} style={s.photo} />
                {i === 0 ? <Text style={s.coverTag}>Cover</Text> : null}
                {editable ? (
                  <TouchableOpacity style={s.removePhoto} onPress={() => removePhoto(url)} accessibilityLabel="Remove photo">
                    <Ionicons name="close" size={14} color={COLORS.snow} />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            {editable && form.photos.length < MAX_PHOTOS ? (
              <TouchableOpacity style={[s.photo, s.addPhoto]} onPress={addPhotos} disabled={uploading}>
                {uploading ? <ActivityIndicator color={COLORS.primary} /> : <Ionicons name="add" size={28} color={COLORS.primary} />}
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </Section>

        <Section step={5} title="Proof you own or manage it">
          <Text style={s.hint}>A photo of a permit, lease, fee sheet or utility bill with the venue's name. Only Grassroots admins see this.</Text>
          <TouchableOpacity style={[s.proofBtn, form.proof_path && s.proofBtnDone]} onPress={editable ? addProof : undefined} disabled={uploading || !editable}>
            <Ionicons
              name={form.proof_path ? 'checkmark-circle' : 'document-attach-outline'}
              size={20}
              color={COLORS.primary}
            />
            <Text style={s.proofText}>{form.proof_path ? 'Proof added. Tap to replace' : 'Add proof'}</Text>
          </TouchableOpacity>
        </Section>

        {editable ? (
          <>
            <View style={[s.ready, missing.length > 0 ? s.readyTodo : s.readyDone]}>
              <Ionicons
                name={missing.length > 0 ? 'list-outline' : 'checkmark-circle'}
                size={17}
                color={missing.length > 0 ? COLORS.clay : COLORS.forest}
              />
              <Text style={[s.readyText, { color: missing.length > 0 ? COLORS.clay : COLORS.forest }]}>
                {missing.length > 0 ? `To submit, add ${missing.join(', ')}.` : 'Ready to submit.'}
              </Text>
            </View>
            <TouchableOpacity
              style={[s.cta, (saving || uploading) && { opacity: 0.6 }]}
              onPress={() => save('submitted')}
              disabled={saving || uploading}
            >
              {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={s.ctaText}>Submit for review</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} onPress={() => save('draft')} disabled={saving || uploading}>
              <Text style={s.secondaryText}>Save draft</Text>
            </TouchableOpacity>
            {form.submission_id && form.status === 'draft' ? (
              <TouchableOpacity style={s.deleteBtn} onPress={deleteDraft}>
                <Text style={s.deleteText}>Delete draft</Text>
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* A numbered section with a heading, the same as Create Game. */
function Section({ step, title, children }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={s.stepDot}>
          <Text style={s.stepText}>{step}</Text>
        </View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

function StatusPill({ status }) {
  return (
    <View style={[s.pill, { backgroundColor: status.bg }]}>
      <Text style={[s.pillText, { color: status.fg }]}>{status.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  content: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  back: { marginBottom: 10, width: 44, height: 44, justifyContent: 'center' },
  title: { color: COLORS.snow, fontFamily: FONTS.display, fontSize: 32, marginBottom: 8 },

  hero: { backgroundColor: COLORS.forest, borderRadius: 22, padding: 20, marginTop: 8 },
  heroTitle: { color: COLORS.white, fontFamily: FONTS.displaySemi, fontSize: 21 },
  heroBody: { color: CREAM_SOFT, fontSize: 14, lineHeight: 20, marginTop: 6 },
  heroBtn: {
    marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.white, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11,
  },
  heroBtnText: { color: COLORS.forest, fontSize: 15, fontWeight: '800' },

  listHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 12 },
  listTitle: { color: COLORS.snow, fontFamily: FONTS.displaySemi, fontSize: 20 },
  countBadge: { backgroundColor: COLORS.sage, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 3 },
  countText: { color: COLORS.forest, fontSize: 12, fontWeight: '800' },

  venueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10,
    borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.cardFill,
  },
  thumb: { width: 60, height: 60, borderRadius: 14 },
  thumbEmpty: { backgroundColor: COLORS.neutral100, alignItems: 'center', justifyContent: 'center' },
  venueName: { color: COLORS.snow, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  rowNote: { marginTop: 8, backgroundColor: COLORS.clayLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  rowNoteText: { color: COLORS.snow, fontSize: 12.5, lineHeight: 17 },

  pill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },

  noteBox: {
    flexDirection: 'row', gap: 10, marginTop: 16, padding: 14, borderRadius: 16,
    backgroundColor: COLORS.clayLight, borderWidth: 1, borderColor: 'rgba(185,68,27,0.3)',
  },
  noteBoxText: { color: COLORS.snow, flex: 1, fontSize: 14, lineHeight: 20 },
  lockBox: {
    flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 16, padding: 14,
    borderRadius: 16, backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  lockText: { color: COLORS.mute, flex: 1, fontSize: 13, lineHeight: 18 },

  section: { marginTop: 22 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
  },
  stepText: { color: COLORS.white, fontSize: 12.5, fontWeight: '800' },
  sectionTitle: { flex: 1, fontFamily: FONTS.displaySemi, fontSize: 20, color: COLORS.snow },
  sectionCard: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: COLORS.line,
  },

  label: { color: COLORS.snow, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  gap: { marginTop: 14 },
  gapSmall: { marginTop: 10, marginBottom: 6 },
  hint: { color: COLORS.mute, fontSize: 12.5, lineHeight: 17, marginBottom: 10 },
  input: {
    color: COLORS.snow, backgroundColor: COLORS.ink, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 8,
  },
  multi: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.snow, fontSize: 13.5, fontWeight: '600' },
  chipTextOn: { color: COLORS.white, fontWeight: '800' },

  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingLeft: 10 },
  linkText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  mapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 14, backgroundColor: COLORS.ink, borderWidth: 1, borderColor: COLORS.line,
  },
  toggleText: { color: COLORS.snow, fontSize: 15 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dollar: { color: COLORS.snow, fontFamily: FONTS.displaySemi, fontSize: 22 },
  priceInput: { width: 110, marginBottom: 0 },
  perHour: { color: COLORS.mute, fontSize: 15 },

  photoRow: { gap: 10, paddingVertical: 4 },
  photo: { width: 110, height: 82, borderRadius: 14 },
  addPhoto: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, backgroundColor: COLORS.paleGreen,
    alignItems: 'center', justifyContent: 'center',
  },
  coverTag: {
    position: 'absolute', left: 6, bottom: 6, backgroundColor: COLORS.forest, color: COLORS.white,
    fontSize: 11, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  removePhoto: {
    position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,253,248,0.85)', alignItems: 'center', justifyContent: 'center',
  },

  proofBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, backgroundColor: COLORS.paleGreen,
  },
  proofBtnDone: { borderStyle: 'solid', borderWidth: 1, borderColor: COLORS.sage, backgroundColor: COLORS.sage },
  proofText: { color: COLORS.forest, fontSize: 15, fontWeight: '700' },

  ready: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 26,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
  },
  readyTodo: { backgroundColor: COLORS.clayLight },
  readyDone: { backgroundColor: COLORS.sage },
  readyText: { flex: 1, fontSize: 13.5, lineHeight: 19, fontWeight: '700' },
  cta: {
    marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 16, minHeight: 54,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  ctaText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  secondary: {
    marginTop: 10, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 16, minHeight: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },
  deleteBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  deleteText: { color: COLORS.danger, fontWeight: '700' },
});
