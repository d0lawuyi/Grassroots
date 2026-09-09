export const DARK_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#0B0F0B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0F0B' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B7268' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }, { color: '#141B12' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5A6B3E' }],
  },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#161A16' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#1B201B' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#232823' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#05080A' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#2E3A40' }] },
];