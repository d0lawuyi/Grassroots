/*
 * Small helpers for Messages and the game chat. No React, so scripts/check-chat.mjs can test them.
 */

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* The divider between days in a chat: "Today", "Yesterday" or "Tue, Oct 13" (phone's time zone). */
export function dayLabel(isoString, now = new Date()) {
  const d = new Date(isoString);
  if (sameDay(d, now)) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/* True when `message` is the first one, or the first on a new day after `prev`. */
export function startsNewDay(prev, message) {
  if (!prev) return true;
  return !sameDay(new Date(prev.sent_at), new Date(message.sent_at));
}

/* The pill on each chat row: soon (within 24 hours), later, or played. */
export function kickoffPill(startTime, now = new Date()) {
  if (!startTime) return null;
  const ms = new Date(startTime).getTime() - now.getTime();
  if (ms < 0) return { text: 'Played', tone: 'past' };
  const hours = ms / 3600000;
  if (hours < 1) return { text: `In ${Math.max(Math.round(ms / 60000), 1)} min`, tone: 'soon' };
  if (hours < 24) {
    const h = Math.round(hours);
    return { text: `In ${h} ${h === 1 ? 'hour' : 'hours'}`, tone: 'soon' };
  }
  const days = Math.round(hours / 24);
  return { text: `In ${days} ${days === 1 ? 'day' : 'days'}`, tone: 'later' };
}

/* Same icons as the sport chips on Create Game. */
const ICONS = {
  soccer: 'football-outline',
  basketball: 'basketball-outline',
  flag_football: 'american-football-outline',
  track: 'stopwatch-outline',
  ultimate: 'disc-outline',
};
export const sportIcon = (sport) => ICONS[sport] || 'people-outline';

/* "Ana Lopez" -> "AL", "Mo" -> "M", nothing -> "?" */
export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}
