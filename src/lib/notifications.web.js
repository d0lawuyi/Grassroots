/*
 * Website version of src/lib/notifications.js. Browsers can't schedule a reminder for
 * tomorrow night the way a phone can, so on the web these do nothing. The phone app
 * keeps using notifications.js. (Expo picks the .web.js file automatically on the web.)
 */
export async function requestPermission() {
  return false;
}

export async function scheduleGameReminders() {}

export async function cancelGameReminders() {}
