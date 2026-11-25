import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeTripHash,
  encodeTripHash,
  generateGeoJSON,
  generateGPX,
  generateTripMarkdown
} from '../js/exporters.js';

const sampleRoute = {
  distanceKm: 62.4,
  ascentM: 1850,
  descentM: 1420,
  maxElev: 2150,
  maxGradePct: 12.4,
  steepClimbKm: 4.2,
  source: 'BRouter OSM',
  surfaceBreakdown: {
    surfaces: { asphalt: 60, gravel: 30, trail: 10, other: 0 },
    ways: { cycleway: 35, quietRoad: 40, trackPath: 20, mainRoad: 5 }
  },
  coords: [
    [46.6863, 7.8632, 568],
    [46.65, 8.2, 1600],
    [46.6368, 8.594, 1444]
  ]
};

test('generateGPX produces valid escaped GPX 1.1 with spots and stage camps', () => {
  const gpx = generateGPX({
    route: sampleRoute,
    start: { name: 'Interlaken & Co', lat: 46.6863, lon: 7.8632 },
    end: { name: 'Andermatt', lat: 46.6368, lon: 8.594 },
    mode: 'p2p',
    selectedSpots: [
      {
        id: 'n1',
        cat: 'vf',
        name: 'Tierbergli <K3>',
        lat: 46.65,
        lon: 8.2,
        ele: 2000,
        diffLabel: 'K3 Moderate',
        approach: { needsHike: true, distKm: 1.4, elevGainM: 320 }
      }
    ],
    stages: [{ day: 1, distKm: 32, endPoint: [46.65, 8.2, 1600, 32] }]
  });

  assert.ok(gpx.includes('<?xml version="1.0"'));
  assert.ok(gpx.includes('Interlaken &amp; Co'));
  assert.ok(gpx.includes('Tierbergli &lt;K3&gt;'));
  assert.ok(gpx.includes('Camp Day 1'));
  assert.ok(gpx.includes('<trkpt lat="46.68630" lon="7.86320"><ele>568.0</ele></trkpt>'));
});

test('generateGeoJSON and generateTripMarkdown produce valid structured outputs', () => {
  const gj = JSON.parse(
    generateGeoJSON({
      route: sampleRoute,
      start: { name: 'Aínsa', lat: 42.4, lon: 0.1 },
      end: null,
      mode: 'loop',
      selectedSpots: [],
      stages: []
    })
  );
  assert.equal(gj.type, 'FeatureCollection');
  assert.equal(gj.features[0].geometry.type, 'LineString');

  const md = generateTripMarkdown({
    route: sampleRoute,
    start: { name: 'Aínsa', lat: 42.4, lon: 0.1 },
    end: null,
    mode: 'loop',
    selectedSpots: [],
    stages: [{ day: 1, distKm: 62.4, ascentM: 1850, totalHours: 6.5, spots: [] }]
  });
  assert.ok(md.includes('# VeloVertical Trip Sheet: Aínsa (Loop)'));
  assert.ok(md.includes('Asphalt 60%'));
});

test('encodeTripHash & decodeTripHash round-trip UTF-8 place names safely', () => {
  const payload = {
    v: 2,
    mode: 'p2p',
    start: { name: 'Aínsa & Åndalsnes', lat: 42.4173, lon: 0.1376 },
    end: { name: 'Benasque', lat: 42.605, lon: 0.5228 },
    selectedIds: ['n123']
  };
  const hash = encodeTripHash(payload);
  assert.ok(hash.startsWith('#trip='));
  const decoded = decodeTripHash(hash);
  assert.deepEqual(decoded, payload);
  assert.equal(decodeTripHash('#trip=invalid!@#'), null);
});
