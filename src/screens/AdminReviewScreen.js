import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  Alert, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { DARK_MAP } from '../theme/mapStyle';

const CHECKS = [
  { key: 'ownership', label: 'Ownership', hint: 'Does the proof name match the owner or their organization?' },
  { key: 'location', label: 'Location', hint: 'Is the pin on the field, and does it match the address?' },
  { key: 'pricing', label: 'Pricing', hint: 'Is the rate confirmed by the fee sheet, website or a call?' },
  { key: 'legitimacy', label: 'Legitimacy', hint: 'Are the photos real and of this venue, not stock images?' },
];

const FILTERS = [
  { key: 'submitted', label: 'Waiting' },
  { key: 'done', label: 'Decided' },
];

const DECIDED_LABEL = {
  approved: { text: 'Approved', color: COLORS.success },
  changes_requested: { text: 'Changes requested', color: COLORS.warning },
  rejected: { text: 'Rejected', color: COLORS.danger },
};

const sportName = (s) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function daysAgo(iso) {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <View style={s.fact}>
      <Text style={s.factLabel}>{label}</Text>
      <Text style={s.factValue}>{value}</Text>
    </View>
  );
}

export default function AdminReviewScreen({ onClose }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('submitted');
  const [open, setOpen] = useState(null);

  async function load() {
    const { data, error } = await supabase.rpc('admin_venue_queue');
    if (error) {
      Alert.alert('Could not load the review queue', error.message);
      return;
    }
    setQueue(data || []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  if (open) {
    return (
      <ReviewDetail
        submission={open}
        onBack={() => setOpen(null)}
        onDecided={async () => {
          setOpen(null);
          await load();
        }}
      />
    );
  }

  const waiting = queue.filter((q) => q.status === 'submitted');
  const shown = filter === 'submitted' ? waiting : queue.filter((q) => q.status !== 'submitted');

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={COLORS.primary}
            onRefresh={async () => {
              setRefreshing(true);
              try { await load(); } finally { setRefreshing(false); }
            }}
          />
        }
      >
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onClose} style={s.iconBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={COLORS.snow} />
          </TouchableOpacity>
          <Text style={s.adminTag}>Admin</Text>
        </View>
        <Text style={s.title}>Venue review</Text>

        <View style={s.tabs}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[s.tab, filter === f.key && s.tabOn]}
              onPress={() => setFilter(f.key)}
              accessibilityState={{ selected: filter === f.key }}
            >
              <Text style={[s.tabText, filter === f.key && s.tabTextOn]}>
                {f.label}{f.key === 'submitted' ? ` ${waiting.length}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.primary} />
        ) : shown.length === 0 ? (
          <Text style={s.empty}>
            {filter === 'submitted' ? 'Nothing waiting. New venues show up here when owners submit them.' : 'No decisions yet.'}
          </Text>
        ) : (
          shown.map((item) => {
            const decided = DECIDED_LABEL[item.status];
            return (
              <TouchableOpacity key={item.submission_id} style={s.row} onPress={() => setOpen(item)} activeOpacity={0.85}>
                {item.photos?.[0] ? (
                  <Image source={{ uri: item.photos[0] }} style={s.thumb} />
                ) : (
                  <View style={[s.thumb, s.thumbEmpty]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {item.owner_email} · {item.is_free ? 'Free' : `$${Number(item.hourly_rate).toFixed(0)}/hr`}
                  </Text>
                  {decided ? (
                    <Text style={[s.rowStatus, { color: decided.color }]}>{decided.text}</Text>
                  ) : (
                    <Text style={s.rowStatus}>Submitted {daysAgo(item.submitted_at)}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.mute} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

// How each automatic finding is marked
const AUTO_ICON = {
  flag: { icon: 'alert-circle', color: COLORS.danger },
  warn: { icon: 'help-circle', color: COLORS.warning },
  ok: { icon: 'checkmark-circle-outline', color: COLORS.success },
};

function PrecheckSummary({ precheck }) {
  if (!precheck) {
    return <Text style={s.hint}>No automatic pre-check yet. Run the Python precheck tool to add one.</Text>;
  }
  const flags = precheck.findings.filter((f) => f.level === 'flag').length;
  const warns = precheck.findings.filter((f) => f.level === 'warn').length;
  const tone = flags > 0 ? COLORS.danger : warns > 0 ? COLORS.warning : COLORS.success;
  return (
    <View style={[s.autoSummary, { borderColor: tone }]}>
      <Text style={[s.autoScore, { color: tone }]}>{precheck.score}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.autoTitle}>Automatic pre-check</Text>
        <Text style={s.checkHint}>
          {flags} {flags === 1 ? 'flag' : 'flags'}, {warns} {warns === 1 ? 'warning' : 'warnings'}. A guide only: you still decide each check.
        </Text>
      </View>
    </View>
  );
}

function ReviewDetail({ submission, onBack, onDecided }) {
  const item = submission;
  const waiting = item.status === 'submitted';
  const [checks, setChecks] = useState(() => {
    const start = {};
    CHECKS.forEach((c) => {
      start[c.key] = { result: item.checks?.[c.key]?.result || null, note: item.checks?.[c.key]?.note || '' };
    });
    return start;
  });
  const [note, setNote] = useState('');
  const [proofUrl, setProofUrl] = useState(null);
  const [proofError, setProofError] = useState('');
  const [busy, setBusy] = useState(false);
  // Automatic findings from the Python pre-check (services/python), if it has run
  const [precheck, setPrecheck] = useState(null);

  useEffect(() => {
    supabase
      .from('venue_prechecks')
      .select('score, findings, checked_at')
      .eq('submission_id', item.submission_id)
      .maybeSingle()
      .then(({ data }) => setPrecheck(data || null));
  }, []);

  useEffect(() => {
    async function loadProof() {
      if (!item.proof_path) return;
      const { data, error } = await supabase.storage.from('venue-proofs').createSignedUrl(item.proof_path, 600);
      if (error) setProofError(error.message);
      else setProofUrl(data.signedUrl);
    }
    loadProof();
  }, []);

  const setCheck = (key, patch) => setChecks((c) => ({ ...c, [key]: { ...c[key], ...patch } }));
  const allPass = CHECKS.every((c) => checks[c.key].result === 'pass');
  const unanswered = CHECKS.filter((c) => !checks[c.key].result).length;

  async function decide(decision) {
    if (decision !== 'approve' && !note.trim()) {
      Alert.alert('Add a note', 'Tell the owner what to fix. They see this note in the app.');
      return;
    }
    const payload = {};
    CHECKS.forEach((c) => {
      if (checks[c.key].result) payload[c.key] = { result: checks[c.key].result, note: checks[c.key].note || null };
    });

    setBusy(true);
    const { error } = await supabase.rpc('review_venue_submission', {
      p_submission_id: item.submission_id,
      p_decision: decision,
      p_note: note.trim() || null,
      p_checks: payload,
    });
    setBusy(false);

    if (error) {
      Alert.alert('Could not save the decision', error.message);
      return;
    }
    const done = {
      approve: `${item.name} is verified and now live in Explore.`,
      request_changes: 'The owner can see your note and resubmit.',
      reject: 'The owner has been told this venue was not approved.',
    };
    Alert.alert('Saved', done[decision]);
    onDecided();
  }

  function confirmReject() {
    Alert.alert('Reject this venue?', 'Use this for venues that are not real or not theirs. For fixable problems, request changes instead.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => decide('reject') },
    ]);
  }

  const width = Dimensions.get('window').width - 40;
  const hasPin = item.latitude != null && item.longitude != null;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} style={s.iconBtn} accessibilityLabel="Back to the queue">
          <Ionicons name="arrow-back" size={25} color={COLORS.snow} />
        </TouchableOpacity>

        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {(item.photos || []).map((url) => (
            <Image key={url} source={{ uri: url }} style={[s.hero, { width }]} />
          ))}
        </ScrollView>
        <Text style={s.hint}>{(item.photos || []).length} photos · swipe to see all</Text>

        <Text style={[s.title, { marginTop: 14 }]}>{item.name}</Text>
        <Text style={s.rowSub}>Submitted by {item.owner_email} {daysAgo(item.submitted_at)}</Text>

        <View style={s.facts}>
          <Fact label="Sports" value={(item.sports || []).map(sportName).join(', ')} />
          <Fact label="Price" value={item.is_free ? 'Free' : `$${Number(item.hourly_rate).toFixed(2)} per hour`} />
          <Fact label="Address" value={[item.address, item.city, item.state].filter(Boolean).join(', ')} />
          <Fact label="Availability" value={item.availability} />
          <Fact label="Surface" value={item.surface} />
          <Fact label="Lights until" value={item.lights_until} />
          <Fact label="Parking" value={item.parking} />
          <Fact label="Rules" value={item.rules} />
        </View>

        {hasPin ? (
          <View style={s.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              customMapStyle={DARK_MAP}
              initialRegion={{ latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker coordinate={{ latitude: item.latitude, longitude: item.longitude }} />
            </MapView>
          </View>
        ) : null}

        <Text style={s.section}>Proof of ownership</Text>
        {proofUrl ? (
          <Image source={{ uri: proofUrl }} style={s.proof} resizeMode="contain" />
        ) : (
          <Text style={s.hint}>{proofError ? `Could not open the proof: ${proofError}` : 'Loading…'}</Text>
        )}

        <Text style={s.section}>Checks</Text>
        <Text style={s.hint}>All four must pass to approve.</Text>
        <PrecheckSummary precheck={precheck} />
        {CHECKS.map((c) => {
          const val = checks[c.key];
          const auto = (precheck?.findings || []).filter((f) => f.check === c.key);
          return (
            <View key={c.key} style={[s.check, val.result === 'flag' && s.checkFlag]}>
              <View style={s.checkTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.checkLabel}>{c.label}</Text>
                  <Text style={s.checkHint}>{c.hint}</Text>
                </View>
              </View>
              {auto.map((f, i) => (
                <View key={i} style={s.autoRow}>
                  <Ionicons name={AUTO_ICON[f.level].icon} size={15} color={AUTO_ICON[f.level].color} style={{ marginTop: 2 }} />
                  <Text style={[s.autoText, f.level === 'ok' && { color: COLORS.mute }]}>{f.message}</Text>
                </View>
              ))}
              <View style={s.checkBtns}>
                <TouchableOpacity
                  style={[s.pill, val.result === 'pass' && s.pillPass]}
                  onPress={() => waiting && setCheck(c.key, { result: 'pass' })}
                  accessibilityState={{ selected: val.result === 'pass' }}
                >
                  <Ionicons name="checkmark" size={16} color={val.result === 'pass' ? COLORS.ink : COLORS.snow} />
                  <Text style={[s.pillText, val.result === 'pass' && { color: COLORS.ink }]}>Pass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.pill, val.result === 'flag' && s.pillFlag]}
                  onPress={() => waiting && setCheck(c.key, { result: 'flag' })}
                  accessibilityState={{ selected: val.result === 'flag' }}
                >
                  <Ionicons name="flag-outline" size={15} color={val.result === 'flag' ? COLORS.ink : COLORS.snow} />
                  <Text style={[s.pillText, val.result === 'flag' && { color: COLORS.ink }]}>Flag</Text>
                </TouchableOpacity>
              </View>
              {val.result === 'flag' || val.note ? (
                <TextInput
                  style={s.checkNote}
                  value={val.note}
                  onChangeText={(t) => setCheck(c.key, { note: t })}
                  placeholder="What's wrong? (for your records)"
                  placeholderTextColor={COLORS.faint}
                  editable={waiting}
                />
              ) : null}
            </View>
          );
        })}

        {waiting ? (
          <>
            <Text style={s.section}>Note to the owner</Text>
            <TextInput
              style={[s.checkNote, { minHeight: 80, textAlignVertical: 'top' }]}
              value={note}
              onChangeText={setNote}
              placeholder="Required when requesting changes or rejecting"
              placeholderTextColor={COLORS.faint}
              multiline
            />

            <TouchableOpacity
              style={[s.cta, (!allPass || busy) && s.ctaOff]}
              onPress={() => decide('approve')}
              disabled={!allPass || busy}
            >
              {busy ? (
                <ActivityIndicator color={COLORS.ink} />
              ) : (
                <Text style={[s.ctaText, !allPass && { color: COLORS.mute }]}>
                  {allPass ? 'Approve and publish' : unanswered > 0 ? `Answer ${unanswered} more ${unanswered === 1 ? 'check' : 'checks'}` : 'All checks must pass'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.secondary} onPress={() => decide('request_changes')} disabled={busy}>
              <Text style={s.secondaryText}>Request changes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.rejectBtn} onPress={confirmReject} disabled={busy}>
              <Text style={s.rejectText}>Reject</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={s.decidedBox}>
            <Text style={[s.rowStatus, { color: DECIDED_LABEL[item.status]?.color }]}>{DECIDED_LABEL[item.status]?.text}</Text>
            {item.admin_note ? <Text style={s.factValue}>{item.admin_note}</Text> : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ink },
  content: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, justifyContent: 'center' },
  adminTag: {
    color: COLORS.ink, backgroundColor: COLORS.primary, fontSize: 12, fontWeight: '900',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden',
  },
  title: { color: COLORS.snow, fontSize: 27, fontWeight: '800', marginTop: 8 },

  tabs: { flexDirection: 'row', marginTop: 16, marginBottom: 16, borderRadius: 14, backgroundColor: COLORS.inkRaised, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
  tabOn: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.mute, fontWeight: '800' },
  tabTextOn: { color: COLORS.ink },
  empty: { color: COLORS.mute, textAlign: 'center', padding: 24, lineHeight: 20 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.cardFill,
  },
  thumb: { width: 60, height: 60, borderRadius: 12 },
  thumbEmpty: { backgroundColor: COLORS.inkRaised },
  rowTitle: { color: COLORS.snow, fontSize: 16, fontWeight: '700' },
  rowSub: { color: COLORS.mute, fontSize: 13, marginTop: 2 },
  rowStatus: { color: COLORS.info, fontSize: 12, fontWeight: '700', marginTop: 3 },

  hero: { height: 210, borderRadius: 18, marginRight: 0 },
  hint: { color: COLORS.mute, fontSize: 12, lineHeight: 17, marginTop: 6 },
  facts: { marginTop: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, paddingHorizontal: 14 },
  fact: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  factLabel: { color: COLORS.mute, fontSize: 12 },
  factValue: { color: COLORS.snow, fontSize: 15, marginTop: 2, lineHeight: 20 },
  mapWrap: { height: 160, borderRadius: 16, overflow: 'hidden', marginTop: 14 },

  section: { color: COLORS.snow, fontSize: 18, fontWeight: '800', marginTop: 26 },
  proof: { width: '100%', height: 260, borderRadius: 14, marginTop: 10, backgroundColor: COLORS.inkRaised },

  check: { marginTop: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.cardFill },
  checkFlag: { borderColor: 'rgba(185,68,27,0.5)', backgroundColor: COLORS.coralLight },
  checkTop: { flexDirection: 'row' },
  checkLabel: { color: COLORS.snow, fontSize: 16, fontWeight: '700' },
  autoRow: { flexDirection: 'row', gap: 7, marginTop: 9 },
  autoText: { flex: 1, color: COLORS.snow, fontSize: 13.5, lineHeight: 19 },
  autoSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, padding: 14,
    borderRadius: 16, borderWidth: 1.5, backgroundColor: COLORS.cardFill,
  },
  autoScore: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  autoTitle: { color: COLORS.snow, fontSize: 15, fontWeight: '700' },
  checkHint: { color: COLORS.mute, fontSize: 13, marginTop: 2, lineHeight: 18 },
  checkBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.line,
  },
  pillPass: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  pillFlag: { backgroundColor: COLORS.warning, borderColor: COLORS.warning },
  pillText: { color: COLORS.snow, fontWeight: '800' },
  checkNote: {
    color: COLORS.snow, backgroundColor: COLORS.inkRaised, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, padding: 12, marginTop: 10, fontSize: 14,
  },

  cta: { marginTop: 22, backgroundColor: COLORS.primary, borderRadius: 15, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  ctaOff: { backgroundColor: COLORS.inkRaised, borderWidth: 1, borderColor: COLORS.line },
  ctaText: { color: COLORS.ink, fontWeight: '900', fontSize: 16 },
  secondary: { marginTop: 10, borderWidth: 1, borderColor: COLORS.line, borderRadius: 15, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: COLORS.snow, fontWeight: '800', fontSize: 15 },
  rejectBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  rejectText: { color: COLORS.danger, fontWeight: '800' },
  decidedBox: { marginTop: 22, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, gap: 6 },
});
