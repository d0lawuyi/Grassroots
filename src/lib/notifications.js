import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;

  if (existing !== 'granted') {
    const { status: asked } = await Notifications.requestPermissionsAsync();
    status = asked;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('games', {
      name: 'Game reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#17442F',
    });
  }

  return status === 'granted';
}

/**
 * Schedule two reminders for a game: the night before and 2 hours out.
 * Identifiers are namespaced by game so we can cancel them on leave.
 */
export async function scheduleGameReminders(game) {
  const granted = await requestPermission();
  if (!granted) return;

  const start = new Date(game.start_time);
  const parkName = game.parks?.name || 'the park';

  const reminders = [
    {
      id: `game-${game.game_id}-2h`,
      at: new Date(start.getTime() - 2 * 60 * 60 * 1000),
      title: `${game.title} in 2 hours`,
      body: `Kickoff at ${parkName}. Boots on.`,
    },
    {
      id: `game-${game.game_id}-eve`,
      at: (() => {
        const d = new Date(start);
        d.setDate(d.getDate() - 1);
        d.setHours(19, 0, 0, 0);
        return d;
      })(),
      title: `${game.title} is tomorrow`,
      body: `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} at ${parkName}`,
    },
  ];

  for (const r of reminders) {
    if (r.at.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        sound: true,
        data: { gameId: game.game_id },
      },
      trigger: r.at,
    });
  }
}

export async function cancelGameReminders(gameId) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const n of scheduled) {
    if (n.identifier?.startsWith(`game-${gameId}-`)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}