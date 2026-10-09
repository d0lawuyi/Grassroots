import { supabase } from './supabase';

/*
 * Played games a user has removed from their own lists (My Games and Chats).
 * Hiding is per person: the game, its chat and everyone else's history stay as they are.
 * Backed by the hidden_games table (supabase/migrations/002_hidden_games.sql).
 */

// Returns a Set of game_ids this user has hidden. An empty Set if the table isn't set up yet.
export async function fetchHiddenGameIds(userId) {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('hidden_games')
    .select('game_id')
    .eq('user_id', userId);

  if (error) {
    console.warn('hidden_games not available:', error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.game_id));
}

// Hides one game for this user. Returns an error message, or null when it worked.
export async function hideGame(userId, gameId) {
  const { error } = await supabase
    .from('hidden_games')
    .upsert({ user_id: userId, game_id: gameId }, { onConflict: 'user_id,game_id', ignoreDuplicates: true });

  if (!error) return null;
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return 'Removing games needs a quick database update. Run supabase/migrations/002_hidden_games.sql in the Supabase SQL Editor.';
  }
  return error.message;
}

// Copy for the confirm dialog, shared by My Games and Chats so both say the same thing.
export const REMOVE_TITLE = 'Remove this game?';
export const removeMessage = (title) =>
  `"${title}" and its chat will be removed from your My Games and Chats. Other players won't be affected.`;
