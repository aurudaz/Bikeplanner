import test from 'node:test';
import assert from 'node:assert/strict';
import { detectRegion, getExternalLinks } from '../js/externalLinks.js';

test('detectRegion maps coordinates accurately worldwide', () => {
  assert.equal(detectRegion(46.68, 7.86), 'CH');
  assert.equal(detectRegion(46.10, 7.07), 'CH');
  assert.equal(detectRegion(42.41, 0.13), 'ES');
  assert.equal(detectRegion(45.92, 6.86), 'FR');
  assert.equal(detectRegion(38.02, -107.67), 'USCA');
  assert.equal(detectRegion(36.69, 137.86), 'JP');
  assert.equal(detectRegion(-45.03, 168.66), 'NZ');
});

test('getExternalLinks produces region-specific topo links and strips unsafe URLs', () => {
  const swissPg = getExternalLinks({
    cat: 'pg',
    name: 'First',
    lat: 46.66,
    lon: 8.05,
    osmType: 'node',
    osmId: 123,
    website: 'javascript:alert(1)',
    tags: { wikipedia: 'en:Grindelwald' }
  });
  assert.ok(swissPg.some(l => l.label.includes('Burnair')));
  assert.ok(swissPg.some(l => l.label.includes('PG Earth')));
  assert.ok(swissPg.some(l => l.url === 'https://en.wikipedia.org/wiki/Grindelwald'));
  assert.ok(!swissPg.some(l => l.url.startsWith('javascript:')));

  const spanishVf = getExternalLinks({
    cat: 'vf',
    name: 'Sorrosal',
    lat: 42.61,
    lon: -0.11,
    osmType: 'way',
    osmId: 456,
    website: 'https://deandar.com/sorrosal',
    tags: {}
  });
  assert.ok(spanishVf.some(l => l.label.includes('Official')));
  assert.ok(spanishVf.some(l => l.label.includes('DeAndar')));

  const usClimb = getExternalLinks({
    cat: 'cl',
    name: 'Clear Creek',
    lat: 39.74,
    lon: -105.35,
    osmType: 'node',
    osmId: 789,
    tags: {}
  });
  assert.ok(usClimb.some(l => l.label.includes('MtnProject')));
});
