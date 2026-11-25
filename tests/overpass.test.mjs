import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERPASS_MIRRORS } from '../js/config.js';
import { buildAdventureQuery, queryOverpass } from '../js/overpass.js';

test('OVERPASS_MIRRORS prioritizes private.coffee and excludes deprecated kumi.systems', () => {
  assert.equal(OVERPASS_MIRRORS[0], 'https://overpass.private.coffee/api/interpreter');
  assert.ok(!OVERPASS_MIRRORS.some(m => m.includes('kumi.systems')));
});

test('buildAdventureQuery uses compact timeout, maxsize, and fast nw selectors', () => {
  const ql = buildAdventureQuery([46.5, 7.8, 46.7, 8.2], { vf: true, pg: true, cl: false, cy: false, pk: false, sw: false });
  assert.ok(ql.startsWith('[out:json][timeout:18][maxsize:16777216];'));
  assert.ok(ql.includes('nw["highway"="via_ferrata"]'));
  assert.ok(!ql.includes('nwr['));
});

test('queryOverpass converts AbortError into a readable timeout error', async () => {
  const abortingFetch = async () => {
    const err = new Error('signal is aborted without reason');
    err.name = 'AbortError';
    throw err;
  };
  await assert.rejects(
    () => queryOverpass('[out:json];node(0,0,1,1);out;', { fetchImpl: abortingFetch, timeoutMs: 50 }),
    /Overpass mirror timed out/
  );
});
