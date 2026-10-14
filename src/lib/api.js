import { supabase } from './supabase';

/*
 * The Grassroots API (services/calendar-feed, running on AWS Lambda). Same address as the
 * calendar feed, so EXPO_PUBLIC_CALENDAR_FEED_URL in .env is all it needs.
 * EXPO_PUBLIC_API_URL overrides it if the API ever moves somewhere else.
 */
const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_CALENDAR_FEED_URL ||
  ''
).replace(/\/+$/, '');

export const apiAvailable = API_BASE.length > 0;

/* Sends a request as the signed-in user. Throws an Error with the API's own message. */
async function call(method, path, body) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sign in again and retry.');

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No connection. Check your internet and try again.');
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  if (!res.ok) throw new Error(json?.error || `Something went wrong (${res.status}).`);
  return json;
}

/* Organizer only: splits the game's players into fair teams and saves them.
   Returns { teams: [{ team: 1, players: [ids] }], spread, provenBest }. */
export function makeTeams(gameId, teamCount = 2) {
  return call('POST', `/games/${gameId}/teams`, { teams: teamCount });
}
