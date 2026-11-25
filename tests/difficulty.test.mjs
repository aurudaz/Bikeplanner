import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDifficulty, parseWindOrientations } from '../js/difficulty.js';

test('classifyDifficulty handles Via Ferrata K-scale, A-F, and Alpine grades', () => {
  assert.deepEqual(classifyDifficulty('vf', { via_ferrata_scale: 'K2' }), { level: 1, label: 'K2 Easy' });
  assert.deepEqual(classifyDifficulty('vf', { via_ferrata_scale: 'K4' }), { level: 2, label: 'K4 Moderate' });
  assert.deepEqual(classifyDifficulty('vf', { via_ferrata_scale: 'K6' }), { level: 3, label: 'K6 Hard' });
  assert.deepEqual(classifyDifficulty('vf', { difficulty: 'D' }), { level: 2, label: 'K4 Moderate' });
  assert.deepEqual(classifyDifficulty('vf', { difficulty: 'TD' }), { level: 3, label: 'TD Hard' });
  assert.deepEqual(classifyDifficulty('vf', {}), { level: 0, label: 'Unrated VF' });
});

test('classifyDifficulty handles French, UIAA, and YDS climbing grades', () => {
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:french:min': '5c' }).level, 1);
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:french:max': '6b+' }).level, 2);
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:french:min': '7a' }).level, 3);
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:yds:min': '5.8' }).level, 1);
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:yds:max': '5.10d' }).level, 2);
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:yds:min': '5.12a' }).level, 3);
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:uiaa:min': 'IV' }).level, 1);
  assert.equal(classifyDifficulty('cl', { 'climbing:grade:uiaa:max': 'VIII-' }).level, 3);
});

test('classifyDifficulty handles PG, passes, and wild swims', () => {
  const pg = classifyDifficulty('pg', { 'free_flying:site': 'takeoff', 'free_flying:site:orientation': 'SW', difficulty: 'beginner' });
  assert.equal(pg.level, 1);
  assert.ok(pg.label.includes('Launch (SW)'));

  const pass = classifyDifficulty('pk', { mountain_pass: 'yes', ele: '2465' });
  assert.equal(pass.level, 3);

  const spring = classifyDifficulty('sw', { natural: 'hot_spring' });
  assert.equal(spring.label, 'Hot Spring');
});

test('parseWindOrientations parses multi-direction compass tags', () => {
  assert.deepEqual(parseWindOrientations('S, SW'), [180, 225]);
  assert.deepEqual(parseWindOrientations('N-NE/ENE'), [0, 45, 67.5]);
  assert.deepEqual(parseWindOrientations('SO'), [225]);
  assert.deepEqual(parseWindOrientations('North'), []);
});
