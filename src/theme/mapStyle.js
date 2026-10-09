/*
 * Clubhouse map: warm paper ground, quiet roads, parks in sage so fields stand out.
 * Applies to Google Maps (Android, and iOS when PROVIDER_GOOGLE is used).
 * Apple Maps on iOS ignores custom styles and shows its standard light map.
 */
export const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#F1ECE0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F7F3EA' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B736C' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#D5E2D0' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#2F6B3E' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFDF8' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FBF8F1' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E8DFCC' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C9DDE3' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4D6B75' }] },
];

// Older screens import the map style by this name.
export const DARK_MAP = MAP_STYLE;
