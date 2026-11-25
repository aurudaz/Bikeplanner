import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteStats } from '../js/geometry.js';
import { calcTimeEstimate, getActiveGearChecklist, getEmergencyInfo, getTireAdvice, splitIntoStages } from '../js/logistics.js';

test('getActiveGearChecklist adds high-alpine cold layer above 1800m and computes weight', () => {
  const checklist = getActiveGearChecklist(
    [{ cat: 'vf' }, { cat: 'pg' }],
    { maxElev: 2200 },
    {}
  );
  const keys = checklist.groups.map(g => g.key);
  assert.ok(keys.includes('base'));
  assert.ok(keys.includes('vf'));
  assert.ok(keys.includes('pg'));
  assert.ok(keys.includes('cold'));
  assert.ok(checklist.totalWeightKg > 25);
});

test('splitIntoStages splits long alpine routes into balanced multi-day stages', () => {
  const coords = [];
  for (let i = 0; i <= 20; i++) {
    coords.push([46.5 + i * 0.05, 7.8 + i * 0.05, 600 + i * 90]);
  }
  const route = buildRouteStats(coords, null, 'Test');
  const spots = [{ id: 'vf1', cat: 'vf', name: 'Test VF', lat: 46.8, lon: 8.1 }];
  const est = calcTimeEstimate(route, spots, 'trekking', 22, 6);
  const stages = splitIntoStages(route, spots, { profile: 'trekking', totalWeightKg: 22, maxDailyHours: 6 });

  assert.equal(stages.length, est.stages);
  assert.ok(stages.length >= 2);
  assert.ok(stages[0].endPoint);
  assert.equal(stages[stages.length - 1].endPoint, null);
});

test('getTireAdvice and getEmergencyInfo return expected guidance', () => {
  const advice = getTireAdvice({ surfaces: { gravel: 40, trail: 30 }, ways: { mainRoad: 30 } });
  assert.ok(advice.includes('45–55mm'));
  assert.ok(advice.includes('main-road'));

  assert.equal(getEmergencyInfo(46.68, 7.86).mountain, '1414');
  assert.equal(getEmergencyInfo(38.02, -107.67).mountain, '911');
});
