# Grassroots

## Clubhouse look

Light cream, forest green and clay, with liquid-glass surfaces and a serif heading font.

### One-time setup
Install the heading font, then restart with a clear cache:

```
npx expo install @expo-google-fonts/fraunces
npx expo start -c
```

### Where the look lives
- `src/theme/colors.js`: the palette. Token names are kept from the old dark theme, so `ink` is the page background and `snow` is the main text.
- `src/theme/fonts.js`: heading font names. Body text uses the phone's own font.
- `src/theme/mapStyle.js`: the light map style (`MAP_STYLE`).
- `App.js`: loads the font and draws the floating glass tab bar.
- `src/screens/ExploreScreen.js`: photo-first venue cards and the venue page.

## Phase 1: verified venues (owner listing, admin approval)

Owners list a venue from Profile > List your venue. Admins approve it from
Profile > Review venues. Approved venues go live in Explore with a "Verified by
Grassroots" badge. Older parks keep working and show as not yet verified.

### One-time setup
1. In the Supabase dashboard, open SQL Editor > New query.
2. Paste all of `supabase/migrations/001_venue_marketplace.sql` and press Run.
3. Make yourself an admin: run the last line of that file with your sign-in email:
   `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`
4. Restart the app with `npx expo start -c`.

### Files
- `supabase/migrations/001_venue_marketplace.sql` (new): tables, security rules, storage buckets, admin functions.
- `src/screens/ListVenueScreen.js` (new): owner's venues list and listing form.
- `src/screens/AdminReviewScreen.js` (new): review queue, four checks, approve or request changes.
- `src/screens/ProfileScreen.js`: Venues section with the two entry points.
- `src/screens/ExploreScreen.js`: verified badge, verified venues first, venue details.
- `src/screens/CreateGameScreen.js`: keeps the venue selected when opened from a venue.
- `App.js`: opens the two new screens; passes the chosen venue into Create Game.

---

## Python tools (services/python)

Command-line tools that run next to the app: an OpenStreetMap import of public fields, an
automatic pre-check for venue submissions (shown on the admin review screen), and The Sideline
newsletter builder. Setup and a walkthrough are in `services/python/README.md`. They need
`supabase/migrations/003_python_tools.sql` run once in the SQL Editor.

## C# calendar feed (services/calendar-feed)

An ASP.NET Core service that gives each venue owner a private calendar link listing the games
booked at their venues. Needs `supabase/migrations/004_calendar_feeds.sql`. Setup in
`services/calendar-feed/README.md`.

## CI

Every pull request runs `.github/workflows/ci.yml`: app bundles for iOS and Android, the Python
tests on 3.11 to 3.14, all migrations plus the database security tests in `supabase/tests/`,
and the C# build and tests.

## Earlier: marketplace browsing UI

## Files
- `App.js` — opens Create Game with a preselected park when launched from Venue Details.
- `src/screens/ExploreScreen.js` — venue marketplace (search, sports, free/paid filters, map/list, venue details) + Games tab.
- `src/screens/LegacyExploreScreen.js` — your original Explore UI, preserved under Games.
- `src/screens/CreateGameScreen.js` — accepts the optional `initialParkId` prop.
- `src/lib/supabase.js` — configuration from environment variables, rather than a hardcoded project key.

## Install
1. BACK UP YOUR PROJECT. Unzip over the existing project root, maintaining directory paths.
2. Ensure `.env` supplies `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; do not commit it. Add `.env` and `.env.*` (except `.env.example`) to `.gitignore`.
3. Run `npx expo start -c`.

## Current behavior and limits
- Reads existing `parks` with `status = active`, `games`, `bookings`; no Supabase migrations required for the new browsing UI.
- **Active is NOT equivalent to owner-verified.** Listings are explicitly identified as legacy and unverified. Do not take payment or promise reservations from this UI.
- Existing venue `hourly_rate` is shown for browsing, but price/availability is not locked or confirmed.
- Creating games continues via the legacy insert flow. Backend venue authorization, price snapshots, real availability, payment state and collision-safe joining still need separate database migrations/RPCs.
- Real schema was not supplied, so no database changes are made.
- The old Games screen remains accessible as a tab, retaining map and recommendation behavior.
