/*
 * Small helpers for the My Games cards. No React, so scripts/check-my-games.mjs can test them.
 */

const DEFAULT_MAX = 10; // the app's default roster size when a game has none set

/* [{ game_id }] booking rows -> { game_id: how many joined } */
export function countPlayers(rows) {
  const counts = {};
  for (const r of rows || []) counts[r.game_id] = (counts[r.game_id] || 0) + 1;
  return counts;
}

/* A sorted copy, earliest start first. */
export function soonestFirst(games) {
  return [...games].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

export function fillLabel(joined, max) {
  const cap = max || DEFAULT_MAX;
  return joined >= cap ? `Full · ${cap} players` : `${joined} of ${cap} players`;
}

export function fillFraction(joined, max) {
  if (!max) return 0;
  return Math.min(joined / max, 1);
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/* The little calendar square on each card: { weekday: 'THU', day: '16' } in the phone's time zone. */
export function calendarTile(isoString) {
  const d = new Date(isoString);
  return { weekday: WEEKDAYS[d.getDay()], day: String(d.getDate()) };
}
