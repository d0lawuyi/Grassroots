import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  StatusBar,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const INK = '#070907';
const LIME = '#D7FF3E';
const SNOW = '#F4F6F2';
const MUTE = 'rgba(244,246,242,0.45)';
const LINE = 'rgba(244,246,242,0.10)';

const FACE_1 = 'rgba(244,246,242,0.30)';
const FACE_2 = 'rgba(244,246,242,0.22)';
const FACE_3 = 'rgba(244,246,242,0.16)';
const FACE_4 = 'rgba(244,246,242,0.11)';

/* Counts a number up from 0 to target while the slide is active. */
function useCountUp(target, active, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    const start = Date.now();
    const id = setInterval(() => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t >= 1) clearInterval(id);
    }, 32);

    return () => clearInterval(id);
  }, [active, target, duration]);

  return value;
}

/* ---------- PREVIEW 1 — map with pinging pin ---------- */

function MapPreview({ active }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.1] });
  const haloFade = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });

  return (
    <View style={s.card}>
      <View style={s.mapBed}>
        {[...Array(7)].map((_, i) => (
          <View key={`h${i}`} style={[s.gridH, { top: i * 26 }]} />
        ))}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} style={[s.gridV, { left: i * 44 }]} />
        ))}

        <View style={[s.park, { top: 28, left: 30, width: 74, height: 44 }]} />
        <View style={[s.park, { top: 96, left: 150, width: 58, height: 52 }]} />

        <View style={[s.pinDim, { top: 44, left: 52 }]} />
        <View style={[s.pinDim, { top: 118, left: 168 }]} />

        <View style={[s.pinLive, { top: 74, left: 108 }]}>
          <Animated.View
            style={[
              s.pinHalo,
              { opacity: haloFade, transform: [{ scale: haloScale }] },
            ]}
          />
          <View style={s.pinCore} />
        </View>
      </View>

      <View style={s.gameRow}>
        <View style={s.gameBadge}>
          <Text style={s.gameBadgeTop}>TUE</Text>
          <Text style={s.gameBadgeNum}>12</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.gameTitle}>Ellis Park · 7v7</Text>
          <Text style={s.gameMeta}>7:00 PM · 1.2 mi away</Text>
        </View>
        <View style={s.slots}>
          <Text style={s.slotsNum}>8</Text>
          <Text style={s.slotsDen}>/10</Text>
        </View>
      </View>
    </View>
  );
}

/* ---------- PREVIEW 2 — split receipt, numbers count up ---------- */

function SplitPreview({ active }) {
  const share = useCountUp(6, active, 1000);
  const total = useCountUp(60, active, 700);

  return (
    <View style={s.card}>
      <View style={s.receiptHead}>
        <Text style={s.receiptLabel}>FIELD RESERVATION</Text>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.livePillText}>SPLIT</Text>
        </View>
      </View>

      <View style={s.recRow}>
        <Text style={s.recKey}>Ellis Park · 90 min</Text>
        <Text style={s.recVal}>${total.toFixed(2)}</Text>
      </View>
      <View style={s.recRow}>
        <Text style={s.recKey}>Players confirmed</Text>
        <Text style={s.recVal}>10</Text>
      </View>

      <View style={s.recRule} />

      <View style={s.recRow}>
        <Text style={s.recYouKey}>Your share</Text>
        <Text style={s.recYouVal}>${share.toFixed(2)}</Text>
      </View>

      <View style={s.faces}>
        {[LIME, FACE_1, FACE_2, FACE_3, FACE_4].map((c, i) => (
          <View
            key={i}
            style={[s.face, { backgroundColor: c, marginLeft: i === 0 ? 0 : -11 }]}
          />
        ))}
        <View style={[s.face, s.faceMore, { marginLeft: -11 }]}>
          <Text style={s.faceMoreText}>+5</Text>
        </View>
        <Text style={s.facesNote}>all paid</Text>
      </View>
    </View>
  );
}

/* ---------- PREVIEW 3 — create a game ---------- */

function CreatePreview() {
  return (
    <View style={s.card}>
      <View style={s.squadHead}>
        <Text style={s.squadLabel}>NEW GAME</Text>
        <Text style={s.squadCount}>STEP 2 OF 2</Text>
      </View>

      <View style={s.fieldRow}>
        <Text style={s.fieldKey}>Park</Text>
        <Text style={s.fieldVal}>Ellis Park</Text>
      </View>
      <View style={s.fieldRow}>
        <Text style={s.fieldKey}>Kickoff</Text>
        <Text style={s.fieldVal}>Sat · 9:00 AM</Text>
      </View>
      <View style={s.fieldRow}>
        <Text style={s.fieldKey}>Format</Text>
        <Text style={s.fieldVal}>7v7</Text>
      </View>

      <Text style={s.sizeLabel}>SQUAD SIZE</Text>
      <View style={s.sizeRow}>
        {['8', '10', '12', '14'].map((n) => (
          <View key={n} style={[s.sizeBox, n === '10' && s.sizeBoxOn]}>
            <Text style={[s.sizeText, n === '10' && s.sizeTextOn]}>{n}</Text>
          </View>
        ))}
      </View>

      <View style={s.postRow}>
        <View style={s.postBtn}>
          <Text style={s.postBtnText}>Post to the map</Text>
        </View>
      </View>
    </View>
  );
}

/* ---------- PREVIEW 4 — trust record, bar sweeps out ---------- */

function TrustPreview({ active }) {
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      grow.setValue(0);
      return;
    }
    const anim = Animated.timing(grow, {
      toValue: 1,
      duration: 800,
      delay: 200,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [active, grow]);

  const barWidth = grow.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '94%'],
  });

  return (
    <View style={s.card}>
      <View style={s.trustHead}>
        <View style={s.trustFace}>
          <Text style={s.trustFaceText}>MD</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.trustName}>Marcus D</Text>
          <Text style={s.trustMeta}>34 games · joined Mar 2025</Text>
        </View>
        <View style={s.trustScore}>
          <Ionicons name="star" size={12} color={LIME} />
          <Text style={s.trustScoreText}>4.9</Text>
        </View>
      </View>

      <View style={s.trustBarTrack}>
        <Animated.View style={[s.trustBarFill, { width: barWidth }]} />
      </View>
      <Text style={s.trustBarNote}>Reliability across 34 games</Text>

      <View style={s.recRule} />

      {[
        ['checkmark-circle', 'Showed up on time', '32 of 34'],
        ['card', 'Paid before kickoff', 'always'],
        ['shield-checkmark', 'Verified account', 'yes'],
      ].map(([icon, label, val], i) => (
        <View key={i} style={s.trustRow}>
          <Ionicons name={icon} size={14} color={LIME} />
          <Text style={s.trustRowKey}>{label}</Text>
          <Text style={s.trustRowVal}>{val}</Text>
        </View>
      ))}
    </View>
  );
}

/* ---------- PREVIEW 5 — squad roster ---------- */

function SquadPreview() {
  return (
    <View style={s.card}>
      <View style={s.squadHead}>
        <Text style={s.squadLabel}>NEXT UP</Text>
        <Text style={s.squadCount}>IN 2 DAYS</Text>
      </View>

      <Text style={s.squadTitle}>Saturday Runs</Text>
      <Text style={s.squadSub}>Ellis Park · 9:00 AM · 7v7</Text>

      <View style={s.chipWrap}>
        <View style={s.chip}>
          <Ionicons name="chatbubble" size={11} color={INK} />
          <Text style={s.chipText}>Group chat</Text>
        </View>
        <View style={s.chipGhost}>
          <Ionicons name="navigate" size={11} color={SNOW} />
          <Text style={s.chipGhostText}>Directions</Text>
        </View>
      </View>

      <View style={s.roster}>
        {[
          [LIME, 'You', true],
          [FACE_1, 'Marc', false],
          [FACE_2, 'Dre', false],
          [FACE_3, 'Sam', false],
        ].map(([c, n, isYou], i) => (
          <View key={i} style={s.rosterItem}>
            <View style={[s.rosterFace, { backgroundColor: c }]} />
            <Text style={[s.rosterName, isYou && s.rosterNameYou]}>{n}</Text>
          </View>
        ))}
        <View style={s.rosterItem}>
          <View style={[s.rosterFace, s.rosterEmpty]}>
            <Ionicons name="add" size={14} color={MUTE} />
          </View>
          <Text style={s.rosterName}>2 open</Text>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const SLIDES = [
  {
    key: '1',
    tag: 'THE MAP',
    line1: 'Every game',
    line2: 'near you',
    accent: 'line2',
    body: 'See who is playing, where, and how many spots are left before you ever open the group chat',
    Preview: MapPreview,
  },
  {
    key: '2',
    tag: 'THE MONEY',
    line1: 'Nobody',
    line2: 'chases cash',
    accent: 'line2',
    body: 'The field fee splits itself across everyone who joins and lands with the park before kickoff',
    Preview: SplitPreview,
  },
  {
    key: '3',
    tag: 'YOUR CALL',
    line1: 'Or start',
    line2: 'your own run',
    accent: 'line2',
    body: 'Pick a park, set a time, choose your squad size and it goes live on the map for everyone nearby',
    Preview: CreatePreview,
  },
  {
    key: '4',
    tag: 'THE PEOPLE',
    line1: 'Know who',
    line2: 'shows up',
    accent: 'line1',
    body: 'Every player carries a record of games played, punctuality and payment so the pitch stays reliable',
    Preview: TrustPreview,
  },
  {
    key: '5',
    tag: 'THE SQUAD',
    line1: 'Your runs',
    line2: 'one place',
    accent: 'line1',
    body: 'Roster, chat, directions and kickoff time for the next game and nothing you do not need',
    Preview: SquadPreview,
  },
];

/* ------------------------------------------------------------------ */

function Slide({ item, index, scrollX, activeIndex }) {
  const input = [(index - 1) * width, index * width, (index + 1) * width];

  const textShift = scrollX.interpolate({
    inputRange: input,
    outputRange: [width * 0.3, 0, -width * 0.3],
    extrapolate: 'clamp',
  });

  const cardShift = scrollX.interpolate({
    inputRange: input,
    outputRange: [width * 0.13, 0, -width * 0.13],
    extrapolate: 'clamp',
  });

  const cardTilt = scrollX.interpolate({
    inputRange: input,
    outputRange: ['6deg', '0deg', '-6deg'],
    extrapolate: 'clamp',
  });

  const cardScale = scrollX.interpolate({
    inputRange: input,
    outputRange: [0.89, 1, 0.89],
    extrapolate: 'clamp',
  });

  const fade = scrollX.interpolate({
    inputRange: input,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const { Preview } = item;

  return (
    <View style={s.slide}>
      <View style={s.cardZone}>
        <Animated.View
          style={{
            opacity: fade,
            transform: [
              { translateX: cardShift },
              { scale: cardScale },
              { rotateZ: cardTilt },
            ],
          }}
        >
          <Preview active={activeIndex === index} />
        </Animated.View>
      </View>

      <Animated.View
        style={[s.copy, { opacity: fade, transform: [{ translateX: textShift }] }]}
      >
        <View style={s.tagRow}>
          <View style={s.tagBar} />
          <Text style={s.tag}>{item.tag}</Text>
        </View>

        <Text style={s.display}>
          <Text style={item.accent === 'line1' ? s.displayAccent : null}>
            {item.line1}
          </Text>
          {'\n'}
          <Text style={item.accent === 'line2' ? s.displayAccent : null}>
            {item.line2}
          </Text>
        </Text>

        <Text style={s.body}>{item.body}</Text>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

export default function Onboarding({ onDone }) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const goTo = (i) => {
    listRef.current?.scrollToOffset({ offset: i * width });
  };

  const next = () => {
    if (isLast) onDone();
    else goTo(index + 1);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      <View style={s.topbar}>
        <View style={s.brandRow}>
          <View style={s.brandMark} />
          <Text style={s.brand}>GRASSROOTS</Text>
        </View>
        <Pressable onPress={onDone} hitSlop={14}>
          <Text style={[s.skip, isLast && { opacity: 0 }]}>Skip</Text>
        </Pressable>
      </View>

      <AnimatedFlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(i) => i.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item, index: i }) => (
          <Slide item={item} index={i} scrollX={scrollX} activeIndex={index} />
        )}
      />

      <View style={s.footer}>
        <View style={s.track}>
          {SLIDES.map((sl, i) => (
            <Pressable key={sl.key} onPress={() => goTo(i)} hitSlop={10} style={s.trackTap}>
              <View style={[s.trackSeg, i <= index && s.trackSegOn]} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={next} style={({ pressed }) => [s.cta, pressed && s.ctaDown]}>
          <Text style={s.ctaText}>{isLast ? 'Find my first game' : 'Next'}</Text>
          <View style={s.ctaIcon}>
            <Ionicons name="arrow-forward" size={15} color={LIME} />
          </View>
        </Pressable>

        <Text style={s.fine}>Free to join · You only pay if the field does</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 62,
    paddingHorizontal: 26,
    paddingBottom: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: {
    width: 9,
    height: 9,
    backgroundColor: LIME,
    borderRadius: 2,
    marginRight: 9,
    transform: [{ rotate: '45deg' }],
  },
  brand: { color: SNOW, fontSize: 12, fontWeight: '800', letterSpacing: 3.4 },
  skip: { color: MUTE, fontSize: 14, fontWeight: '600' },

  slide: {
    width,
    flex: 1,
    paddingHorizontal: 26,
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  cardZone: { justifyContent: 'center', marginBottom: 30 },
  copy: {},

  tagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  tagBar: { width: 18, height: 2, backgroundColor: LIME, marginRight: 9 },
  tag: { color: LIME, fontSize: 10.5, fontWeight: '800', letterSpacing: 2.6 },

  display: {
    color: SNOW,
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 44,
    letterSpacing: -1.6,
    marginBottom: 15,
  },
  displayAccent: { color: LIME },

  body: {
    color: MUTE,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: '92%',
    fontWeight: '500',
  },

  card: {
    backgroundColor: 'rgba(244,246,242,0.045)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    minHeight: 258,
  },

  mapBed: {
    height: 176,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: LINE },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: LINE },
  park: {
    position: 'absolute',
    backgroundColor: 'rgba(215,255,62,0.07)',
    borderRadius: 6,
  },
  pinDim: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(244,246,242,0.28)',
  },
  pinLive: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  pinHalo: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: LIME,
  },
  pinCore: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: LIME,
    borderWidth: 2.5,
    borderColor: INK,
  },

  gameRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingHorizontal: 2 },
  gameBadge: {
    width: 42,
    height: 46,
    borderRadius: 11,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  gameBadgeTop: { color: INK, fontSize: 8.5, fontWeight: '800', letterSpacing: 1 },
  gameBadgeNum: { color: INK, fontSize: 18, fontWeight: '800', marginTop: -1 },
  gameTitle: { color: SNOW, fontSize: 15, fontWeight: '700' },
  gameMeta: { color: MUTE, fontSize: 12.5, marginTop: 3, fontWeight: '500' },
  slots: { flexDirection: 'row', alignItems: 'baseline' },
  slotsNum: { color: LIME, fontSize: 18, fontWeight: '800' },
  slotsDen: { color: MUTE, fontSize: 12, fontWeight: '700' },

  receiptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 4,
  },
  receiptLabel: { color: MUTE, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215,255,62,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: LIME, marginRight: 5 },
  livePillText: { color: LIME, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },

  recRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recKey: { color: MUTE, fontSize: 14, fontWeight: '500' },
  recVal: { color: SNOW, fontSize: 14, fontWeight: '700' },
  recRule: { height: 1, backgroundColor: LINE, marginVertical: 9 },
  recYouKey: { color: SNOW, fontSize: 15, fontWeight: '700' },
  recYouVal: { color: LIME, fontSize: 25, fontWeight: '800', letterSpacing: -0.8 },

  faces: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  face: { width: 27, height: 27, borderRadius: 14, borderWidth: 2, borderColor: INK },
  faceMore: {
    backgroundColor: 'rgba(244,246,242,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceMoreText: { color: MUTE, fontSize: 10, fontWeight: '800' },
  facesNote: { color: MUTE, fontSize: 12, fontWeight: '600', marginLeft: 11 },

  squadHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  squadLabel: { color: LIME, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  squadCount: { color: MUTE, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  squadTitle: { color: SNOW, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  squadSub: { color: MUTE, fontSize: 13.5, marginTop: 5, fontWeight: '500' },

  chipWrap: { flexDirection: 'row', marginTop: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LIME,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: { color: INK, fontSize: 12, fontWeight: '800', marginLeft: 5 },
  chipGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: LINE,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipGhostText: { color: SNOW, fontSize: 12, fontWeight: '700', marginLeft: 5 },

  roster: { flexDirection: 'row', marginTop: 22, justifyContent: 'space-between' },
  rosterItem: { alignItems: 'center' },
  rosterFace: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: LINE,
    borderStyle: 'dashed',
  },
  rosterName: { color: MUTE, fontSize: 11, marginTop: 7, fontWeight: '600' },
  rosterNameYou: { color: SNOW, fontWeight: '800' },

  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  fieldKey: { color: MUTE, fontSize: 13.5, fontWeight: '500' },
  fieldVal: { color: SNOW, fontSize: 13.5, fontWeight: '700' },

  sizeLabel: {
    color: MUTE,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 9,
  },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeBox: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBoxOn: { backgroundColor: LIME, borderColor: LIME },
  sizeText: { color: MUTE, fontSize: 14, fontWeight: '700' },
  sizeTextOn: { color: INK, fontWeight: '800' },

  postRow: { marginTop: 14 },
  postBtn: {
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(215,255,62,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: { color: LIME, fontSize: 13, fontWeight: '800' },

  trustHead: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 14 },
  trustFace: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(244,246,242,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustFaceText: { color: SNOW, fontSize: 13, fontWeight: '800' },
  trustName: { color: SNOW, fontSize: 16, fontWeight: '700' },
  trustMeta: { color: MUTE, fontSize: 12, marginTop: 3, fontWeight: '500' },
  trustScore: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215,255,62,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  trustScoreText: { color: LIME, fontSize: 13, fontWeight: '800', marginLeft: 4 },

  trustBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(244,246,242,0.10)',
    overflow: 'hidden',
  },
  trustBarFill: { height: '100%', borderRadius: 2, backgroundColor: LIME },
  trustBarNote: { color: MUTE, fontSize: 11, marginTop: 7, fontWeight: '600' },

  trustRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  trustRowKey: { color: SNOW, fontSize: 13.5, fontWeight: '600', marginLeft: 9, flex: 1 },
  trustRowVal: { color: MUTE, fontSize: 12.5, fontWeight: '600' },

  footer: { paddingHorizontal: 26, paddingBottom: 42, paddingTop: 14 },
  track: { flexDirection: 'row', marginBottom: 20, gap: 5 },
  trackTap: { flex: 1, paddingVertical: 6 },
  trackSeg: { height: 2, backgroundColor: 'rgba(244,246,242,0.12)' },
  trackSegOn: { backgroundColor: LIME },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: LIME,
    borderRadius: 15,
    paddingLeft: 24,
    paddingRight: 8,
    height: 58,
  },
  ctaDown: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaText: { color: INK, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  ctaIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fine: { color: 'rgba(244,246,242,0.28)', fontSize: 11.5, textAlign: 'center', marginTop: 15 },
});