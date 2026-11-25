import test from 'node:test';
import assert from 'node:assert/strict';
import { orderWaypoints2Opt, pickSpotToTrim, selectOptimalSpots } from '../js/optimizer.js';

test('selectOptimalSpots interleaves categories round-robin and preserves pinned spots', () => {
  const spots = [
    { id: 'vf1', cat: 'vf', lat: 46.6, lon: 7.9, estDetourKm: 6, distFromBase: 2.5, qualityScore: 50 },
    { id: 'vf2', cat: 'vf', lat: 46.65, lon: 8.1, estDetourKm: 8, distFromBase: 3.3, qualityScore: 48 },
    { id: 'pg1', cat: 'pg', lat: 46.63, lon: 8.3, estDetourKm: 7, distFromBase: 2.9, qualityScore: 40 },
    { id: 'pk1', cat: 'pk', lat: 46.67, lon: 8.4, estDetourKm: 9, distFromBase: 3.7, qualityScore: 35 }
  ];
  const pinnedIds = new Set(['pk1']);
  const selected = selectOptimalSpots(spots, {
    mode: 'p2p',
    targetCounts: { vf: 1, pg: 1, pk: 1 },
    budgetKm: 30,
    pinnedIds
  });

  assert.ok(selected.has('pk1'));
  assert.ok(selected.has('vf1'));
  assert.ok(selected.has('pg1'));
  assert.equal(selected.size, 3);
});

test('orderWaypoints2Opt removes crossed waypoint paths', () => {
  const start = { lat: 46.0, lon: 7.0 };
  const end = { lat: 46.0, lon: 8.0 };
  const crossed = [
    { id: 'a', lat: 46.05, lon: 7.75, progress: 0.1 }, // intentionally wrong progress
    { id: 'b', lat: 46.05, lon: 7.25, progress: 0.5 },
    { id: 'c', lat: 45.95, lon: 7.50, progress: 0.9 }
  ];
  const ordered = orderWaypoints2Opt(crossed, { mode: 'p2p', start, end });
  // Must visit west-ish 'b' (7.25) before east-ish 'a' (7.75)
  assert.ok(ordered.findIndex(x => x.id === 'b') < ordered.findIndex(x => x.id === 'a'));
});

test('pickSpotToTrim never selects a pinned spot', () => {
  const ordered = [
    { id: 'pinnedFar', distFromBase: 14, qualityScore: 10 },
    { id: 'unpinnedNear', distFromBase: 4, qualityScore: 40 }
  ];
  const victim = pickSpotToTrim(ordered, new Set(['pinnedFar']));
  assert.equal(victim.id, 'unpinnedNear');

  const noneLeft = pickSpotToTrim([{ id: 'pinnedFar', distFromBase: 14 }], new Set(['pinnedFar']));
  assert.equal(noneLeft, null);
});
