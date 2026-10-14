import AsyncStorage from '@react-native-async-storage/async-storage';
import { flagFromStorage } from '../utils/celebration';

/*
 * The two Profile switches for celebrations, saved on this phone (not in the database).
 * Both are on unless someone turned them off. If storage can't be read, they count as on.
 */
const KEYS = {
  animations: 'grassroots.celebrations.animations',
  sounds: 'grassroots.celebrations.sounds',
};

export async function loadCelebrationSettings() {
  try {
    const [animations, sounds] = await Promise.all([
      AsyncStorage.getItem(KEYS.animations),
      AsyncStorage.getItem(KEYS.sounds),
    ]);
    return { animations: flagFromStorage(animations), sounds: flagFromStorage(sounds) };
  } catch (e) {
    console.warn('Could not read celebration settings', e);
    return { animations: true, sounds: true };
  }
}

export async function saveCelebrationSetting(key, on) {
  try {
    await AsyncStorage.setItem(KEYS[key], on ? 'true' : 'false');
  } catch (e) {
    console.warn('Could not save celebration setting', e);
  }
}
