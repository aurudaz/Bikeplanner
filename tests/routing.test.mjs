import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBikeRoute, parseBRouterMessages } from '../js/routing.js';

test('parseBRouterMessages normalizes surfaces/ways to 100%, calculates km & cycle networks', () => {
  const messages = [
    ['Longitude', 'Latitude', 'Elevation', 'Distance', 'CostPerKm', 'ElevCost', 'TurnCost', 'NodeCost', 'InitialCost', 'WayTags', 'NodeTags'],
    ['7863200', '46686300', '568', '1000', '0', '0', '0', '0', '0', 'highway=cycleway surface=asphalt rcn=yes', ''],
    ['7873200', '46696300', '600', '2000', '0', '0', '0', '0', '0', 'highway=track tracktype=grade2', ''],
    ['7883200', '46706300', '700', '1000', '0', '0', '0', '0', '0', 'highway=path surface=dirt', '']
  ];
  const parsed = parseBRouterMessages(messages);
  assert.ok(parsed);
  const surfSum = Object.values(parsed.surfaces).reduce((a, b) => a + b, 0);
  const waySum = Object.values(parsed.ways).reduce((a, b) => a + b, 0);
  assert.equal(surfSum, 100);
  assert.equal(waySum, 100);
  assert.equal(parsed.surfacesKm.asphalt, 1.0);
  assert.equal(parsed.surfacesKm.gravel, 2.0);
  assert.equal(parsed.surfacesKm.trail, 1.0);
  assert.equal(parsed.officialCycleRoutePct, 25);
  assert.equal(parsed.segmentSurfaces.length, 3);
  assert.ok(Math.abs(parsed.segmentSurfaces[0].lat - 46.6863) < 0.001);
});

test('computeBikeRoute falls back from BRouter to OSRM + Open-Meteo cleanly', async () => {
  const calls = [];
  const mockFetch = async url => {
    calls.push(url);
    if (url.includes('brouter')) {
      return { ok: false, status: 503, text: async () => 'busy' };
    }
    if (url.includes('project-osrm.org')) {
      return {
        ok: true,
        json: async () => ({
          routes: [
            {
              geometry: {
                coordinates: [
                  [7.86, 46.68],
                  [7.9, 46.7]
                ]
              }
            }
          ]
        })
      };
    }
    if (url.includes('open-meteo.com/v1/elevation')) {
      return {
        ok: true,
        json: async () => ({ elevation: [570, 820] })
      };
    }
    return { ok: false, status: 404 };
  };

  const route = await computeBikeRoute(
    [
      { lat: 46.68, lon: 7.86 },
      { lat: 46.7, lon: 7.9 }
    ],
    'trekking',
    { fetchImpl: mockFetch, timeoutMs: 2000 }
  );

  assert.equal(route.source, 'OSRM + Open-Meteo');
  assert.equal(route.minElev, 570);
  assert.equal(route.maxElev, 820);
  assert.ok(calls.some(u => u.includes('brouter.de')));
  assert.ok(!calls.some(u => u.includes('bikerouter.de')));
  assert.ok(calls.some(u => u.includes('project-osrm.org')));
});
