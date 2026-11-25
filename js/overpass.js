import { CAT_META, OVERPASS_MIRRORS } from './config.js';
import { classifyDifficulty } from './difficulty.js';
import { bboxSpanKm, haversineKm } from './geometry.js';

const CATEGORY_CAPS = {
  vf: 80,
  pg: 80,
  cl: 80,
  cy: 60,
  pk: 60,
  sw: 60
};

const memorySpotCache = new Map();

/**
 * Build a fast Overpass QL query using node/way selectors (`nw`) and separate
 * per-category caps so dense categories never starve via ferratas or paragliding sites.
 * @param {[number, number, number, number]} bbox
 * @param {Record<string, boolean>} enabledCats
 */
export function buildAdventureQuery(bbox, enabledCats) {
  const b = bbox.map(v => Number(v).toFixed(4)).join(',');
  const blocks = [];

  if (enabledCats.vf) {
    blocks.push(`(nw["highway"="via_ferrata"](${b});nw["sport"="via_ferrata"](${b}););out center tags ${CATEGORY_CAPS.vf};`);
  }
  if (enabledCats.pg) {
    blocks.push(`(nw["sport"~"^(free_flying|paragliding)$"](${b});nw["free_flying:site"](${b}););out center tags ${CATEGORY_CAPS.pg};`);
  }
  if (enabledCats.cl) {
    blocks.push(`(nw["sport"="climbing"]["climbing"!="indoor"]["leisure"!="sports_centre"](${b});nw["climbing"~"^(crag|boulder)$"](${b}););out center tags ${CATEGORY_CAPS.cl};`);
  }
  if (enabledCats.cy) {
    blocks.push(`(nw["sport"="canyoning"](${b});node["waterway"="waterfall"]["name"](${b}););out center tags ${CATEGORY_CAPS.cy};`);
  }
  if (enabledCats.pk) {
    blocks.push(`(node["mountain_pass"="yes"](${b});node["natural"="peak"]["name"]["ele"](${b}););out center tags ${CATEGORY_CAPS.pk};`);
  }
  if (enabledCats.sw) {
    blocks.push(`(nw["natural"="hot_spring"](${b});nw["leisure"="swimming_area"](${b}););out center tags ${CATEGORY_CAPS.sw};`);
  }

  if (!blocks.length) return '';
  return `[out:json][timeout:18][maxsize:16777216];${blocks.join('')}`;
}

/**
 * Parse Overpass elements into normalized adventure spots and deduplicate nearby entries.
 * @param {Array<object>} elements
 */
export function parseAndDedupeSpots(elements) {
  const raw = [];
  const seenOsmIds = new Set();

  for (const el of elements || []) {
    const uid = `${el.type}_${el.id}`;
    if (seenOsmIds.has(uid)) continue;
    seenOsmIds.add(uid);

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const t = el.tags || {};

    // Exclude indoor climbing gyms / sports centers
    if (t.building || t.leisure === 'sports_centre' || t['climbing:indoor'] === 'yes') continue;

    let cat = null;
    if (t.highway === 'via_ferrata' || t.sport === 'via_ferrata' || t.via_ferrata_scale || t['via_ferrata:scale']) {
      cat = 'vf';
    } else if (t.sport === 'free_flying' || t.sport === 'paragliding' || t['free_flying:site'] || t.aeroway === 'launch_site') {
      cat = 'pg';
    } else if (t.sport === 'climbing' || t.climbing) {
      cat = 'cl';
    } else if (t.sport === 'canyoning' || t.waterway === 'waterfall') {
      cat = 'cy';
    } else if (t.mountain_pass === 'yes' || t.natural === 'peak') {
      cat = 'pk';
    } else if (t.natural === 'hot_spring' || t.leisure === 'swimming_area' || t.bathing === 'yes') {
      cat = 'sw';
    }
    if (!cat) continue;

    const diff = classifyDifficulty(cat, t);
    const localizedName = t.name || t['name:en'] || t['name:fr'] || t['name:de'] || t['name:es'] || t['name:it'];
    const name = localizedName || `${CAT_META[cat].label} (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
    const ele = t.ele != null ? parseInt(String(t.ele).replace(/[^\d.-]/g, ''), 10) : null;

    raw.push({
      id: `${el.type[0]}${el.id}`,
      osmType: el.type,
      osmId: el.id,
      cat,
      name,
      hasRealName: Boolean(localizedName),
      lat,
      lon,
      ele: Number.isFinite(ele) ? ele : null,
      diffLevel: diff.level,
      diffLabel: diff.label,
      website: t.website || t.url || null,
      wikipedia: t.wikipedia || null,
      description: t.description || t.note || '',
      orientation: t['free_flying:site:orientation'] || t.wind_direction || null,
      siteRole: t['free_flying:site'] || null,
      tags: t
    });
  }

  raw.sort(
    (a, b) =>
      (b.hasRealName ? 1 : 0) - (a.hasRealName ? 1 : 0) ||
      b.diffLevel - a.diffLevel ||
      (b.website ? 1 : 0) - (a.website ? 1 : 0) ||
      (b.ele != null ? 1 : 0) - (a.ele != null ? 1 : 0)
  );

  const kept = [];
  for (const s of raw) {
    const dup = kept.find(k => k.cat === s.cat && haversineKm(k.lat, k.lon, s.lat, s.lon) < 0.35);
    if (!dup) kept.push(s);
  }
  return kept;
}

/**
 * Execute an Overpass QL query across multiple public mirrors with AbortController timeout.
 */
export async function queryOverpass(ql, { fetchImpl = fetch, timeoutMs = 16000 } = {}) {
  let lastErr;
  for (const mirror of OVERPASS_MIRRORS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
    try {
      const res = await fetchImpl(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(ql),
        signal: controller.signal
      });
      if (res.ok) {
        return await res.json();
      }
      lastErr = new Error(`Overpass HTTP ${res.status}`);
    } catch (err) {
      lastErr = (err?.name === 'AbortError' || err === 'timeout')
        ? new Error('Overpass mirror timed out')
        : err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('All Overpass open-data mirrors are busy or unreachable.');
}

function getCacheKey(bbox, enabledCats) {
  const bKey = bbox.map(v => v.toFixed(2)).join(',');
  const cKey = Object.keys(enabledCats).filter(k => enabledCats[k]).sort().join('+');
  return `vv_spots:${bKey}:${cKey}`;
}

/**
 * Discover adventure spots within bbox using cached Overpass responses.
 */
export async function fetchAdventureSpots(bbox, enabledCats, opts = {}) {
  const ql = buildAdventureQuery(bbox, enabledCats);
  if (!ql) return [];

  const span = bboxSpanKm(bbox);
  if (span.widthKm > 220 || span.heightKm > 220) {
    throw new Error('Search area is too wide (>220 km) — shorten the corridor or lower Search Radius.');
  }

  const cacheKey = getCacheKey(bbox, enabledCats);
  if (!opts.bypassCache && memorySpotCache.has(cacheKey)) {
    return memorySpotCache.get(cacheKey);
  }

  try {
    if (!opts.bypassCache && typeof sessionStorage !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        memorySpotCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {
    // Ignore sessionStorage restrictions
  }

  const data = await queryOverpass(ql, opts);
  const spots = parseAndDedupeSpots(data.elements || []);
  memorySpotCache.set(cacheKey, spots);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(cacheKey, JSON.stringify(spots));
    }
  } catch {
    // Ignore quota errors
  }
  return spots;
}

/**
 * Query bikepacking support POIs (Water, Camps/Huts/Shelters, Bike Shops, Trains/Cable Cars, Groceries).
 */
export async function fetchSupportPOIs(bbox, enabledSupportSet, opts = {}) {
  if (!enabledSupportSet || enabledSupportSet.size === 0) return [];
  const b = bbox.map(v => v.toFixed(4)).join(',');
  const parts = [];

  if (enabledSupportSet.has('water')) parts.push(`node["amenity"="drinking_water"](${b});`);
  if (enabledSupportSet.has('camp')) {
    parts.push(`nw["tourism"="camp_site"](${b});`);
    parts.push(`nw["tourism"="alpine_hut"](${b});`);
    parts.push(`nw["amenity"="shelter"](${b});`);
  }
  if (enabledSupportSet.has('bike')) {
    parts.push(`nw["shop"="bicycle"](${b});`);
    parts.push(`node["amenity"="bicycle_repair_station"](${b});`);
  }
  if (enabledSupportSet.has('train')) {
    parts.push(`node["railway"="station"](${b});`);
    parts.push(`node["aerialway"="station"](${b});`);
  }
  if (enabledSupportSet.has('food')) {
    parts.push(`nw["shop"="supermarket"](${b});`);
    parts.push(`nw["shop"="bakery"](${b});`);
  }

  if (!parts.length) return [];
  const ql = `[out:json][timeout:18][maxsize:16777216];(${parts.join('')});out center tags 180;`;
  const data = await queryOverpass(ql, opts);

  return (data.elements || [])
    .map(el => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;
      const t = el.tags || {};

      let kind = 'water';
      let icon = '💧';
      let color = '#0284c7';
      let label = 'Drinking Water';

      if (t.tourism === 'camp_site' || t.tourism === 'alpine_hut' || t.amenity === 'shelter') {
        kind = 'camp';
        icon = '⛺';
        color = '#15803d';
        label = t.name || (t.tourism === 'alpine_hut' ? 'Alpine Hut' : t.amenity === 'shelter' ? 'Bivouac / Shelter' : 'Campsite');
      } else if (t.shop === 'bicycle' || t.amenity === 'bicycle_repair_station') {
        kind = 'bike';
        icon = '🔧';
        color = '#d97706';
        label = t.name || 'Bike Shop / Repair';
      } else if (t.railway === 'station' || t.aerialway === 'station') {
        kind = 'train';
        icon = t.aerialway === 'station' ? '🚡' : '🚂';
        color = '#475569';
        label = (t.name || (t.aerialway ? 'Cable Car' : 'Train Station')) + (t.aerialway ? ' (Uplift)' : ' (Rail/Bailout)');
      } else if (t.shop === 'supermarket' || t.shop === 'bakery') {
        kind = 'food';
        icon = '🛒';
        color = '#7c3aed';
        label = t.name || (t.shop === 'bakery' ? 'Bakery' : 'Grocery');
      }

      return { id: `${el.type[0]}${el.id}`, kind, icon, color, label, lat, lon };
    })
    .filter(Boolean);
}
