import { fetchAdventureSpots } from './overpass.js';

export const TILE_DEG = 4;

const OSM_TYPE_TO_CODE = { node: 'n', way: 'w', relation: 'r' };
const CODE_TO_OSM_TYPE = { n: 'node', w: 'way', r: 'relation' };

/**
 * Compute the 4°×4° spatial tile coordinates for a latitude/longitude pair.
 * Handles negative coordinates cleanly via Math.floor.
 * @param {number} lat
 * @param {number} lon
 */
export function tileCoordsForLatLon(lat, lon) {
  const latKey = Math.max(-88, Math.min(84, Math.floor(lat / TILE_DEG) * TILE_DEG));
  const lonKey = Math.max(-180, Math.min(176, Math.floor(lon / TILE_DEG) * TILE_DEG));
  return { latKey, lonKey, tileId: `${latKey}_${lonKey}` };
}

/**
 * Return all deduplicated 4°×4° tile IDs intersecting `[minLat, minLon, maxLat, maxLon]`.
 * @param {[number, number, number, number]} bbox
 * @returns {string[]}
 */
export function tileIdsForBBox(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return [];
  const [minLat, minLon, maxLat, maxLon] = bbox;
  const start = tileCoordsForLatLon(Math.min(minLat, maxLat), Math.min(minLon, maxLon));
  const end = tileCoordsForLatLon(Math.max(minLat, maxLat), Math.max(minLon, maxLon));

  const ids = [];
  for (let lat = start.latKey; lat <= end.latKey; lat += TILE_DEG) {
    for (let lon = start.lonKey; lon <= end.lonKey; lon += TILE_DEG) {
      ids.push(`${lat}_${lon}`);
    }
  }
  return ids;
}

/**
 * Encode a normalized spot object into a compact 15-element tuple for static tile JSONs.
 * @param {object} spot
 */
export function encodeTileSpot(spot) {
  const osmTypeCode = OSM_TYPE_TO_CODE[spot.osmType] || String(spot.id || 'n')[0] || 'n';
  const flags =
    (spot.hasRealName ? 1 : 0) |
    (spot.tags?.mountain_pass === 'yes' ? 2 : 0);

  return [
    spot.id,
    osmTypeCode,
    spot.osmId,
    spot.cat,
    spot.name,
    Math.round(spot.lat * 1e5) / 1e5,
    Math.round(spot.lon * 1e5) / 1e5,
    spot.ele != null && Number.isFinite(spot.ele) ? Math.round(spot.ele) : null,
    spot.diffLevel || 0,
    spot.diffLabel || '',
    spot.orientation || null,
    spot.siteRole || null,
    spot.website || null,
    spot.wikipedia || null,
    flags
  ];
}

/**
 * Decode a compact 15-element tuple from a static tile JSON back into a full spot object.
 * @param {Array} row
 */
export function decodeTileSpot(row) {
  const [
    id,
    osmTypeCode,
    osmId,
    cat,
    name,
    lat,
    lon,
    ele,
    diffLevel,
    diffLabel,
    orientation,
    siteRole,
    website,
    wikipedia,
    flags = 0
  ] = row;

  const tags = {};
  if ((flags & 2) !== 0) tags.mountain_pass = 'yes';
  if (wikipedia) tags.wikipedia = wikipedia;

  return {
    id,
    osmType: CODE_TO_OSM_TYPE[osmTypeCode] || 'node',
    osmId,
    cat,
    name,
    hasRealName: (flags & 1) !== 0,
    lat,
    lon,
    ele: ele != null ? ele : null,
    diffLevel: diffLevel || 0,
    diffLabel: diffLabel || '',
    website: website || null,
    wikipedia: wikipedia || null,
    description: '',
    orientation: orientation || null,
    siteRole: siteRole || null,
    tags
  };
}

function insideBBox(spot, [minLat, minLon, maxLat, maxLon]) {
  return spot.lat >= minLat && spot.lat <= maxLat && spot.lon >= minLon && spot.lon <= maxLon;
}

export class SpotStore {
  constructor({ fetchImpl = fetch, baseUrl = './data', overpassFetcher = fetchAdventureSpots } = {}) {
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.overpassFetcher = overpassFetcher;
    this.index = null;
    this._indexPromise = null;
    this.tileCache = new Map();
    this._tilePromises = new Map();
  }

  async loadIndex() {
    if (this.index) return this.index;
    if (this._indexPromise) return this._indexPromise;

    this._indexPromise = (async () => {
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/index.json`);
        if (res && res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object' && data.tiles) {
            this.index = data;
            return this.index;
          }
        }
      } catch {
        // Fallback silently to empty index when offline or missing
      }
      this.index = { version: 1, tileDeg: TILE_DEG, generatedAt: null, totalSpots: 0, tiles: {} };
      return this.index;
    })();

    return this._indexPromise;
  }

  hasCoverage(bbox) {
    const needed = tileIdsForBBox(bbox);
    const available = this.index?.tiles || {};
    const coveredTiles = needed.filter(id => Boolean(available[id]));
    const missingTiles = needed.filter(id => !available[id]);
    return {
      coveredTiles,
      missingTiles,
      fullyCovered: needed.length > 0 && missingTiles.length === 0,
      hasAny: coveredTiles.length > 0
    };
  }

  async loadTile(tileId) {
    if (this.tileCache.has(tileId)) return this.tileCache.get(tileId);
    if (this._tilePromises.has(tileId)) return this._tilePromises.get(tileId);

    const p = (async () => {
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/tiles/${tileId}.json`);
        if (res && res.ok) {
          const rows = await res.json();
          const spots = Array.isArray(rows) ? rows.map(decodeTileSpot) : [];
          this.tileCache.set(tileId, spots);
          return spots;
        }
      } catch {
        // Ignore individual tile fetch failure
      }
      this.tileCache.set(tileId, []);
      return [];
    })();

    this._tilePromises.set(tileId, p);
    return p;
  }

  async loadTiles(tileIds) {
    const arrays = await Promise.all(tileIds.map(id => this.loadTile(id)));
    return arrays.flat();
  }

  /**
   * Hybrid query: serves instant prebuilt static tiles whenever covered (unless `forceLive`),
   * and falls back cleanly to live Overpass outside static coverage.
   */
  async getSpotsInBBox(bbox, enabledCats, { forceLive = false, overpassOpts = {} } = {}) {
    await this.loadIndex();
    const coverage = this.hasCoverage(bbox);

    if (!forceLive && coverage.hasAny) {
      const tileSpots = await this.loadTiles(coverage.coveredTiles);
      const filtered = tileSpots.filter(s => enabledCats[s.cat] && insideBBox(s, bbox));

      if (coverage.missingTiles.length === 0) {
        return {
          spots: filtered,
          source: 'static',
          generatedAt: this.index.generatedAt || null
        };
      }

      if (filtered.length > 0) {
        return {
          spots: filtered,
          source: 'static-partial',
          generatedAt: this.index.generatedAt || null
        };
      }
    }

    const liveSpots = await this.overpassFetcher(bbox, enabledCats, overpassOpts);
    return {
      spots: liveSpots,
      source: 'live',
      generatedAt: null
    };
  }

  /**
   * Fast static-only lookup for map pan/zoom browsing.
   * Never calls Overpass while panning.
   */
  async getViewportBrowseSpots(
    bbox,
    enabledCats,
    { minDiff = 1, maxDiff = 3, includeUnrated = true, pgLaunchesOnly = true, maxSpots = 240 } = {}
  ) {
    await this.loadIndex();
    const coverage = this.hasCoverage(bbox);
    if (!coverage.hasAny) return [];

    const tileSpots = await this.loadTiles(coverage.coveredTiles);
    const matching = [];

    for (const s of tileSpots) {
      if (!enabledCats[s.cat]) continue;
      if (!insideBBox(s, bbox)) continue;
      if (pgLaunchesOnly && s.cat === 'pg' && s.siteRole === 'landing') continue;
      if (s.diffLevel === 0 && !includeUnrated) continue;
      if (s.diffLevel > 0 && (s.diffLevel < minDiff || s.diffLevel > maxDiff)) continue;
      matching.push(s);
    }

    matching.sort((a, b) => {
      const scoreA = (a.hasRealName ? 30 : 0) + (a.diffLevel > 0 ? 15 : 0) + (a.website ? 5 : 0) + (a.ele != null ? 3 : 0);
      const scoreB = (b.hasRealName ? 30 : 0) + (b.diffLevel > 0 ? 15 : 0) + (b.website ? 5 : 0) + (b.ele != null ? 3 : 0);
      return scoreB - scoreA;
    });

    return matching.slice(0, maxSpots);
  }
}
