/*
 * Website version of the date/time picker: the browser's own date or time box.
 * It calls onChange(event, date) the same way the native picker does, so Create Game
 * works unchanged. Only the props Create Game uses are supported:
 *   value, mode ('date' | 'time'), minimumDate, minuteInterval, onChange.
 */
import React from 'react';
import { COLORS } from '../theme/colors';

const pad = (n) => String(n).padStart(2, '0');
const dateText = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeText = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function DateTimePicker({ value, mode = 'date', minimumDate, minuteInterval, onChange }) {
  const isTime = mode === 'time';

  function handle(e) {
    const text = e.target.value;
    if (!text) return;
    const next = new Date(value);
    if (isTime) {
      const [h, m] = text.split(':').map(Number);
      next.setHours(h, m, 0, 0);
    } else {
      const [y, mo, d] = text.split('-').map(Number);
      next.setFullYear(y, mo - 1, d);
    }
    onChange?.({ type: 'set' }, next);
  }

  return (
    <input
      type={isTime ? 'time' : 'date'}
      value={isTime ? timeText(value) : dateText(value)}
      min={!isTime && minimumDate ? dateText(minimumDate) : undefined}
      step={isTime && minuteInterval ? minuteInterval * 60 : undefined}
      onChange={handle}
      autoFocus
      style={{
        marginTop: 8,
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 14px',
        fontSize: 16,
        color: COLORS.snow,
        background: COLORS.ink,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 14,
        fontFamily: 'inherit',
      }}
    />
  );
}
