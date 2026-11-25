import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateSummitTemp, evaluateParaglidingWind, summarizeWeatherSafety, windDirLabel } from '../js/weather.js';

test('windDirLabel returns 8-point compass directions', () => {
  assert.equal(windDirLabel(0), 'N');
  assert.equal(windDirLabel(225), 'SW');
  assert.equal(windDirLabel(359), 'N');
});

test('evaluateParaglidingWind scores ideal, crosswind, and tailwind launches', () => {
  const spot = { cat: 'pg', orientation: 'SW', siteRole: 'takeoff' };

  const idealWx = { current: { wind_direction_10m: 220, wind_speed_10m: 12, wind_gusts_10m: 16 } };
  assert.equal(evaluateParaglidingWind(spot, idealWx).status, 'ideal');

  const crossWx = { current: { wind_direction_10m: 290, wind_speed_10m: 14, wind_gusts_10m: 19 } };
  assert.equal(evaluateParaglidingWind(spot, crossWx).status, 'caution');

  const tailwindWx = { current: { wind_direction_10m: 45, wind_speed_10m: 14, wind_gusts_10m: 19 } };
  assert.equal(evaluateParaglidingWind(spot, tailwindWx).status, 'poor');
});

test('estimateSummitTemp applies lapse rate and summarizeWeatherSafety builds 3-day outlook', () => {
  assert.equal(estimateSummitTemp(20, 500, 2500), 7);
  const summary = summarizeWeatherSafety({
    elevation: 600,
    current: { temperature_2m: 18, precipitation: 0, wind_speed_10m: 10, wind_gusts_10m: 15, wind_direction_10m: 180 },
    daily: {
      time: ['2026-07-01', '2026-07-02', '2026-07-03'],
      temperature_2m_min: [10, 11, 9],
      temperature_2m_max: [22, 23, 19],
      precipitation_probability_max: [10, 20, 65],
      wind_speed_10m_max: [12, 15, 22],
      wind_gusts_10m_max: [18, 20, 34],
      wind_direction_10m_dominant: [180, 225, 270],
      sunrise: ['2026-07-01T05:30', '2026-07-02T05:31', '2026-07-03T05:32'],
      sunset: ['2026-07-01T21:15', '2026-07-02T21:14', '2026-07-03T21:13']
    }
  }, 2600);

  assert.equal(summary.status, 'good');
  assert.equal(summary.summitTempC, 5);
  assert.equal(summary.daylight.durationLabel, '15h 45m');
  assert.equal(summary.days.length, 3);
});
