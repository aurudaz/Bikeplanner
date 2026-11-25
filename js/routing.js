import { BIKE_PROFILES } from './config.js';
import { buildRouteStats } from './geometry.js';

/**
 * Normalize counts into integer percentages summing strictly to 100 using largest-remainder.
 * @param {Record<string, number>} rawCounts
 * @returns {Record<string, number>}
 */
function normalizePercentages(rawCounts) {
  const entries = Object.entries(rawCounts);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total <= 0) {
    return Object.fromEntries(entries.map(([k]) => [k, 0]));
  }

  const exact = entries.map(([k, v]) => {
    const pct = (v / total) * 100;
    return { k, floor: Math.floor(pct), rem: pct - Math.floor(pct) };
  });

  let remainder = 100 - exact.reduce((sum, item) => sum + item.floor, 0);
  const byRem = [...exact].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remainder; i++) {
    byRem[i % byRem.length].floor += 1;
  }

  return Object.fromEntries(exact.map(item => [item.k, item.floor]));
}

function toKmObj(rawMeters) {
  return Object.fromEntries(
    Object.entries(rawMeters).map(([k, m]) => [k, Math.round((m / 1000) * 10) / 10])
  );
}

function normalizeCoordVal(val) {
  const num = parseFloat(val);
  if (!Number.isFinite(num)) return null;
  return Math.abs(num) > 180 ? num / 1e6 : num;
}

/**
 * Parse BRouter GeoJSON `properties.messages` table into exact surface/road-class stats,
 * official cycle-network share, and segment coordinates for map surface coloring.
 * @param {Array<Array<string>>} messages
 */
export function parseBRouterMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 2) return null;
  const header = messages[0].map(h => String(h).toLowerCase());
  const distIdx = header.indexOf('distance');
  const tagsIdx = header.indexOf('waytags');
  const lonIdx = header.indexOf('longitude');
  const latIdx = header.indexOf('latitude');
  if (distIdx === -1 || tagsIdx === -1) return null;

  const surfaces = { asphalt: 0, gravel: 0, trail: 0, other: 0 };
  const ways = { cycleway: 0, quietRoad: 0, trackPath: 0, mainRoad: 0 };
  const segmentSurfaces = [];
  let officialCycleM = 0;
  let totalM = 0;

  for (let i = 1; i < messages.length; i++) {
    const row = messages[i];
    const d = parseFloat(row[distIdx]) || 0;
    if (d <= 0) continue;
    totalM += d;

    const tagStr = row[tagsIdx] || '';
    const tags = {};
    tagStr.split(/\s+/).forEach(kv => {
      const eq = kv.indexOf('=');
      if (eq > 0) {
        tags[kv.slice(0, eq)] = kv.slice(eq + 1);
      }
    });

    const hw = tags.highway || '';
    const sf = tags.surface || '';
    const tt = tags.tracktype || '';

    let surfaceKey = 'other';
    if (['asphalt', 'paved', 'concrete', 'paving_stones', 'sett', 'cobblestone'].includes(sf)) {
      surfaceKey = 'asphalt';
    } else if (['gravel', 'fine_gravel', 'compacted', 'pebblestone'].includes(sf) || ['grade1', 'grade2', 'grade3'].includes(tt)) {
      surfaceKey = 'gravel';
    } else if (
      ['dirt', 'earth', 'ground', 'grass', 'mud', 'rock', 'sand', 'unpaved', 'wood'].includes(sf) ||
      ['grade4', 'grade5'].includes(tt) ||
      hw === 'path' ||
      hw === 'bridleway'
    ) {
      surfaceKey = 'trail';
    } else if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service', 'cycleway', 'living_street'].includes(hw)) {
      surfaceKey = 'asphalt';
    } else if (hw === 'track') {
      surfaceKey = 'gravel';
    }
    surfaces[surfaceKey] += d;

    const isOfficialNet = Boolean(tags.lcn || tags.rcn || tags.ncn || tags.icn);
    if (isOfficialNet) officialCycleM += d;

    let wayKey = 'quietRoad';
    if (hw === 'cycleway' || tags.bicycle === 'designated' || isOfficialNet) {
      wayKey = 'cycleway';
    } else if (['track', 'path', 'bridleway', 'footway', 'steps'].includes(hw)) {
      wayKey = 'trackPath';
    } else if (['primary', 'secondary', 'trunk', 'primary_link', 'secondary_link'].includes(hw)) {
      wayKey = 'mainRoad';
    }
    ways[wayKey] += d;

    if (lonIdx !== -1 && latIdx !== -1) {
      const lat = normalizeCoordVal(row[latIdx]);
      const lon = normalizeCoordVal(row[lonIdx]);
      if (lat != null && lon != null) {
        segmentSurfaces.push({ lat, lon, surface: surfaceKey, way: wayKey });
      }
    }
  }

  if (totalM === 0) return null;

  return {
    surfaces: normalizePercentages(surfaces),
    surfacesKm: toKmObj(surfaces),
    ways: normalizePercentages(ways),
    waysKm: toKmObj(ways),
    officialCycleRoutePct: Math.round((officialCycleM / totalM) * 100),
    segmentSurfaces
  };
}

/**
 * Parse a BRouter GeoJSON Feature into the unified route summary format.
 * @param {object} feat
 * @param {string} sourceLabel
 */
export function parseBRouterFeature(feat, sourceLabel = 'BRouter OSM') {
  const props = feat.properties || {};
  const rawCoords = feat.geometry.coordinates.map(c => [c[1], c[0], c[2] != null ? c[2] : 0]);
  const surfaceBreakdown = parseBRouterMessages(props.messages);
  const stats = buildRouteStats(rawCoords, surfaceBreakdown, sourceLabel);
  if (props['track-length']) stats.distanceKm = parseFloat(props['track-length']) / 1000;
  if (props['filtered ascend']) stats.ascentM = Math.round(parseFloat(props['filtered ascend']));
  return stats;
}

async function fetchWithTimeout(url, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Enrich coordinates missing elevation using Open-Meteo Elevation API.
 */
export async function enrichElevationOpenMeteo(coords, fetchImpl = fetch, timeoutMs = 10000) {
  if (!coords.length) return;
  const sampleCount = Math.min(95, coords.length);
  const step = Math.max(1, Math.floor((coords.length - 1) / Math.max(1, sampleCount - 1)));
  const idxs = [];
  for (let i = 0; i < coords.length; i += step) idxs.push(i);
  if (idxs[idxs.length - 1] !== coords.length - 1) idxs.push(coords.length - 1);

  const lats = idxs.map(i => coords[i][0].toFixed(4)).join(',');
  const lons = idxs.map(i => coords[i][1].toFixed(4)).join(',');

  try {
    const res = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`,
      timeoutMs,
      fetchImpl
    );
    if (res && res.ok) {
      const data = await res.json();
      const elevs = data.elevation || [];
      if (idxs.length === 1) {
        coords[0][2] = elevs[0] ?? 0;
        return;
      }
      for (let k = 0; k < idxs.length - 1; k++) {
        const i0 = idxs[k];
        const i1 = idxs[k + 1];
        const e0 = elevs[k] ?? 500;
        const e1 = elevs[k + 1] ?? e0;
        for (let j = i0; j <= i1; j++) {
          const frac = (j - i0) / Math.max(1, i1 - i0);
          coords[j][2] = e0 + frac * (e1 - e0);
        }
      }
      return;
    }
  } catch {
    // Fallback to zero elevation below
  }
  coords.forEach(c => {
    if (c[2] == null) c[2] = 0;
  });
}

function buildBRouterAttempts(profile) {
  const preferBikerouter = BIKE_PROFILES[profile]?.preferServer === 'bikerouter' || profile === 'gravel';
  if (preferBikerouter) {
    return [
      { base: 'https://bikerouter.de/brouter', profile, label: 'Bikerouter OSM' },
      { base: 'https://brouter.de/brouter', profile: profile === 'gravel' ? 'trekking' : profile, label: 'BRouter OSM' }
    ];
  }
  return [
    { base: 'https://brouter.de/brouter', profile, label: 'BRouter OSM' },
    { base: 'https://bikerouter.de/brouter', profile, label: 'Bikerouter OSM' }
  ];
}

/**
 * Compute an optimal bicycle route between ordered waypoints.
 * Tries BRouter / Bikerouter OSM profiles first (preserving full elevation and surface tags),
 * then falls back to OSRM Cycling + Open-Meteo Elevation.
 * @param {Array<{ lat: number, lon: number }>} waypoints
 * @param {string} profile
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function computeBikeRoute(waypoints, profile = 'trekking', opts = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new Error('At least two waypoints are required to route.');
  }
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = opts.timeoutMs || 15000;
  const lonlats = waypoints.map(w => `${w.lon.toFixed(5)},${w.lat.toFixed(5)}`).join('|');

  let brouterErrMsg = '';
  for (const attempt of buildBRouterAttempts(profile)) {
    const url = `${attempt.base}?lonlats=${lonlats}&profile=${encodeURIComponent(attempt.profile)}&alternativeidx=0&format=geojson`;
    try {
      const res = await fetchWithTimeout(url, timeoutMs, fetchImpl);
      if (res.ok) {
        const geo = await res.json();
        const feat = geo?.features?.[0];
        if (feat?.geometry?.coordinates?.length > 1) {
          return parseBRouterFeature(feat, attempt.label);
        }
      } else {
        brouterErrMsg = await res.text().catch(() => `HTTP ${res.status}`);
      }
    } catch (err) {
      brouterErrMsg = err?.message || 'BRouter request failed';
    }
  }

  // Fallback: OSRM Cycling + Open-Meteo Elevation
  const coordsStr = waypoints.map(w => `${w.lon.toFixed(5)},${w.lat.toFixed(5)}`).join(';');
  const osrmRes = await fetchWithTimeout(
    `https://router.project-osrm.org/route/v1/cycling/${coordsStr}?overview=full&geometries=geojson`,
    timeoutMs,
    fetchImpl
  );
  if (!osrmRes || !osrmRes.ok) {
    throw new Error(brouterErrMsg ? `Routing failed (${brouterErrMsg.slice(0, 80)})` : 'Both BRouter and OSRM routing failed.');
  }
  const osrmData = await osrmRes.json();
  if (!osrmData?.routes?.[0]?.geometry?.coordinates?.length) {
    throw new Error('No bike route found between these coordinates.');
  }

  const rawCoords = osrmData.routes[0].geometry.coordinates.map(c => [c[1], c[0], null]);
  await enrichElevationOpenMeteo(rawCoords, fetchImpl, timeoutMs);
  return buildRouteStats(rawCoords, null, 'OSRM + Open-Meteo');
}
