/*
 * Every screen imports its map from here instead of from react-native-maps.
 * On a phone this is react-native-maps (Apple or Google maps). On the website Expo picks
 * maps.web.js instead, because react-native-maps only works on phones.
 */
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export { Marker, PROVIDER_GOOGLE };
export default MapView;
