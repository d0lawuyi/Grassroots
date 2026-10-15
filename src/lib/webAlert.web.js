/*
 * On the web, React Native's Alert.alert does nothing at all, so "Delete draft?",
 * "Saved" and every error message would silently vanish. This swaps in the browser's
 * own pop-ups:
 *   - no buttons or one button  -> window.alert, then that button's onPress
 *   - two or more buttons       -> window.confirm: OK runs the main button
 *                                  (the last one that isn't "cancel"), Cancel runs the cancel button
 * Imported once, first thing, from index.js.
 */
import { Alert } from 'react-native';

function message(title, body) {
  return [title, body].filter(Boolean).join('\n\n');
}

Alert.alert = (title, body, buttons) => {
  const list = Array.isArray(buttons) ? buttons : [];
  if (list.length <= 1) {
    window.alert(message(title, body));
    list[0]?.onPress?.();
    return;
  }
  const cancel = list.find((b) => b.style === 'cancel');
  const main = [...list].reverse().find((b) => b.style !== 'cancel') || list[list.length - 1];
  if (window.confirm(message(title, body))) main?.onPress?.();
  else cancel?.onPress?.();
};
