// Open-Meteo weather codes → readable condition + icon
const WEATHER_CODES = {
  0: { label: 'Clear', icon: 'sunny-outline' },
  1: { label: 'Mostly clear', icon: 'partly-sunny-outline' },
  2: { label: 'Partly cloudy', icon: 'partly-sunny-outline' },
  3: { label: 'Overcast', icon: 'cloud-outline' },
  45: { label: 'Fog', icon: 'cloud-outline' },
  48: { label: 'Fog', icon: 'cloud-outline' },
  51: { label: 'Light drizzle', icon: 'rainy-outline' },
  53: { label: 'Drizzle', icon: 'rainy-outline' },
  55: { label: 'Heavy drizzle', icon: 'rainy-outline' },
  61: { label: 'Light rain', icon: 'rainy-outline' },
  63: { label: 'Rain', icon: 'rainy-outline' },
  65: { label: 'Heavy rain', icon: 'rainy-outline' },
  71: { label: 'Light snow', icon: 'snow-outline' },
  73: { label: 'Snow', icon: 'snow-outline' },
  75: { label: 'Heavy snow', icon: 'snow-outline' },
  80: { label: 'Showers', icon: 'rainy-outline' },
  81: { label: 'Showers', icon: 'rainy-outline' },
  82: { label: 'Heavy showers', icon: 'rainy-outline' },
  95: { label: 'Thunderstorm', icon: 'thunderstorm-outline' },
  96: { label: 'Thunderstorm', icon: 'thunderstorm-outline' },
  99: { label: 'Thunderstorm', icon: 'thunderstorm-outline' },
};

// Codes where you probably shouldn't play
const ROUGH_CODES = [55, 63, 65, 73, 75, 82, 95, 96, 99];

export function describeWeather(code) {
  return WEATHER_CODES[code] || { label: 'Unknown', icon: 'help-outline' };
}

export function isRoughWeather(code) {
  return ROUGH_CODES.includes(code);
}

/**
 * Fetch hourly forecast for a set of coordinates and return a lookup
 * keyed by ISO hour string, e.g. "2026-09-12T19:00"
 */
export async function fetchForecast(latitude, longitude) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&hourly=temperature_2m,weather_code,precipitation_probability` +
      `&temperature_unit=fahrenheit&timezone=America%2FIndiana%2FIndianapolis` +
      `&forecast_days=16`;

    const res = await fetch(url);
    if (!res.ok) return {};

    const json = await res.json();
    const { time, temperature_2m, weather_code, precipitation_probability } = json.hourly || {};
    if (!time) return {};

    const lookup = {};
    time.forEach((t, i) => {
      lookup[t] = {
        temp: Math.round(temperature_2m[i]),
        code: weather_code[i],
        precipChance: precipitation_probability?.[i] ?? null,
      };
    });

    return lookup;
  } catch {
    return {};
  }
}

/** Convert a game's start_time into the hour key Open-Meteo uses */
export function hourKey(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}