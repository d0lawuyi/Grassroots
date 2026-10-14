// Checks the My Games helpers in src/utils/myGames.js. Run: node --test scripts/check-my-games.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countPlayers, soonestFirst, fillLabel, fillFraction, calendarTile } from '../src/utils/myGames.js';

test('counts players per game from booking rows', () => {
  const rows = [{ game_id: 'a' }, { game_id: 'a' }, { game_id: 'b' }];
  assert.deepEqual(countPlayers(rows), { a: 2, b: 1 });
  assert.deepEqual(countPlayers(null), {});
});

test('upcoming games are listed soonest first, without changing the original list', () => {
  const games = [
    { game_id: 'late', start_time: '2026-10-20T18:00:00Z' },
    { game_id: 'soon', start_time: '2026-10-15T18:00:00Z' },
  ];
  assert.deepEqual(soonestFirst(games).map((g) => g.game_id), ['soon', 'late']);
  assert.equal(games[0].game_id, 'late');
});

test('roster labels', () => {
  assert.equal(fillLabel(6, 10), '6 of 10 players');
  assert.equal(fillLabel(1, 10), '1 of 10 players');
  assert.equal(fillLabel(10, 10), 'Full · 10 players');
  assert.equal(fillLabel(0, null), '0 of 10 players'); // no max set: the app's default of 10
});

test('fill bar never goes past full', () => {
  assert.equal(fillFraction(5, 10), 0.5);
  assert.equal(fillFraction(12, 10), 1);
  assert.equal(fillFraction(0, 0), 0);
});

test('calendar tile shows weekday and date in local time', () => {
  assert.deepEqual(calendarTile('2026-10-16T22:00:00Z'), { weekday: 'FRI', day: '16' }); // 6 PM Indianapolis
  assert.deepEqual(calendarTile('2026-10-17T02:30:00Z'), { weekday: 'FRI', day: '16' }); // 10:30 PM the 16th locally
});
