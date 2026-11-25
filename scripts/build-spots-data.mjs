import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OVERPASS_MIRRORS } from '../js/config.js';
import { haversineKm } from '../js/geometry.js';
import { parseAndDedupeSpots } from '../js/overpass.js';
import { decodeTileSpot, encodeTileSpot, TILE_DEG, tileCoordsForLatLon } from '../js/spotStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TILES_DIR = path.join(DATA_DIR, 'tiles');
const INDEX_PATH = path.join(DATA_DIR, 'index.json');

const MACRO_REGIONS = [
  { id: 'alps_west', bbox: [43.5, 4.5, 48.0, 10.5] },
  { id: 'alps_east', bbox: [45.0, 10.5, 48.5, 17.0] },
  { id: 'pyrenees_north_es', bbox: [40.5, -9.5, 43.8, 3.5] },
  { id: 'south_iberia', bbox: [35.8, -9.5, 40.5, 1.0] },
  { id: 'france_corsica', bbox: [41.2, -5.0, 50.5, 9.8] },
  { id: 'italy_central_south', bbox: [36.5, 9.5, 45.0, 18.6] },
  { id: 'scandinavia', bbox: [57.5, 4.5, 70.5, 22.0] },
  { id: 'uk_ireland', bbox: [49.8, -10.5, 59.5, 2.0] },
  { id: 'balkans_greece', bbox: [36.5, 17.0, 45.5, 27.0] },
  { id: 'canaries_morocco', bbox: [27.5, -18.3, 35.8, -1.5] },
  { id: 'us_west', bbox: [32.0, -124.5, 49.0, -104.0] },
  { id: 'canada_west', bbox: [48.5, -132.0, 58.0, -113.0] },
  { id: 'new_zealand', bbox: [-47.3, 166.0, -34.2, 178.6] },
  { id: 'japan', bbox: [31.0, 129.5, 45.5, 145.8] },
  { id: 'andes_patagonia', bbox: [-55.0, -76.0, -20.0, -64.0] }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildBatchQuery(bbox, batchName) {
  const b = bbox.map(v => v.toFixed(3)).join(',');
  if (batchName === 'batchA') {
    return (
      `[out:json][timeout:35][maxsize:33554432];` +
      `(nw["highway"="via_ferrata"](${b});nw["sport"="via_ferrata"](${b});` +
      `nw["sport"~"^(free_flying|paragliding)$"](${b});nw["free_flying:site"](${b});` +
      `nw["sport"="canyoning"](${b});node["waterway"="waterfall"]["name"](${b}););` +
      `out center tags;`
    );
  }
  return (
    `[out:json][timeout:35][maxsize:33554432];` +
    `(nw["sport"="climbing"]["climbing"!="indoor"]["leisure"!="sports_centre"](${b});` +
    `nw["climbing"~"^(crag|boulder)$"](${b});` +
    `node["mountain_pass"="yes"](${b});` +
    `nw["natural"="hot_spring"](${b});nw["leisure"="swimming_area"](${b}););` +
    `out center tags;`
  );
}

async function queryMirrorWithRetry(ql, mirrorOffset = 0) {
  let lastErr;
  for (let i = 0; i < OVERPASS_MIRRORS.length; i++) {
    const mirror = OVERPASS_MIRRORS[(i + mirrorOffset) % OVERPASS_MIRRORS.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 38000);
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'VeloVertical-DatasetBuilder/2.1 (+https://github.com/aurudaz/Bikeplanner)'
        },
        body: 'data=' + encodeURIComponent(ql),
        signal: controller.signal
      });
      if (res.ok) {
        return await res.json();
      }
      lastErr = new Error(`HTTP ${res.status} (${mirror})`);
    } catch (err) {
      lastErr = err?.name === 'AbortError' || err === 'timeout' ? new Error(`Timeout (${mirror})`) : err;
    } finally {
      clearTimeout(timer);
    }
    await sleep(900);
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

function loadExistingSpots() {
  const existing = new Map();
  if (!fs.existsSync(TILES_DIR)) return existing;
  for (const file of fs.readdirSync(TILES_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const rows = JSON.parse(fs.readFileSync(path.join(TILES_DIR, file), 'utf8'));
      for (const row of rows) {
        const spot = decodeTileSpot(row);
        existing.set(spot.id, spot);
      }
    } catch {
      // Ignore corrupt tile
    }
  }
  return existing;
}

function inBBox(spot, [minLat, minLon, maxLat, maxLon]) {
  return spot.lat >= minLat && spot.lat <= maxLat && spot.lon >= minLon && spot.lon <= maxLon;
}

async function main() {
  const arg = process.argv.find(a => a.startsWith('--regions='));
  const wantedIds = arg ? new Set(arg.slice('--regions='.length).split(',').map(s => s.trim()).filter(Boolean)) : null;
  const regions = wantedIds ? MACRO_REGIONS.filter(r => wantedIds.has(r.id)) : MACRO_REGIONS;

  fs.mkdirSync(TILES_DIR, { recursive: true });
  const fallbackPool = loadExistingSpots();
  const collectedById = new Map();
  let mirrorCursor = 0;

  for (const region of regions) {
    console.log(`[build-spots] Querying region "${region.id}" (${region.bbox.join(',')})...`);
    let regionHadSuccess = false;

    for (const batchName of ['batchA', 'batchB']) {
      const ql = buildBatchQuery(region.bbox, batchName);
      try {
        const data = await queryMirrorWithRetry(ql, mirrorCursor++);
        const spots = parseAndDedupeSpots(data.elements || []);
        for (const s of spots) {
          collectedById.set(s.id, s);
        }
        regionHadSuccess = true;
        console.log(`  - ${batchName}: +${spots.length} spots`);
      } catch (err) {
        console.warn(`  ! ${region.id} ${batchName} failed: ${err.message}`);
      }
      await sleep(1200);
    }

    if (!regionHadSuccess) {
      let restored = 0;
      for (const s of fallbackPool.values()) {
        if (inBBox(s, region.bbox) && !collectedById.has(s.id)) {
          collectedById.set(s.id, s);
          restored++;
        }
      }
      if (restored > 0) {
        console.log(`  ↺ Preserved ${restored} previously cached spots for ${region.id}`);
      }
    }
  }

  // Group into 4x4° spatial tiles and deduplicate same-category entries within 350m per tile
  const tileBuckets = new Map();
  for (const spot of collectedById.values()) {
    const { tileId } = tileCoordsForLatLon(spot.lat, spot.lon);
    if (!tileBuckets.has(tileId)) tileBuckets.set(tileId, []);
    tileBuckets.get(tileId).push(spot);
  }

  const indexTiles = {};
  let totalSpots = 0;

  for (const [tileId, list] of tileBuckets.entries()) {
    list.sort(
      (a, b) =>
        (b.hasRealName ? 1 : 0) - (a.hasRealName ? 1 : 0) ||
        b.diffLevel - a.diffLevel ||
        (b.website ? 1 : 0) - (a.website ? 1 : 0)
    );
    const deduped = [];
    for (const s of list) {
      const dup = deduped.find(k => k.cat === s.cat && haversineKm(k.lat, k.lon, s.lat, s.lon) < 0.35);
      if (!dup) deduped.push(s);
    }

    const encoded = deduped.map(encodeTileSpot);
    fs.writeFileSync(path.join(TILES_DIR, `${tileId}.json`), JSON.stringify(encoded));

    const cats = {};
    for (const s of deduped) {
      cats[s.cat] = (cats[s.cat] || 0) + 1;
    }
    indexTiles[tileId] = { count: encoded.length, cats };
    totalSpots += encoded.length;
  }

  const indexPayload = {
    version: 1,
    tileDeg: TILE_DEG,
    generatedAt: new Date().toISOString(),
    totalSpots,
    tiles: indexTiles
  };
  fs.writeFileSync(INDEX_PATH, JSON.stringify(indexPayload, null, 2));
  console.log(`[build-spots] Done: ${totalSpots} spots across ${Object.keys(indexTiles).length} spatial tiles.`);
}

main().catch(err => {
  console.error('[build-spots] Fatal error:', err);
  process.exit(1);
});
