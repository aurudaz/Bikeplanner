import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bboxSpanKm,
  buildRouteStats,
  computeApproachGap,
  distanceToPolyline,
  escapeHtml,
  formatDistance,
  formatElevation,
  getRouteBBox,
  haversineKm,
  safeHttpUrl
} from '../js/geometry.js';

test('haversineKm computes expected alpine distance', () => {
  const d = haversineKm(46.6863, 7.8632, 46.6368, 8.5940);
  assert.ok(d > 54 && d < 58, `Expected ~56 km, got ${d}`);
});

test('distanceToPolyline locates nearest point and progress', () => {
  const line = [
    [46.0, 7.0, 500],
    [46.0, 7.2, 600],
    [46.0, 7.4, 700]
  ];
  const res = distanceToPolyline(46.02, 7.2, line);
  assert.equal(res.nearestIndex, 1);
  assert.ok(res.distKm > 2.0 && res.distKm < 2.4);
  assert.equal(res.progress, 0.5);
});

test('getRouteBBox & bboxSpanKm pad accurately', () => {
  const bbox = getRouteBBox([[46.5, 7.8], [46.6, 8.0]], 10);
  assert.ok(bbox[0] < 46.5 && bbox[2] > 46.6);
  const span = bboxSpanKm(bbox);
  assert.ok(span.heightKm > 25 && span.widthKm > 25);
});

test('buildRouteStats computes ascent, descent, maxGradePct and steepClimbKm', () => {
  const coords = [
    [46.0, 7.0, 500],
    [46.005, 7.0, 560], // ~0.556 km, +60m => ~10.8% grade
    [46.010, 7.0, 540]  // -20m
  ];
  const stats = buildRouteStats(coords, null, 'Test');
  assert.equal(stats.ascentM, 60);
  assert.equal(stats.descentM, 20);
  assert.equal(stats.minElev, 500);
  assert.equal(stats.maxElev, 560);
  assert.ok(stats.maxGradePct > 9.5);
  assert.ok(stats.steepClimbKm > 0.4);
});

test('computeApproachGap detects hike required for elevated distant cliff', () => {
  const route = [
    [46.5, 7.9, 800],
    [46.51, 7.91, 820]
  ];
  const cliffSpot = { lat: 46.506, lon: 7.9, ele: 1250 };
  const gap = computeApproachGap(cliffSpot, route);
  assert.equal(gap.needsHike, true);
  assert.ok(gap.elevGainM >= 400);
  assert.ok(gap.distKm > 0.3);

  const roadsideSpot = { lat: 46.5, lon: 7.9, ele: 810 };
  const gapRoad = computeApproachGap(roadsideSpot, route);
  assert.equal(gapRoad.needsHike, false);
});

test('formatting and XSS/URL sanitization', () => {
  assert.equal(formatDistance(10, 'metric', 1), '10.0 km');
  assert.equal(formatDistance(10, 'imperial', 1), '6.2 mi');
  assert.equal(formatElevation(1000, 'imperial'), '3281 ft');
  assert.equal(escapeHtml('<script>"a"</script>'), '&lt;script&gt;&quot;a&quot;&lt;/script&gt;');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('example.com/topo'), 'https://example.com/topo');
  assert.equal(safeHttpUrl('https://deandar.com/ferrata'), 'https://deandar.com/ferrata');
});
