# The Grassroots website

The same app, running in a browser at **https://d0lawuyi.github.io/Grassroots/**.
Every push to `main` that touches the app rebuilds and republishes it
(`.github/workflows/deploy-web.yml`), so a merged change is live in a few minutes.

## How the web version differs

| Phone part | On the web |
| --- | --- |
| Maps (`react-native-maps`) | `src/components/maps.web.js`: Leaflet with OpenStreetMap streets and Esri satellite photos. Long-press or right-click places a pin. |
| Date and time picker | `src/components/datePicker.web.js`: the browser's own date and time boxes. |
| `Alert.alert` pop-ups | `src/lib/webAlert.web.js`: the browser's alert and confirm boxes. |
| Game reminders | `src/lib/notifications.web.js`: none (browsers can't schedule them like a phone). |
| Haptics | Skipped. |

Expo picks a `.web.js` file over the plain `.js` file automatically when building for the web.
The API allows calls from the website through CORS (`services/calendar-feed/src/CalendarFeed/Config/WebsiteCors.cs`).

## One-time setup

1. **Settings > Pages > Build and deployment > Source:** GitHub Actions.
2. **Settings > Secrets and variables > Actions > Variables tab > New repository variable**, three times.
   Copy the values from the app's `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_...` key, never the secret key)
   - `EXPO_PUBLIC_CALENDAR_FEED_URL`

These values end up inside the website's JavaScript, where anyone can read them. That's fine for
the publishable key, because Supabase's row-level security decides what each user can do.

## Try it on your PC

```
npx expo start --web
```

This opens http://localhost:8081, which the API also allows.
