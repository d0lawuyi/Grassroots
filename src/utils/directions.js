import { Linking, Platform, Alert } from 'react-native';

/**
 * Opens the platform's maps app with directions to a park.
 * Prefers coordinates; falls back to a name search.
 */
export function openDirections(park) {
  if (!park) {
    Alert.alert('No location', 'This game has no park attached yet.');
    return;
  }

  const lat = Number(park.latitude);
  const lng = Number(park.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const label = encodeURIComponent(park.name || 'Field');

  let url;

  if (Platform.OS === 'ios') {
    url = hasCoords
      ? `maps://app?daddr=${lat},${lng}&dirflg=d`
      : `maps://app?daddr=${label}&dirflg=d`;
  } else {
    url = hasCoords
      ? `google.navigation:q=${lat},${lng}`
      : `geo:0,0?q=${label}`;
  }

  Linking.openURL(url).catch(() => {
    // maps app missing or URL scheme blocked — fall back to the browser
    const web = hasCoords
      ? `https://maps.google.com/?daddr=${lat},${lng}`
      : `https://maps.google.com/?q=${label}`;

    Linking.openURL(web).catch(() => {
      Alert.alert('Could not open maps', 'No maps app is available on this device.');
    });
  });
}