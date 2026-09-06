export function formatGameTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const datePart = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

export function formatSport(sport) {
  if (!sport) return '';
  return sport.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function sportEmoji(sport) {
  const map = {
    soccer: '⚽',
    flag_football: '🏈',
    basketball: '🏀',
    ultimate: '🥏',
  };
  return map[sport] || '🏃';
}