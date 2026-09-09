import { useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const INK = '#070907';
const LIME = '#D7FF3E';
const SNOW = '#F4F6F2';
const MUTE = 'rgba(244,246,242,0.45)';
const LINE = 'rgba(244,246,242,0.10)';

/* ------------------------------------------------------------------ */
/*  PREVIEW 1 — map fragment with live game pin                        */
/* ------------------------------------------------------------------ */

function MapPreview() {
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
          <View style={s.pinHalo} />
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

/* ------------------------------------------------------------------ */
/*  PREVIEW 2 — cost split receipt                                     */
/* ------------------------------------------------------------------ */

function SplitPreview() {
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
        <Text style={s.recVal}>$60.00</Text>
      </View>
      <View style={s.recRow}>
        <Text style={s.recKey}>Players confirmed</Text>
        <Text style={s.recVal}>10</Text>
      </View>

      <View style={s.recRule} />

      <View style={s.recRow}>
        <Text style={s.recYouKey}>Your share</Text>
        <Text style={s.recYouVal}>$6.00</Text>
      </View>

      <View style={s.faces}>
        {['#D7FF3E', '#7DD3FC', '#FDBA74', '#F0ABFC', '#86EFAC'].map((c, i) => (
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

/* ------------------------------------------------------------------ */
/*  PREVIEW 3 — upcoming game / roster                                 */
/* ------------------------------------------------------------------ */

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
          ['#D7FF3E', 'You'],
          ['#7DD3FC', 'Marc'],
          ['#FDBA74', 'Dre'],
          ['#F0ABFC', 'Sam'],
        ].map(([c, n], i) => (
          <View key={i} style={s.rosterItem}>
            <View style={[s.rosterFace, { backgroundColor: c }]} />
            <Text style={s.rosterName}>{n}</Text>
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
/*  PREVIEW 4 — create a game                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  PREVIEW 5 — trust / player rating                                  */
/* ------------------------------------------------------------------ */

function TrustPreview() {
  return (
    <View style={s.card}>
      <View style={s.trustHead}>
        <View style={[s.trustFace, { backgroundColor: '#7DD3FC' }]} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.trustName}>Marcus D</Text>
          <Text style={s.trustMeta}>34 games · joined Mar 2025</Text>
        </View>
        <View style={s.trustScore}>
          <Ionicons name="star" size={13} color={LIME} />
          <Text style={s.trustScoreText}>4.9</Text>
        </View>
      </View>

      <View style={s.recRule} />

      {[
        ['checkmark-circle', 'Showed up on time', '32 of 34'],
        ['card', 'Paid before kickoff', 'always'],
        ['shield-checkmark', 'Verified account', 'yes'],
      ].map(([icon, label, val], i) => (
        <View key={i} style={s.trustRow}>
          <Ionicons name={icon} size={15} color={LIME} />
          <Text style={s.trustRowKey}>{label}</Text>
          <Text style={s.trustRowVal}>{val}</Text>
        </View>
      ))}

      <View style={s.quoteBox}>
        <Text style={s.quote}>
          Ran the whole 90 and sorted the cones after, solid guy
        </Text>
        <Text style={s.quoteBy}>— after Saturday Runs</Text>
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
    line2: 'you are playing',
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

function Slide({ item, index, scrollX }) {
  const input = [(index - 1) * width, index * width, (index + 1) * width];

  // text layer drags behind the swipe
  const textShift = scrollX.interpolate({
    inputRange: input,
    outputRange: [width * 0.32, 0, -width * 0.32],
    extrapolate: 'clamp',
  });

  // preview layer leads it, and tilts
  const cardShift = scrollX.interpolate({
    inputRange: input,
    outputRange: [width * 0.14, 0, -width * 0.14],
    extrapolate: 'clamp',
  });

  const cardTilt = scrollX.interpolate({
    inputRange: input,
    outputRange: ['7deg', '0deg', '-7deg'],
    extrapolate: 'clamp',
  });

  const cardScale = scrollX.interpolate({
    inputRange: input,
    outputRange: [0.88, 1, 0.88],
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
        <Preview />
      </Animated.View>

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

  const next = () => {
    if (isLast) onDone();
    else listRef.current?.scrollToOffset({ offset: (index + 1) * width });
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

      <Animated.FlatList
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
          <Slide item={item} index={i} scrollX={scrollX} />
        )}
      />

      <View style={s.footer}>
        <View style={s.counterRow}>
          <Text style={s.counter}>
            <Text style={s.counterNow}>0{index + 1}</Text>
            <Text style={s.counterAll}>  /  0{SLIDES.length}</Text>
          </Text>
          <View style={s.track}>
            {SLIDES.map((sl, i) => (
              <View
                key={sl.key}
                style={[s.trackSeg, i <= index && s.trackSegOn]}
              />
            ))}
          </View>
        </View>

        <Pressable
          onPress={next}
          style={({ pressed }) => [s.cta, pressed && s.ctaDown]}
        >
          <Text style={s.ctaText}>
            {isLast ? 'Find my first game' : 'Next'}
          </Text>
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

  /* top bar */
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

  /* slide shell */
  slide: {
    width,
    flex: 1,
    paddingHorizontal: 26,
    justifyContent: 'center',
  },
  copy: { marginTop: 34 },

  tagRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  tagBar: { width: 18, height: 2, backgroundColor: LIME, marginRight: 9 },
  tag: { color: LIME, fontSize: 10.5, fontWeight: '800', letterSpacing: 2.6 },

  display: {
    color: SNOW,
    fontSize: 43,
    fontWeight: '800',
    lineHeight: 45,
    letterSpacing: -1.6,
    marginBottom: 16,
  },
  displayAccent: { color: LIME },

  body: {
    color: MUTE,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: '90%',
    fontWeight: '500',
  },

  /* shared card */
  card: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    minHeight: 264,
  },

  /* map preview */
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
    backgroundColor: 'rgba(215,255,62,0.18)',
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

  /* split preview */
  receiptHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
    paddingVertical: 9,
  },
  recKey: { color: MUTE, fontSize: 14, fontWeight: '500' },
  recVal: { color: SNOW, fontSize: 14, fontWeight: '700' },
  recRule: { height: 1, backgroundColor: LINE, marginVertical: 9 },
  recYouKey: { color: SNOW, fontSize: 15, fontWeight: '700' },
  recYouVal: { color: LIME, fontSize: 25, fontWeight: '800', letterSpacing: -0.8 },

  faces: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  face: { width: 27, height: 27, borderRadius: 14, borderWidth: 2, borderColor: INK },
  faceMore: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceMoreText: { color: SNOW, fontSize: 10, fontWeight: '800' },
  facesNote: { color: MUTE, fontSize: 12, fontWeight: '600', marginLeft: 11 },

  /* squad preview */
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

  roster: { flexDirection: 'row', marginTop: 24, justifyContent: 'space-between' },
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

  /* create preview */
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
    marginTop: 18,
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

  postRow: { marginTop: 16 },
  postBtn: {
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(215,255,62,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: { color: LIME, fontSize: 13, fontWeight: '800' },

  /* trust preview */
  trustHead: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 6 },
  trustFace: { width: 44, height: 44, borderRadius: 22 },
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

  trustRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  trustRowKey: { color: SNOW, fontSize: 13.5, fontWeight: '600', marginLeft: 9, flex: 1 },
  trustRowVal: { color: MUTE, fontSize: 12.5, fontWeight: '600' },

  quoteBox: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: LIME,
  },
  quote: { color: SNOW, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  quoteBy: { color: MUTE, fontSize: 11, marginTop: 6, fontWeight: '600' },

  /* footer */
  footer: { paddingHorizontal: 26, paddingBottom: 42, paddingTop: 8 },
  counterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  counter: { width: 74 },
  counterNow: { color: SNOW, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  counterAll: { color: MUTE, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  track: { flex: 1, flexDirection: 'row', gap: 5 },
  trackSeg: { flex: 1, height: 2, backgroundColor: 'rgba(244,246,242,0.12)' },
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