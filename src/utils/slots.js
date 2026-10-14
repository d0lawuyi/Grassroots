/*
 * Time slots for the venue page: which start times on a day are open, and which are
 * taken by games already booked there. Plain functions with no React or Supabase, so
 * they're easy to check (see scripts/check-slots.mjs).
 *
 * "Open" means no Grassroots game is booked then. The venue's own hours are free text
 * today (venue.availability), so the owner still confirms the time when it's booked.
 */

export const FIRST_START_HOUR = 7; // 7 AM
export const DEFAULT_LAST_START_HOUR = 20; // 8 PM, when we don't know about lights
export const GAME_MINUTES = 90; // a typical pickup game, and Create Game's default

/* "9 PM", "9:30pm", "21:00", "21" -> hours as a number (21, 21.5). Null if unreadable. */
export function parseClock(text) {
  if (!text) return null;
  const m = String(text).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  const half = m[3]?.replace(/\./g, '');
  if (hour > 23 || minutes > 59) return null;
  if (half === 'pm' && hour < 12) hour += 12;
  if (half === 'am' && hour === 12) hour = 0;
  return hour + minutes / 60;
}

/*
 * The last hour a game can start so it ends before the lights go off.
 * Lights until 10 PM and 90-minute games -> last start 8 PM (8:30 rounds down to the hour).
 */
export function lastStartHour(venue) {
  const lightsOff = parseClock(venue?.lights_until);
  if (lightsOff == null || lightsOff <= FIRST_START_HOUR) return DEFAULT_LAST_START_HOUR;
  return Math.max(FIRST_START_HOUR, Math.floor(lightsOff - GAME_MINUTES / 60));
}

/* Today and the next six days, each at midnight local time. */
export function nextDays(now = new Date(), count = 7) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: count }, (_, i) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
  );
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/* A game's end: its end_time, or start + 90 minutes if it has none. */
export function gameEnd(game) {
  if (game.end_time) return new Date(game.end_time);
  return new Date(new Date(game.start_time).getTime() + GAME_MINUTES * 60000);
}

/* Games that overlap the given day, earliest first. */
export function gamesOnDay(games, day) {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return games
    .filter((g) => new Date(g.start_time) < dayEnd && gameEnd(g) > dayStart)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

/*
 * Start times (on the hour) on this day where a GAME_MINUTES game wouldn't clash with
 * a booked game, isn't in the past, and ends before the lights go off.
 */
export function openStartTimes(day, games, venue, now = new Date()) {
  const last = lastStartHour(venue);
  const times = [];
  for (let hour = FIRST_START_HOUR; hour <= last; hour += 1) {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
    const end = new Date(start.getTime() + GAME_MINUTES * 60000);
    if (start <= now) continue;
    const clash = games.some((g) => new Date(g.start_time) < end && gameEnd(g) > start);
    if (!clash) times.push(start);
  }
  return times;
}

/* "7 AM", "12 PM", "8:30 PM" */
export function clockLabel(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}
