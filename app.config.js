/*
 * Expo reads app.json first, then this file can adjust it.
 *
 * The website lives at https://d0lawuyi.github.io/Grassroots/, one folder down from the
 * site's root, so its files must be loaded from /Grassroots/... The deploy workflow sets
 * EXPO_WEB_BASE_URL=/Grassroots for that build only; the phone app and
 * "npx expo start --web" on your PC leave it unset and are unchanged.
 */
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_WEB_BASE_URL;
  return {
    ...config,
    web: { ...config.web, name: 'Grassroots', shortName: 'Grassroots', themeColor: '#17442F', backgroundColor: '#F4F0E6' },
    ...(baseUrl ? { experiments: { ...config.experiments, baseUrl } } : {}),
  };
};
