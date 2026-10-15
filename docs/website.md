# The Grassroots website

The same app, running in a browser and hosted on **Vercel**. Vercel watches the GitHub repo:
- every merge to `main` rebuilds and publishes the live site;
- every pull request gets its own preview address to try first.

Vercel reads `vercel.json` in this folder for how to build the site (`npx expo export --platform web`).
The iPhone app comes later, through EAS.

## How the web version differs

| Phone part | On the web |
| --- | --- |
| Maps (`react-native-maps`) | `src/components/maps.web.js`: Leaflet with OpenStreetMap streets and Esri satellite photos. Long-press or right-click places a pin. |
| Date and time picker | `src/components/datePicker.web.js`: the browser's own date and time boxes. |
| `Alert.alert` pop-ups | `src/lib/webAlert.web.js`: the browser's alert and confirm boxes. |
| Game reminders | `src/lib/notifications.web.js`: none (browsers can't schedule them like a phone). |
| Haptics | Skipped. |

Expo picks a `.web.js` file over the plain `.js` file automatically when building for the web.

The API lets only Grassroots pages call it from a browser (CORS). The allowed addresses are in
`services/calendar-feed/src/CalendarFeed/Config/WebsiteCors.cs`.

## One-time setup on Vercel

1. vercel.com → **Add New → Project** → import `d0lawuyi/Grassroots`.
2. Framework Preset: **Other**. Leave the build settings alone; `vercel.json` sets them.
3. **Environment Variables:** add these three, copying the values from the app's `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_...` key, never the secret key)
   - `EXPO_PUBLIC_CALENDAR_FEED_URL`
4. **Deploy.**

These values end up inside the website's JavaScript, where anyone can read them. That's fine for
the publishable key, because Supabase's row-level security decides what each user can do.

## Try it on your PC

```
npx expo start --web
```

This opens http://localhost:8081, which the API also allows.
