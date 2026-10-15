import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  Alert, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from '../components/maps';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/fonts';

const CREAM_SOFT = 'rgba(255,253,248,0.72)';

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

/* Each decision is a coloured pill: text colour and pill colour. */
const DECIDED_LABEL = {
  approved: { text: 'Approved', fg: COLORS.white, bg: COLORS.forest },
  changes_requested: { text: 'Changes requested', fg: COLORS.clay, bg: COLORS.clayLight },
  rejected: { text: 'Rejected', fg: COLORS.danger, bg: 'rgba(180,35,24,0.10)' },
};

function Pill({ text, fg, bg }) {
  return (
    <View style={[s.statusPill, { backgroundColor: bg }]}>
      <Text style={[s.statusPillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

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
                  <View style={[s.thumb, s.thumbEmpty]}>
                    <Ionicons name="image-outline" size={20} color={COLORS.mute} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>
                    {item.owner_email} · {item.is_free ? 'Free' : `$${Number(item.hourly_rate).toFixed(0)}/hr`}
                  </Text>
                  {decided ? (
                    <Pill text={decided.text} fg={decided.fg} bg={decided.bg} />
                  ) : (
                    <Pill text={`Submitted ${daysAgo(item.submitted_at)}`} fg={COLORS.forest} bg={COLORS.sage} />
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
  const tone = flags > 0 ? COLORS.clay : warns > 0 ? COLORS.warning : COLORS.forest;
  const verdict = flags > 0 ? 'Needs a close look' : warns > 0 ? 'A few questions' : 'Looks clean';
  return (
    <View style={s.autoSummary}>
      <Text style={s.autoScore}>{precheck.score}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.autoTitle}>Automatic pre-check</Text>
        <View style={[s.statusPill, s.autoVerdict]}>
          <Text style={[s.statusPillText, { color: tone }]}>{verdict}</Text>
        </View>
        <Text style={s.autoHint}>
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
              mapType="hybrid" // satellite + street names: check the pin is really on a field
              initialRegion={{ latitude: item.latitude, longitude: item.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
              scrollEnabled={false}
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
                  <Ionicons name="checkmark" size={16} color={val.result === 'pass' ? COLORS.white : COLORS.snow} />
                  <Text style={[s.pillText, val.result === 'pass' && { color: COLORS.white }]}>Pass</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.pill, val.result === 'flag' && s.pillFlag]}
                  onPress={() => waiting && setCheck(c.key, { result: 'flag' })}
                  accessibilityState={{ selected: val.result === 'flag' }}
                >
                  <Ionicons name="flag-outline" size={15} color={val.result === 'flag' ? COLORS.white : COLORS.snow} />
                  <Text style={[s.pillText, val.result === 'flag' && { color: COLORS.white }]}>Flag</Text>
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
                <ActivityIndicator color={COLORS.white} />
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
            {DECIDED_LABEL[item.status] ? <Pill {...DECIDED_LABEL[item.status]} /> : null}
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
    color: COLORS.clay, backgroundColor: COLORS.clayLight, fontSize: 12, fontWeight: '800',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: 'hidden',
  },
  title: { color: COLORS.snow, fontFamily: FONTS.display, fontSize: 32, marginTop: 6 },

  tabs: {
    flexDirection: 'row', marginTop: 16, marginBottom: 16, borderRadius: 16, padding: 4,
    backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12 },
  tabOn: { backgroundColor: COLORS.forest },
  tabText: { color: COLORS.mute, fontWeight: '800' },
  tabTextOn: { color: COLORS.white },
  empty: { color: COLORS.mute, textAlign: 'center', padding: 24, lineHeight: 20 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10,
    borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.cardFill,
  },
  thumb: { width: 64, height: 64, borderRadius: 14 },
  thumbEmpty: { backgroundColor: COLORS.neutral100, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: COLORS.snow, fontSize: 16, fontWeight: '700' },
  rowSub: { color: COLORS.mute, fontSize: 13, marginTop: 2, marginBottom: 6 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 12, fontWeight: '800' },

  hero: { height: 210, borderRadius: 20, marginRight: 0 },
  hint: { color: COLORS.mute, fontSize: 12.5, lineHeight: 17, marginTop: 6 },
  facts: {
    marginTop: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line,
    backgroundColor: COLORS.cardFill, paddingHorizontal: 14,
  },
  fact: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  factLabel: { color: COLORS.mute, fontSize: 12, fontWeight: '600' },
  factValue: { color: COLORS.snow, fontSize: 15, marginTop: 2, lineHeight: 20 },
  mapWrap: { height: 160, borderRadius: 18, overflow: 'hidden', marginTop: 14, borderWidth: 1, borderColor: COLORS.line },

  section: { color: COLORS.snow, fontFamily: FONTS.displaySemi, fontSize: 20, marginTop: 28 },
  proof: {
    width: '100%', height: 260, borderRadius: 16, marginTop: 10,
    backgroundColor: COLORS.cardFill, borderWidth: 1, borderColor: COLORS.line,
  },

  check: { marginTop: 10, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.cardFill },
  checkFlag: { borderColor: 'rgba(185,68,27,0.45)', backgroundColor: COLORS.clayLight },
  checkTop: { flexDirection: 'row' },
  checkLabel: { color: COLORS.snow, fontSize: 16, fontWeight: '700' },
  autoRow: { flexDirection: 'row', gap: 7, marginTop: 9 },
  autoText: { flex: 1, color: COLORS.snow, fontSize: 13.5, lineHeight: 19 },
  autoSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12, padding: 18,
    borderRadius: 20, backgroundColor: COLORS.forest,
  },
  autoScore: { color: COLORS.white, fontFamily: FONTS.display, fontSize: 40 },
  autoTitle: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  autoVerdict: { backgroundColor: COLORS.white, marginTop: 6 },
  autoHint: { color: CREAM_SOFT, fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  checkHint: { color: COLORS.mute, fontSize: 13, marginTop: 2, lineHeight: 18 },
  checkBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16,
    borderRadius: 22, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.ink,
  },
  pillPass: { backgroundColor: COLORS.forest, borderColor: COLORS.forest },
  pillFlag: { backgroundColor: COLORS.clay, borderColor: COLORS.clay },
  pillText: { color: COLORS.snow, fontWeight: '800' },
  checkNote: {
    color: COLORS.snow, backgroundColor: COLORS.ink, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, padding: 12, marginTop: 10, fontSize: 14,
  },

  cta: { marginTop: 22, backgroundColor: COLORS.primary, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  ctaOff: { backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line },
  ctaText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  secondary: {
    marginTop: 10, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 16, minHeight: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },
  rejectBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 12 },
  rejectText: { color: COLORS.danger, fontWeight: '800' },
  decidedBox: {
    marginTop: 22, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: COLORS.line,
    backgroundColor: COLORS.cardFill, gap: 8,
  },
});
