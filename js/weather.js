import { parseWindOrientations } from './difficulty.js';

const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Fetch current conditions and 3-day mountain forecast from Open-Meteo.
 * @param {number} lat
 * @param {number} lon
 */
export async function fetchWeather(lat, lon, fetchImpl = fetch, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset` +
      `&timezone=auto&forecast_days=3`;
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function windDirLabel(deg) {
  if (!Number.isFinite(deg)) return '—';
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS_8[Math.round(normalized / 45) % 8];
}

function angularDiffDeg(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Evaluate paragliding launch wind compatibility against live Open-Meteo wind vector.
 * OSM `free_flying:site:orientation` indicates launch facing direction (into the wind).
 * @param {object} spot
 * @param {object|null} weather
 * @returns {{ status: 'ideal'|'caution'|'poor'|'unknown', label: string, detail: string }}
 */
export function evaluateParaglidingWind(spot, weather) {
  if (!spot || spot.cat !== 'pg' || spot.siteRole === 'landing') {
    return { status: 'unknown', label: '', detail: '' };
  }
  const cur = weather?.current;
  if (!cur || !Number.isFinite(cur.wind_direction_10m)) {
    return { status: 'unknown', label: '', detail: '' };
  }

  const orientations = parseWindOrientations(spot.orientation);
  const wind = Math.round(cur.wind_speed_10m ?? 0);
  const gusts = Math.round(cur.wind_gusts_10m ?? wind);
  const dirLabel = windDirLabel(cur.wind_direction_10m);

  if (!orientations.length) {
    if (gusts >= 32 || wind >= 25) {
      return { status: 'poor', label: `🔴 High Wind (${wind}/${gusts} km/h ${dirLabel})`, detail: 'Strong wind/gusts' };
    }
    return { status: 'unknown', label: '', detail: '' };
  }

  const bestDiff = Math.min(...orientations.map(o => angularDiffDeg(o, cur.wind_direction_10m)));

  if (gusts >= 35 || wind >= 26) {
    return {
      status: 'poor',
      label: `🔴 Blown Out (${wind}/${gusts} km/h ${dirLabel})`,
      detail: `Excessive wind speed for safe launch`
    };
  }
  if (bestDiff > 75) {
    return {
      status: 'poor',
      label: `🔴 Lee / Tailwind (${dirLabel} vs ${spot.orientation})`,
      detail: `Wind ${Math.round(bestDiff)}° off launch orientation`
    };
  }
  if (bestDiff <= 45 && wind <= 22 && gusts <= 28) {
    return {
      status: 'ideal',
      label: `🟢 Ideal Wind (${dirLabel} · ${wind} km/h)`,
      detail: `Aligned with ${spot.orientation} launch`
    };
  }
  return {
    status: 'caution',
    label: `🟡 Cross / Gusty (${dirLabel} ${wind}/${gusts})`,
    detail: `Launch ${spot.orientation} has ${Math.round(bestDiff)}° crosswind or gusts`
  };
}

/**
 * Estimate air temperature at the route's highest point using standard alpine lapse rate (-6.5°C / 1000m).
 */
export function estimateSummitTemp(currentTempC, modelElevM, routeMaxElevM) {
  if (!Number.isFinite(currentTempC)) return null;
  if (!Number.isFinite(modelElevM) || !Number.isFinite(routeMaxElevM)) return Math.round(currentTempC);
  if (routeMaxElevM <= modelElevM + 100) return Math.round(currentTempC);
  const diffKm = (routeMaxElevM - modelElevM) / 1000;
  return Math.round(currentTempC - diffKm * 6.5);
}

function calcDaylightWindow(sunriseIso, sunsetIso) {
  if (!sunriseIso || !sunsetIso) return null;
  const sr = new Date(sunriseIso);
  const ss = new Date(sunsetIso);
  if (Number.isNaN(sr.getTime()) || Number.isNaN(ss.getTime())) return null;
  const diffMin = Math.max(0, Math.round((ss.getTime() - sr.getTime()) / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return {
    sunrise: sunriseIso.slice(11, 16),
    sunset: sunsetIso.slice(11, 16),
    durationLabel: `${h}h ${String(m).padStart(2, '0')}m`
  };
}

/**
 * Build overall adventure weather safety summary, summit temperature, daylight window, and 3-day outlook.
 */
export function summarizeWeatherSafety(weather, routeMaxElevM = 0) {
  const cur = weather?.current;
  if (!cur) return null;

  const wind = Math.round(cur.wind_speed_10m ?? 0);
  const gusts = Math.round(cur.wind_gusts_10m ?? wind);
  const dirDeg = cur.wind_direction_10m ?? 0;
  const dirLabel = windDirLabel(dirDeg);
  const daily = weather.daily || {};
  const rainProb = daily.precipitation_probability_max?.[0] ?? 0;

  let status = 'good';
  let message = '✅ Good conditions for biking, dry via ferratas & calm paragliding air.';

  if (gusts >= 32 || wind >= 24) {
    status = 'bad';
    message = `⚠️ Strong wind (${wind} km/h, gusts ${gusts} km/h ${dirLabel}) — Paragliding likely blown out; watch exposed ridge gusts.`;
  } else if (rainProb >= 55 || (cur.precipitation ?? 0) > 0.2) {
    status = 'warn';
    message = `🌧️ Rain risk (${rainProb}%) — Avoid wet iron cables/lightning on Via Ferratas & slick rock.`;
  } else if (gusts >= 22) {
    status = 'warn';
    message = `💨 Moderate gusts (${gusts} km/h ${dirLabel}) — Flyable for experienced pilots; watch lee-side rotors.`;
  }

  const summitTempC = estimateSummitTemp(cur.temperature_2m, weather.elevation, routeMaxElevM);
  const daylight = calcDaylightWindow(daily.sunrise?.[0], daily.sunset?.[0]);

  const days = (daily.time || []).map((dateStr, idx) => ({
    date: dateStr,
    tMin: Math.round(daily.temperature_2m_min?.[idx] ?? 0),
    tMax: Math.round(daily.temperature_2m_max?.[idx] ?? 0),
    rainProb: Math.round(daily.precipitation_probability_max?.[idx] ?? 0),
    windMax: Math.round(daily.wind_speed_10m_max?.[idx] ?? 0),
    gustMax: Math.round(daily.wind_gusts_10m_max?.[idx] ?? 0),
    windDir: windDirLabel(daily.wind_direction_10m_dominant?.[idx])
  }));

  return {
    status,
    message,
    currentTempC: Math.round(cur.temperature_2m ?? 0),
    summitTempC,
    modelElevM: Math.round(weather.elevation ?? 0),
    windKmh: wind,
    gustsKmh: gusts,
    windDirLabel: dirLabel,
    rainProb,
    daylight,
    days
  };
}
