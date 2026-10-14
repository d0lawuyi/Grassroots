// Checks the time-slot rules in src/utils/slots.js. Run: node scripts/check-slots.mjs
// (CI runs it too.) Uses Node's built-in test runner, so there's nothing to install.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseClock, lastStartHour, nextDays, gamesOnDay, openStartTimes, clockLabel, sameDay,
} from '../src/utils/slots.js';

const at = (d, h, m = 0) => new Date(2026, 9, d, h, m); // October 2026, local time
const game = (startDay, startHour, minutes = 90) => ({
  start_time: at(startDay, startHour).toISOString(),
  end_time: new Date(at(startDay, startHour).getTime() + minutes * 60000).toISOString(),
});

test('reads lights-out times written different ways', () => {
  assert.equal(parseClock('9 PM'), 21);
  assert.equal(parseClock('9:30pm'), 21.5);
  assert.equal(parseClock('21:00'), 21);
  assert.equal(parseClock('12 am'), 0);
  assert.equal(parseClock('12 PM'), 12);
  assert.equal(parseClock('dusk'), null);
  assert.equal(parseClock(''), null);
  assert.equal(parseClock('25:00'), null);
});

test('last start leaves time for a 90-minute game before lights out', () => {
  assert.equal(lastStartHour({ lights_until: '10 PM' }), 20);
  assert.equal(lastStartHour({ lights_until: '9:30 PM' }), 20);
  assert.equal(lastStartHour({ lights_until: '9 PM' }), 19);
  assert.equal(lastStartHour({}), 20);
  assert.equal(lastStartHour({ lights_until: 'dusk' }), 20);
});

test('seven days starting today', () => {
  const days = nextDays(at(14, 17, 30));
  assert.equal(days.length, 7);
  assert.ok(sameDay(days[0], at(14, 0)));
  assert.ok(sameDay(days[6], at(20, 0)));
  assert.equal(days[0].getHours(), 0);
});

test('booked games block overlapping start times', () => {
  const day = at(15, 0);
  const games = [game(15, 18)]; // 6:00 to 7:30 PM
  const open = openStartTimes(day, games, {}, at(14, 12)).map((d) => d.getHours());
  assert.ok(!open.includes(17)); // 5:00-6:30 would overlap
  assert.ok(!open.includes(18));
  assert.ok(!open.includes(19)); // 7:00 starts before 7:30 end
  assert.ok(open.includes(16)); // 4:00-5:30 ends before 6
  assert.ok(open.includes(20));
  assert.equal(open[0], 7);
});

test('no times in the past', () => {
  const open = openStartTimes(at(14, 0), [], {}, at(14, 17, 30)).map((d) => d.getHours());
  assert.deepEqual(open, [18, 19, 20]);
});

test('games that run past midnight count on both days', () => {
  const late = game(14, 23, 120); // 11 PM to 1 AM
  assert.equal(gamesOnDay([late], at(14, 0)).length, 1);
  assert.equal(gamesOnDay([late], at(15, 0)).length, 1);
  assert.equal(gamesOnDay([late], at(16, 0)).length, 0);
});

test('clock labels', () => {
  assert.equal(clockLabel(at(14, 7)), '7 AM');
  assert.equal(clockLabel(at(14, 12)), '12 PM');
  assert.equal(clockLabel(at(14, 20, 30)), '8:30 PM');
  assert.equal(clockLabel(at(14, 0)), '12 AM');
});
