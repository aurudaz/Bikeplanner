import { CAT_META } from './config.js';
import { formatDistance, formatElevation } from './geometry.js';
import { getExternalLinks } from './externalLinks.js';

const STORAGE_KEY = 'velovertical_saved_trips_v1';

function escXml(str = '') {
  return String(str).replace(/[<>&'"]/g, c => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[c]));
}

/**
 * Generate a GPX 1.1 XML string with track, elevation, adventure waypoints,
 * approach hike notes, external links, and Day overnight camp markers.
 */
export function generateGPX({ route, start, end, mode, selectedSpots = [], stages = [] }) {
  if (!route || !route.coords?.length) {
    throw new Error('No route available to export.');
  }
  const wpts = [];
  if (start) {
    wpts.push(`  <wpt lat="${start.lat}" lon="${start.lon}"><name>${escXml('START: ' + start.name)}</name></wpt>`);
  }

  for (const s of selectedSpots) {
    const links = getExternalLinks(s)
      .slice(0, 4)
      .map(l => `${l.label}: ${l.url}`)
      .join(' | ');
    const hikeNote = s.approach?.needsHike
      ? `Approach hike: ${s.approach.distKm} km (+${s.approach.elevGainM}m)`
      : 'Bike accessible';
    const eleTag = s.ele != null ? `<ele>${s.ele}</ele>` : '';
    const desc = `${s.diffLabel} · ${hikeNote} · ${links}`;
    wpts.push(
      `  <wpt lat="${s.lat}" lon="${s.lon}">${eleTag}<name>${escXml(CAT_META[s.cat].label + ': ' + s.name)}</name><desc>${escXml(desc)}</desc></wpt>`
    );
  }

  for (const st of stages) {
    if (st.endPoint) {
      const [lat, lon, ele] = st.endPoint;
      wpts.push(
        `  <wpt lat="${lat.toFixed(5)}" lon="${lon.toFixed(5)}"><ele>${ele}</ele><name>${escXml(`Camp Day ${st.day} (${st.distKm} km)`)}</name></wpt>`
      );
    }
  }

  if (mode === 'p2p' && end) {
    wpts.push(`  <wpt lat="${end.lat}" lon="${end.lon}"><name>${escXml('END: ' + end.name)}</name></wpt>`);
  }

  const trkpts = route.coords
    .map(c => `      <trkpt lat="${c[0].toFixed(5)}" lon="${c[1].toFixed(5)}"><ele>${(c[2] || 0).toFixed(1)}</ele></trkpt>`)
    .join('\n');

  const routeTitle = `${start?.name || 'Trip'}${mode === 'p2p' && end ? ' to ' + end.name : ' Loop'}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VeloVertical Open-Data Planner" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${escXml(routeTitle)}</name></metadata>
${wpts.join('\n')}
  <trk>
    <name>${escXml(routeTitle)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Generate a clean GeoJSON FeatureCollection containing the bike track, endpoints, spots, and stage camps.
 */
export function generateGeoJSON({ route, start, end, mode, selectedSpots = [], stages = [] }) {
  if (!route || !route.coords?.length) {
    throw new Error('No route available to export.');
  }
  const features = [
    {
      type: 'Feature',
      properties: {
        kind: 'bike_route',
        distanceKm: Number(route.distanceKm.toFixed(2)),
        ascentM: route.ascentM,
        descentM: route.descentM,
        source: route.source
      },
      geometry: {
        type: 'LineString',
        coordinates: route.coords.map(c => [Number(c[1].toFixed(5)), Number(c[0].toFixed(5)), Math.round(c[2] || 0)])
      }
    }
  ];

  if (start) {
    features.push({
      type: 'Feature',
      properties: { kind: 'start', name: start.name },
      geometry: { type: 'Point', coordinates: [start.lon, start.lat] }
    });
  }
  if (mode === 'p2p' && end) {
    features.push({
      type: 'Feature',
      properties: { kind: 'end', name: end.name },
      geometry: { type: 'Point', coordinates: [end.lon, end.lat] }
    });
  }

  for (const s of selectedSpots) {
    features.push({
      type: 'Feature',
      properties: {
        kind: 'adventure_spot',
        category: CAT_META[s.cat]?.label || s.cat,
        name: s.name,
        difficulty: s.diffLabel,
        elevationM: s.ele,
        approachHikeKm: s.approach?.distKm ?? 0
      },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] }
    });
  }

  for (const st of stages) {
    if (st.endPoint) {
      features.push({
        type: 'Feature',
        properties: { kind: 'overnight_camp', day: st.day, distanceKm: st.endPoint[3] },
        geometry: { type: 'Point', coordinates: [st.endPoint[1], st.endPoint[0], st.endPoint[2]] }
      });
    }
  }

  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

/**
 * Generate a readable Markdown trip sheet for sharing, printing, or Obsidian notes.
 */
export function generateTripMarkdown({ route, start, end, mode, selectedSpots = [], stages = [], weatherSummary = null, emergency = null, unit = 'metric' }) {
  const title = `${start?.name || 'Custom Start'}${mode === 'p2p' && end ? ` → ${end.name}` : ' (Loop)'}`;
  const lines = [
    `# VeloVertical Trip Sheet: ${title}`,
    '',
    `- **Distance:** ${formatDistance(route.distanceKm, unit)}`,
    `- **Elevation Gain / Loss:** +${formatElevation(route.ascentM, unit)} / -${formatElevation(route.descentM, unit)} (Max ${formatElevation(route.maxElev, unit)})`,
    `- **Max Grade:** ${route.maxGradePct || 0}% (${formatDistance(route.steepClimbKm || 0, unit)} > 8%)`,
    `- **Routing Source:** ${route.source}`
  ];

  if (route.surfaceBreakdown) {
    const s = route.surfaceBreakdown.surfaces;
    const w = route.surfaceBreakdown.ways;
    lines.push(`- **Surfaces:** Asphalt ${s.asphalt}% · Gravel ${s.gravel}% · Trail ${s.trail}%`);
    lines.push(`- **Road Class:** Cycleway ${w.cycleway}% · Quiet Rd ${w.quietRoad}% · Track ${w.trackPath}% · Main ${w.mainRoad}%`);
  }

  if (weatherSummary) {
    lines.push(`- **Conditions:** ${weatherSummary.message}`);
  }

  if (emergency) {
    lines.push(`- **Mountain Rescue (${emergency.name}):** ${emergency.mountain} (General: ${emergency.general})`);
  }

  lines.push('', '## Adventure Spots on Route');
  if (!selectedSpots.length) {
    lines.push('- No adventure waypoints selected.');
  } else {
    selectedSpots.forEach((s, idx) => {
      const hike = s.approach?.needsHike ? ` · Approach hike ${formatDistance(s.approach.distKm, unit)} (+${formatElevation(s.approach.elevGainM, unit)})` : ' · Bike access';
      const firstLink = getExternalLinks(s)[0]?.url || '';
      lines.push(`${idx + 1}. **${CAT_META[s.cat].icon} ${s.name}** (${s.diffLabel}${s.ele ? `, ${formatElevation(s.ele, unit)}` : ''})${hike}${firstLink ? ` — ${firstLink}` : ''}`);
    });
  }

  if (stages.length > 1) {
    lines.push('', '## Daily Stages');
    stages.forEach(st => {
      const names = st.spots.map(sp => sp.name).join(', ') || 'Riding stage';
      lines.push(`- **Day ${st.day}:** ${formatDistance(st.distKm, unit)}, +${formatElevation(st.ascentM, unit)} (~${st.totalHours}h total) — ${names}`);
    });
  }

  return lines.join('\n');
}

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Encode planner settings and selected spot IDs into a compact URL hash (#trip=...).
 */
export function encodeTripHash(tripState) {
  const json = JSON.stringify(tripState);
  const bytes = new TextEncoder().encode(json);
  return `#trip=${toBase64Url(bytes)}`;
}

/**
 * Decode a `#trip=...` URL hash safely; returns null on malformed input.
 */
export function decodeTripHash(hashStr) {
  if (!hashStr || typeof hashStr !== 'string') return null;
  const idx = hashStr.indexOf('#trip=');
  if (idx === -1) return null;
  const payload = hashStr.slice(idx + 6).split('&')[0];
  if (!payload) return null;
  try {
    const bytes = fromBase64Url(payload);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.start || !Number.isFinite(parsed.start.lat) || !Number.isFinite(parsed.start.lon)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function loadSavedTrips(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTripToStorage(tripObj, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  const list = loadSavedTrips(storage);
  const entry = {
    id: tripObj.id || `trip_${Date.now()}`,
    savedAt: new Date().toISOString(),
    ...tripObj
  };
  const updated = [entry, ...list.filter(item => item.id !== entry.id)].slice(0, 30);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function deleteSavedTrip(id, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  if (!storage) return [];
  const updated = loadSavedTrips(storage).filter(item => item.id !== id);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}
