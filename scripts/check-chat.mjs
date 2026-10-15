// Checks the chat helpers in src/utils/chat.js. Run: TZ=America/Indianapolis node --test scripts/check-chat.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayLabel, startsNewDay, kickoffPill, sportIcon, initials } from '../src/utils/chat.js';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m); // October 2026, local time
const NOW = at(16, 15); // Friday Oct 16, 3 PM

test('day dividers: Today, Yesterday, then the date', () => {
  assert.equal(dayLabel(at(16, 9).toISOString(), NOW), 'Today');
  assert.equal(dayLabel(at(15, 23, 50).toISOString(), NOW), 'Yesterday');
  assert.equal(dayLabel(at(13, 18).toISOString(), NOW), 'Tue, Oct 13');
});

test('a divider goes before the first message and whenever the day changes', () => {
  assert.equal(startsNewDay(undefined, { sent_at: at(16, 9).toISOString() }), true);
  assert.equal(startsNewDay({ sent_at: at(16, 9).toISOString() }, { sent_at: at(16, 21).toISOString() }), false);
  assert.equal(startsNewDay({ sent_at: at(15, 23, 59).toISOString() }, { sent_at: at(16, 0, 1).toISOString() }), true);
});

test('kickoff pill: soon within 24 hours, later after that, played once started', () => {
  assert.deepEqual(kickoffPill(at(16, 15, 40).toISOString(), NOW), { text: 'In 40 min', tone: 'soon' });
  assert.deepEqual(kickoffPill(at(16, 18).toISOString(), NOW), { text: 'In 3 hours', tone: 'soon' });
  assert.deepEqual(kickoffPill(at(16, 16).toISOString(), NOW), { text: 'In 1 hour', tone: 'soon' });
  assert.deepEqual(kickoffPill(at(19, 15).toISOString(), NOW), { text: 'In 3 days', tone: 'later' });
  assert.deepEqual(kickoffPill(at(15, 18).toISOString(), NOW), { text: 'Played', tone: 'past' });
  assert.equal(kickoffPill(null, NOW), null);
});

test('sport icons match Create Game, with a fallback', () => {
  assert.equal(sportIcon('soccer'), 'football-outline');
  assert.equal(sportIcon('flag_football'), 'american-football-outline');
  assert.equal(sportIcon('curling'), 'people-outline');
  assert.equal(sportIcon(null), 'people-outline');
});

test('initials for the little avatar', () => {
  assert.equal(initials('Ana Lopez'), 'AL');
  assert.equal(initials('Mo'), 'M');
  assert.equal(initials('  '), '?');
  assert.equal(initials(null), '?');
});
