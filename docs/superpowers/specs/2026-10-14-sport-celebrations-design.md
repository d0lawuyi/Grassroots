# Sport celebrations: design

Date: 2026-10-14
Status: approved in conversation, waiting for spec review

## Goal

Make posting or joining a game feel rewarding. Right after either action, a short animated
scene for that game's sport plays, with a sound and a small vibration, then gets out of the way.

**Success looks like:** the celebration plays every time (unless turned off), never blocks or
delays saving, can be skipped with one tap, and respects the phone's silent switch and
Reduce Motion setting.

## What the user asked for (stated)

- A celebration when someone completes creating a game, per sport:
  - Soccer: a goal is scored, and a little ref's whistle.
  - Basketball: a 3-pointer swish, with a sound effect.
  - Flag football: a field goal, and a mini ref comes on the field signalling good.
  - Track: a runner crosses the screen with dust behind their feet.
- It also plays when joining a game, as the same scene but shorter.
- Ultimate gets a scene: a disc caught in the end zone.
- Sound follows the silent switch, with a Profile switch to turn sounds off.
- A Profile switch to turn the animations off.
- Built as shapes drawn in code (option A), not Lottie files or videos.

## Assumptions (mine, agreed in conversation)

- About 2.5 seconds after posting, 1.2 seconds after joining. Tap anywhere skips.
- Sounds are generated in code (no downloaded clips), so there are no licensing questions.
- Settings are saved on the phone, not in the database.

## 1. When it plays and what you see

| Moment | Caption | Sub-line | Length | Afterwards |
|---|---|---|---|---|
| Posted a one-off game | **Game on!** | game title · day and time | 2.5 s | Create Game closes (as today) |
| Posted a weekly game | **Weekly game on!** | game title · "Every Thursday, 6 PM" | 2.5 s | Create Game closes |
| Joined a game | **You're in!** | game title · day and time | 1.2 s | stays on the game page, now showing "You are in" |

- Full-screen overlay: cream background with a light blur, the scene in the middle,
  the caption under it in Fraunces, the sub-line under that in the body font.
- The game is already saved before the overlay appears. The overlay never changes data.
- **Tap anywhere** ends it immediately and runs the "afterwards" step.
- **Reduce Motion** (the phone's accessibility setting) on: no movement. Shows the scene's
  final frame and the caption for 1 second, then continues. No sound; the vibration still plays.
- **Unknown sport** (any added later): a confetti burst in Clubhouse colors, same captions.
- **Animations turned off in Profile:** no overlay. Posting shows the old "Your game is live"
  alert; joining just updates the page.

## 2. The scenes

A stage of 320 × 220 points, centered. Flat Clubhouse colors: forest `#17442F`, clay `#B9441B`,
sage `#D5E2D0`, cream `#F4F0E6`, ink `#172019`. Figures are simple: a round head and a body,
no faces, no team colors or logos.

Each scene receives one animated value, `progress`, going from 0 to 1 over the length of the
celebration, and positions everything from it. The join version is the same scene with
`progress` running over 1.2 s instead of 2.5 s.

| Sport | Timeline (fractions of `progress`) | Big moment | Sound cues |
|---|---|---|---|
| Soccer | 0–0.55 ball arcs from the left into the goal; 0.55–0.7 net bulges; 0.6–1 ref at the side raises a whistle | 0.55 net bulges | whistle at 0.58 |
| Basketball | 0–0.6 ball arcs from the 3-point line; 0.6–0.75 drops through, net ripples; 0.7–1 "+3" pops and floats up | 0.62 swish | swish at 0.6 |
| Flag football | 0–0.1 kick; 0.1–0.6 ball flips end over end between the uprights; 0.55–1 mini ref jogs on and raises both arms, "Good!" | 0.75 arms up | thump at 0.08, cheer at 0.75 |
| Track | 0–0.05 start; 0.05–0.9 runner sprints across, dust puffs spawn from the feet every 0.08 and fade; 0.85 finish tape snaps | 0.88 tape snaps | pistol at 0.02 |
| Ultimate | 0–0.65 spinning disc floats in on a gentle curve; 0.5–0.75 player leaps; 0.68 catch in the end zone | 0.68 catch | whoosh at 0.05 |
| Fallback | 0–1 confetti burst and fall | 0.15 burst | none |

## 3. Sound, vibration and settings

**Sounds:** five files in `assets/sounds/`: `whistle.wav`, `swish.wav`, `cheer.wav`,
`pistol.wav` and `whoosh.wav`. Each is under 1 second, mono, 22,050 Hz. The flag-football
"thump" is the start of `cheer.wav`, so there are five files rather than six.

- `scripts/make_sounds.py` generates them with Python's standard library only (sine tones,
  noise, envelopes) and writes the WAV files. Re-running it reproduces the same files
  (fixed random seed).
- Played with `expo-audio`. A sound is loaded the first time it's needed and then reused.
- Plays only when the phone isn't on silent (iOS: `playsInSilentMode: false`). On Android
  it plays at media volume.
- If a sound fails to load or play, the animation continues silently. Errors are logged, never shown.

**Vibration:** `expo-haptics`, one "success" notification vibration at the scene's big moment.
It plays on silent too (a vibration isn't a sound).

**Settings:** a new **Celebrations** section on Profile:

- **Celebration animations**, on by default. Off means no overlay, no sound, no vibration.
- **Celebration sounds**, on by default. Off means animation and vibration only.
  Greyed out while animations are off.

They're stored in AsyncStorage on the phone, under the keys
`grassroots.celebrations.animations` and `grassroots.celebrations.sounds`, so each phone
keeps its own choice. There are no database changes.

## 4. How the code is organized

```
src/utils/celebration.js              pure rules, no React (tested)
  sceneFor(sport)                      'soccer' | 'basketball' | 'flag_football' | 'track' | 'ultimate' | 'confetti'
  durationFor(mode)                    'created' -> 2500 ms, 'joined' -> 1200 ms
  cuesFor(scene)                       [{ at: 0.58, sound: 'whistle' }, { at: 0.55, haptic: true }, ...]
  captionFor(mode, isWeekly)           'Game on!' | 'Weekly game on!' | "You're in!"
  playbackFor({ animations, sounds, reduceMotion })
                                       { show, animate, sound, haptic }
src/lib/celebrationSettings.js        read and write the two AsyncStorage switches
src/lib/celebrationSound.js           load and play sounds with expo-audio; play the vibration
src/components/Celebration.js         the overlay: caption, tap to skip, timing, cues
src/components/celebrations/
  shapes.js                            shared pieces: Figure, Ball, Disc, DustPuff
  SoccerScene.js  BasketballScene.js  FlagFootballScene.js  TrackScene.js
  UltimateScene.js  ConfettiScene.js
assets/sounds/*.wav
scripts/make_sounds.py
scripts/check-celebration.mjs         Node tests for src/utils/celebration.js
scripts/test_make_sounds.py           Python tests for the generated sounds
```

**Changes to existing screens:**

- `CreateGameScreen.js`: after a successful insert, show `<Celebration mode="created">`
  (if animations are on) and call `onClose` when it ends. Otherwise keep the alert.
- `GameDetailsScreen.js`: after a successful join, show `<Celebration mode="joined">`
  (if animations are on).
- `ProfileScreen.js`: the Celebrations section with two switches.
- `package.json`: add `expo-audio` and `expo-haptics` (installed with `npx expo install`).

Animations use `react-native-reanimated` and `react-native-svg`, which are already installed.

## 5. Testing

**Automated (CI):**

- `node --test scripts/check-celebration.mjs`, added to the App bundles job:
  - every sport maps to its scene, and unknown or empty sports map to `confetti`;
  - durations are 2500 and 1200 ms;
  - every cue's `at` is between 0 and 1, every sound cue names an existing file, and each
    scene has exactly one vibration cue;
  - captions for created, weekly and joined;
  - `playbackFor` for each combination: animations off → nothing; sounds off → animation
    and vibration; Reduce Motion → no animation, no sound, vibration on.
- `python -m unittest scripts/test_make_sounds.py`, added to the Python job: each file
  is valid WAV, mono, 22,050 Hz, under 1 second, not silent (peak above 0.1), and not clipped
  (peak below 0.95).
- App bundles: the iOS and Android bundles still build.

**On the phone:** post and join a game in each of the five sports; tap to skip; phone on
silent; each Profile switch off; Reduce Motion on.

## Out of scope

- Different scenes for different skill levels or venues.
- Showing celebrations to other players (for example when someone else joins your game).
- Studio-recorded sounds (the generated files can be swapped later without code changes).
