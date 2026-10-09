import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { DARK_MAP } from '../theme/mapStyle';

const SPORTS = [
  { label: 'Soccer', value: 'soccer' },
  { label: 'Basketball', value: 'basketball' },
  { label: 'Flag Football', value: 'flag_football' },
  { label: 'Track', value: 'track' },
  { label: 'Ultimate', value: 'ultimate' },
];

const MAX_PHOTOS = 6;

const STATUS = {
  draft:             { label: 'Draft',             color: COLORS.mute },
  submitted:         { label: 'Under review',      color: COLORS.info },
  changes_requested: { label: 'Changes requested', color: COLORS.warning },
  approved:          { label: 'Verified and live', color: COLORS.success },
  rejected:          { label: 'Not approved',      color: COLORS.danger },
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
          <Text style={s.lead}>
            List a field or court you own or manage. Once approved, players can book it and the rental is split between them.
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.primary} />
          ) : (
            mine.map((row) => {
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
                    <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                    {row.admin_note && (row.status === 'changes_requested' || row.status === 'rejected') ? (
                      <Text style={s.note} numberOfLines={2}>{row.admin_note}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.mute} />
                </TouchableOpacity>
              );
            })
          )}

          <TouchableOpacity style={s.cta} onPress={startNew}>
            <Ionicons name="add" size={20} color={COLORS.ink} />
            <Text style={s.ctaText}>List a venue</Text>
          </TouchableOpacity>
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
        <Text style={[s.statusText, { color: st.color, marginTop: 6 }]}>{st.label}</Text>

        {form.admin_note && !['draft', 'approved'].includes(form.status) ? (
          <View style={s.noteBox}>
            <Ionicons name="chatbox-ellipses-outline" size={20} color={COLORS.warning} />
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

        <Text style={s.label}>Sports played here</Text>
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

        <View style={s.rowBetween}>
          <Text style={s.label}>Location pin</Text>
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
            customMapStyle={DARK_MAP}
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
        </View>

        <Text style={s.label}>Price</Text>
        <View style={s.toggleRow}>
          <Text style={s.toggleText}>Free to use</Text>
          <Switch
            value={form.is_free}
            onValueChange={(v) => editable && set('is_free', v)}
            trackColor={{ true: COLORS.primary, false: COLORS.neutral300 }}
            thumbColor={COLORS.snow}
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

        <Text style={s.label}>When can people book it?</Text>
        <TextInput
          style={[s.input, s.multi]}
          value={form.availability}
          onChangeText={(v) => set('availability', v)}
          placeholder="Weekdays 5 to 11 PM, weekends 8 AM to 9 PM"
          placeholderTextColor={COLORS.faint}
          multiline
          editable={editable}
        />

        <Text style={s.label}>Details players ask about</Text>
        <TextInput style={s.input} value={form.surface} onChangeText={(v) => set('surface', v)} placeholder="Surface, e.g. natural grass" placeholderTextColor={COLORS.faint} editable={editable} />
        <TextInput style={s.input} value={form.lights_until} onChangeText={(v) => set('lights_until', v)} placeholder="Lights until, e.g. 11 PM" placeholderTextColor={COLORS.faint} editable={editable} />
        <TextInput style={s.input} value={form.parking} onChangeText={(v) => set('parking', v)} placeholder="Parking, e.g. free lot by the entrance" placeholderTextColor={COLORS.faint} editable={editable} />
        <TextInput style={[s.input, s.multi]} value={form.rules} onChangeText={(v) => set('rules', v)} placeholder="Field rules, e.g. no metal cleats, no pets" placeholderTextColor={COLORS.faint} multiline editable={editable} />

        <View style={s.rowBetween}>
          <Text style={s.label}>Photos</Text>
          <Text style={s.hint}>{form.photos.length} of {MAX_PHOTOS}</Text>
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

        <Text style={s.label}>Proof you own or manage it</Text>
        <Text style={s.hint}>A photo of a permit, lease, fee sheet or utility bill with the venue's name. Only Grassroots admins see this.</Text>
        <TouchableOpacity style={s.proofBtn} onPress={editable ? addProof : undefined} disabled={uploading || !editable}>
          <Ionicons
            name={form.proof_path ? 'checkmark-circle' : 'document-attach-outline'}
            size={20}
            color={form.proof_path ? COLORS.success : COLORS.primary}
          />
          <Text style={s.proofText}>{form.proof_path ? 'Proof added. Tap to replace' : 'Add proof'}</Text>
        </TouchableOpacity>

        {editable ? (
          <>
            {missing.length > 0 ? (
              <Text style={s.missing}>To submit, add {missing.join(', ')}.</Text>
            ) : (
              <Text style={[s.missing, { color: COLORS.success }]}>Ready to submit.</Text>
            )}
            <TouchableOpacity
              style={[s.cta, (saving || uploading) && { opacity: 0.6 }]}
              onPress={() => save('submitted')}
              disabled={saving || uploading}
            >
              {saving ? <ActivityIndicator color={COLORS.ink} /> : <Text style={s.ctaText}>Submit for review</Text>}
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  content: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  back: { marginBottom: 18, width: 44, height: 44, justifyContent: 'center' },
  title: { color: COLORS.snow, fontSize: 27, fontWeight: '800' },
  lead: { color: COLORS.mute, fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 20 },

  venueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.cardFill,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbEmpty: { backgroundColor: COLORS.inkRaised, alignItems: 'center', justifyContent: 'center' },
  venueName: { color: COLORS.snow, fontSize: 16, fontWeight: '700' },
  statusText: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  note: { color: COLORS.mute, fontSize: 12, marginTop: 4 },

  noteBox: {
    flexDirection: 'row', gap: 10, marginTop: 16, padding: 14, borderRadius: 14,
    backgroundColor: COLORS.coralLight, borderWidth: 1, borderColor: 'rgba(253,186,116,0.3)',
  },
  noteBoxText: { color: COLORS.snow, flex: 1, fontSize: 14, lineHeight: 20 },
  lockBox: {
    flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 16, padding: 14,
    borderRadius: 14, backgroundColor: COLORS.inkRaised, borderWidth: 1, borderColor: COLORS.line,
  },
  lockText: { color: COLORS.mute, flex: 1, fontSize: 13, lineHeight: 18 },

  label: { color: COLORS.snow, fontSize: 15, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  hint: { color: COLORS.mute, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  input: {
    color: COLORS.snow, backgroundColor: COLORS.inkRaised, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 13, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 8,
  },
  multi: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: COLORS.line },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.snow, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: COLORS.ink },

  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, paddingLeft: 10, marginTop: 14 },
  linkText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  mapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.line },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 13, backgroundColor: COLORS.inkRaised, borderWidth: 1, borderColor: COLORS.line,
  },
  toggleText: { color: COLORS.snow, fontSize: 15 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dollar: { color: COLORS.snow, fontSize: 20, fontWeight: '700' },
  priceInput: { width: 110, marginBottom: 0 },
  perHour: { color: COLORS.mute, fontSize: 15 },

  photoRow: { gap: 10, paddingVertical: 4 },
  photo: { width: 110, height: 82, borderRadius: 12 },
  addPhoto: { borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  coverTag: {
    position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(7,9,7,0.75)', color: COLORS.snow,
    fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: 'hidden',
  },
  removePhoto: {
    position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(7,9,7,0.75)', alignItems: 'center', justifyContent: 'center',
  },

  proofBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderRadius: 13,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.inkRaised,
  },
  proofText: { color: COLORS.snow, fontSize: 15, fontWeight: '600' },

  missing: { color: COLORS.mute, fontSize: 13, lineHeight: 18, marginTop: 26 },
  cta: {
    marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 15, minHeight: 54,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8,
  },
  ctaText: { color: COLORS.ink, fontWeight: '900', fontSize: 16 },
  secondary: { marginTop: 10, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: COLORS.snow, fontWeight: '800', fontSize: 15 },
  deleteBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 10 },
  deleteText: { color: COLORS.danger, fontWeight: '700' },
});
