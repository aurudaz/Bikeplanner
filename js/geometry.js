const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Great-circle distance in kilometers between two coordinates.
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Initial compass bearing in degrees [0, 360) from point 1 to point 2.
 */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lon2 - lon1) * DEG_TO_RAD;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Find closest point on a coordinate polyline using coarse sampling + local refinement.
 * @param {number} lat
 * @param {number} lon
 * @param {Array<[number, number, number?]>} coords
 */
export function distanceToPolyline(lat, lon, coords) {
  if (!coords || !coords.length) {
    return { distKm: Infinity, progress: 0, nearestIndex: 0, nearestCoord: null };
  }
  const n = coords.length;
  const step = Math.max(1, Math.floor(n / 220));
  let minDist = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < n; i += step) {
    const d = haversineKm(lat, lon, coords[i][0], coords[i][1]);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }

  const lo = Math.max(0, bestIdx - step);
  const hi = Math.min(n - 1, bestIdx + step);
  for (let i = lo; i <= hi; i++) {
    const d = haversineKm(lat, lon, coords[i][0], coords[i][1]);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }

  return {
    distKm: minDist,
    progress: n > 1 ? bestIdx / (n - 1) : 0,
    nearestIndex: bestIdx,
    nearestCoord: coords[bestIdx]
  };
}

/**
 * Compute padded bounding box [minLat, minLon, maxLat, maxLon] around coordinates.
 * @param {Array<[number, number]>} coords
 * @param {number} padKm
 */
export function getRouteBBox(coords, padKm) {
  let minLat = 90;
  let maxLat = -90;
  let minLon = 180;
  let maxLon = -180;
  for (const c of coords) {
    if (c[0] < minLat) minLat = c[0];
    if (c[0] > maxLat) maxLat = c[0];
    if (c[1] < minLon) minLon = c[1];
    if (c[1] > maxLon) maxLon = c[1];
  }
  const padLat = padKm / 111;
  const midLat = (minLat + maxLat) / 2;
  const padLon = padKm / (111 * Math.max(0.25, Math.cos(midLat * DEG_TO_RAD)));
  return [minLat - padLat, minLon - padLon, maxLat + padLat, maxLon + padLon];
}

/**
 * Approximate width & height of a [minLat, minLon, maxLat, maxLon] bounding box in km.
 */
export function bboxSpanKm(bbox) {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const heightKm = haversineKm(minLat, minLon, maxLat, minLon);
  const widthKm = haversineKm(midLat, minLon, midLat, maxLon);
  return { widthKm, heightKm };
}

/**
 * Build comprehensive route statistics and elevation profile points.
 * @param {Array<[number, number, number]>} coords
 * @param {object|null} surfaceBreakdown
 * @param {string} source
 */
export function buildRouteStats(coords, surfaceBreakdown = null, source = 'BRouter OSM') {
  let distKm = 0;
  let ascentM = 0;
  let descentM = 0;
  let minElev = Infinity;
  let maxElev = -Infinity;
  let maxGradePct = 0;
  let steepClimbKm = 0;
  const profile = [];

  for (let i = 0; i < coords.length; i++) {
    const [lat, lon, eleRaw] = coords[i];
    const ele = Number.isFinite(eleRaw) ? eleRaw : 0;
    let segDist = 0;
    let grade = 0;

    if (i > 0) {
      segDist = haversineKm(coords[i - 1][0], coords[i - 1][1], lat, lon);
      distKm += segDist;
      const prevEle = Number.isFinite(coords[i - 1][2]) ? coords[i - 1][2] : ele;
      const dEle = ele - prevEle;

      if (dEle > 0.6) ascentM += dEle;
      else if (dEle < -0.6) descentM += Math.abs(dEle);

      if (segDist > 0.025) {
        grade = Math.max(-25, Math.min(25, (dEle / (segDist * 1000)) * 100));
        if (grade > maxGradePct) maxGradePct = grade;
        if (grade >= 8) steepClimbKm += segDist;
      }
    }

    if (ele < minElev) minElev = ele;
    if (ele > maxElev) maxElev = ele;
    profile.push({ distKm, ele, lat, lon, grade });
  }

  if (!coords.length) {
    minElev = 0;
    maxElev = 0;
  }

  return {
    coords,
    profile,
    distanceKm: distKm,
    ascentM: Math.round(ascentM),
    descentM: Math.round(descentM),
    minElev: Math.round(minElev),
    maxElev: Math.round(maxElev),
    maxGradePct: Math.round(maxGradePct * 10) / 10,
    steepClimbKm: Math.round(steepClimbKm * 10) / 10,
    surfaceBreakdown,
    source
  };
}

/**
 * Compute horizontal gap and vertical climb between a spot and the nearest point on the bike route.
 * Useful for identifying approach hikes where riders must lock bikes and hike up.
 */
export function computeApproachGap(spot, routeCoords) {
  if (!spot || !routeCoords || !routeCoords.length) {
    return { distKm: 0, elevGainM: 0, nearestLat: spot?.lat || 0, nearestLon: spot?.lon || 0, nearestEle: 0, needsHike: false };
  }
  const { distKm, nearestCoord } = distanceToPolyline(spot.lat, spot.lon, routeCoords);
  const nearestEle = Number.isFinite(nearestCoord[2]) ? nearestCoord[2] : 0;
  const spotEle = Number.isFinite(spot.ele) ? spot.ele : nearestEle;
  const elevGainM = Math.max(0, Math.round(spotEle - nearestEle));
  const roundedDist = Math.round(distKm * 100) / 100;
  const needsHike = roundedDist >= 0.25 || elevGainM >= 80;

  return {
    distKm: roundedDist,
    elevGainM,
    nearestLat: nearestCoord[0],
    nearestLon: nearestCoord[1],
    nearestEle: Math.round(nearestEle),
    needsHike
  };
}

export function formatDistance(km, unit = 'metric', decimals = 1) {
  if (!Number.isFinite(km)) return '—';
  if (unit === 'imperial') return `${(km * 0.621371).toFixed(decimals)} mi`;
  return `${km.toFixed(decimals)} km`;
}

export function formatElevation(m, unit = 'metric') {
  if (!Number.isFinite(m)) return '—';
  if (unit === 'imperial') return `${Math.round(m * 3.28084)} ft`;
  return `${Math.round(m)} m`;
}

export function formatTemp(c, unit = 'metric') {
  if (!Number.isFinite(c)) return '—';
  if (unit === 'imperial') return `${Math.round((c * 9) / 5 + 32)}°F`;
  return `${Math.round(c)}°C`;
}

export function formatSpeed(kmh, unit = 'metric') {
  if (!Number.isFinite(kmh)) return '—';
  if (unit === 'imperial') return `${Math.round(kmh * 0.621371)} mph`;
  return `${Math.round(kmh)} km/h`;
}

export function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

/**
 * Validate and normalize external URLs so only http/https links can be rendered.
 * @param {string|null|undefined} rawUrl
 * @returns {string|null}
 */
export function safeHttpUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}
