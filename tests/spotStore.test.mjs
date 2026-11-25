import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeTileSpot,
  encodeTileSpot,
  SpotStore,
  tileCoordsForLatLon,
  tileIdsForBBox
} from '../js/spotStore.js';

test('tileCoordsForLatLon and tileIdsForBBox handle positive and negative coordinates', () => {
  assert.deepEqual(tileCoordsForLatLon(46.68, 7.86), { latKey: 44, lonKey: 4, tileId: '44_4' });
  assert.deepEqual(tileCoordsForLatLon(46.68, 8.1), { latKey: 44, lonKey: 8, tileId: '44_8' });
  assert.deepEqual(tileCoordsForLatLon(-45.03, -5.16), { latKey: -48, lonKey: -8, tileId: '-48_-8' });

  const ids = tileIdsForBBox([45.8, 7.5, 46.9, 8.5]);
  assert.deepEqual(ids, ['44_4', '44_8']);
});

test('encodeTileSpot and decodeTileSpot round-trip spot metadata faithfully', () => {
  const spot = {
    id: 'w12345',
    osmType: 'way',
    osmId: 12345,
    cat: 'vf',
    name: 'Murren Via Ferrata',
    hasRealName: true,
    lat: 46.559123,
    lon: 7.892345,
    ele: 1640,
    diffLevel: 2,
    diffLabel: 'K3 Moderate',
    orientation: 'SW',
    siteRole: null,
    website: 'https://example.com',
    wikipedia: 'en:Murren',
    tags: { mountain_pass: 'yes', wikipedia: 'en:Murren' }
  };

  const encoded = encodeTileSpot(spot);
  assert.equal(encoded.length, 15);
  const decoded = decodeTileSpot(encoded);
  assert.equal(decoded.id, 'w12345');
  assert.equal(decoded.osmType, 'way');
  assert.equal(decoded.hasRealName, true);
  assert.equal(decoded.ele, 1640);
  assert.equal(decoded.diffLabel, 'K3 Moderate');
  assert.equal(decoded.tags.mountain_pass, 'yes');
  assert.equal(decoded.tags.wikipedia, 'en:Murren');
});

test('SpotStore serves static tiles without calling Overpass when covered, and falls back outside coverage', async () => {
  const vfRow = encodeTileSpot({
    id: 'n1',
    osmType: 'node',
    osmId: 1,
    cat: 'vf',
    name: 'Covered VF',
    hasRealName: true,
    lat: 46.6,
    lon: 8.1,
    ele: 1400,
    diffLevel: 2,
    diffLabel: 'K3 Moderate',
    tags: {}
  });

  let overpassCalls = 0;
  const mockFetch = async url => {
    if (url.endsWith('/index.json')) {
      return {
        ok: true,
        json: async () => ({
          version: 1,
          tileDeg: 4,
          generatedAt: '2026-11-25T18:00:00Z',
          totalSpots: 1,
          tiles: { '44_8': { count: 1, cats: { vf: 1 } } }
        })
      };
    }
    if (url.endsWith('/tiles/44_8.json')) {
      return { ok: true, json: async () => [vfRow] };
    }
    return { ok: false, status: 404 };
  };

  const mockOverpass = async () => {
    overpassCalls++;
    return [{ id: 'n99', cat: 'pg', name: 'Live Launch', lat: 10.2, lon: 10.2 }];
  };

  const store = new SpotStore({ fetchImpl: mockFetch, baseUrl: './data', overpassFetcher: mockOverpass });

  // Inside covered tile 44_8 -> static, zero Overpass calls
  const resStatic = await store.getSpotsInBBox([46.4, 8.0, 46.8, 8.3], { vf: true, pg: true });
  assert.equal(resStatic.source, 'static');
  assert.equal(resStatic.spots.length, 1);
  assert.equal(resStatic.spots[0].name, 'Covered VF');
  assert.equal(overpassCalls, 0);

  // Forced live -> calls Overpass
  const resForced = await store.getSpotsInBBox([46.4, 8.0, 46.8, 8.3], { vf: true, pg: true }, { forceLive: true });
  assert.equal(resForced.source, 'live');
  assert.equal(overpassCalls, 1);

  // Uncovered tile -> falls back to Overpass
  const resUncovered = await store.getSpotsInBBox([10.0, 10.0, 10.5, 10.5], { pg: true });
  assert.equal(resUncovered.source, 'live');
  assert.equal(overpassCalls, 2);
});

test('SpotStore.getViewportBrowseSpots filters by category, difficulty, and maxSpots cap', async () => {
  const rows = [
    encodeTileSpot({ id: 'n1', osmType: 'node', osmId: 1, cat: 'vf', name: 'Easy VF', hasRealName: true, lat: 46.6, lon: 8.1, diffLevel: 1, tags: {} }),
    encodeTileSpot({ id: 'n2', osmType: 'node', osmId: 2, cat: 'vf', name: 'Hard VF', hasRealName: true, lat: 46.65, lon: 8.15, diffLevel: 3, tags: {} }),
    encodeTileSpot({ id: 'n3', osmType: 'node', osmId: 3, cat: 'pg', name: 'Landing', hasRealName: true, lat: 46.62, lon: 8.12, diffLevel: 0, siteRole: 'landing', tags: {} })
  ];
  const store = new SpotStore({
    fetchImpl: async url => {
      if (url.endsWith('/index.json')) return { ok: true, json: async () => ({ tiles: { '44_8': { count: 3 } } }) };
      if (url.endsWith('/tiles/44_8.json')) return { ok: true, json: async () => rows };
      return { ok: false };
    }
  });

  const browse = await store.getViewportBrowseSpots(
    [46.5, 8.0, 46.8, 8.3],
    { vf: true, pg: true },
    { minDiff: 1, maxDiff: 2, includeUnrated: true, pgLaunchesOnly: true, maxSpots: 10 }
  );
  assert.equal(browse.length, 1);
  assert.equal(browse[0].id, 'n1');
});
