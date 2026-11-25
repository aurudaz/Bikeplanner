import { BIKE_PROFILES, CAT_META, EMERGENCY_CONTACTS, GEAR_GROUPS } from './config.js';
import { distanceToPolyline } from './geometry.js';

const BASE_BIKE_KG = 12.0;

/**
 * Build a dynamic, categorized packing checklist based on selected activities and route elevation.
 * @param {Array<object>} selectedSpots
 * @param {object|null} route
 * @param {Record<string, boolean>} [checkedMap]
 * @param {Record<string, boolean>} [activeQuickChips]
 */
export function getActiveGearChecklist(selectedSpots = [], route = null, checkedMap = {}, activeQuickChips = null) {
  const neededGroups = new Set(['base']);
  for (const s of selectedSpots) {
    if (GEAR_GROUPS[s.cat]) neededGroups.add(s.cat);
  }
  if (activeQuickChips) {
    for (const [k, on] of Object.entries(activeQuickChips)) {
      if (on && GEAR_GROUPS[k]) neededGroups.add(k);
    }
  }
  if ((route?.maxElev ?? 0) >= 1800) {
    neededGroups.add('cold');
  }

  const groups = [];
  let gearKg = 0;

  for (const key of ['base', 'vf', 'pg', 'cl', 'cy', 'sw', 'cold']) {
    if (!neededGroups.has(key)) continue;
    const def = GEAR_GROUPS[key];
    const items = def.items.map(item => {
      const checked = checkedMap[item.id] !== undefined ? Boolean(checkedMap[item.id]) : true;
      if (checked) gearKg += item.kg;
      return { ...item, checked };
    });
    groups.push({ key, title: def.title, items });
  }

  return {
    groups,
    gearKg: Math.round(gearKg * 10) / 10,
    totalWeightKg: Math.round((BASE_BIKE_KG + gearKg) * 10) / 10
  };
}

/**
 * Estimate riding hours, activity hours, stages, water and caloric requirements.
 */
export function calcTimeEstimate(route, selectedSpots = [], profile = 'trekking', totalWeightKg = 21, maxDailyHours = 7.5) {
  if (!route) {
    return { weightKg: totalWeightKg, rideHours: 0, actHours: 0, totalHours: 0, stages: 1, waterLiters: 1.5, kcal: 0 };
  }
  const baseSpeed = BIKE_PROFILES[profile]?.baseSpeed || 17.5;
  const extraKg = Math.max(0, totalWeightKg - BASE_BIKE_KG);
  const weightPenalty = Math.max(0.72, 1 - extraKg * 0.011);

  const flatHours = route.distanceKm / (baseSpeed * weightPenalty);
  const climbHours = (route.ascentM / 550) * (1 + extraKg * 0.018);
  const rideHours = flatHours + climbHours;

  const actHours = selectedSpots.reduce((sum, s) => sum + (CAT_META[s.cat]?.estHours || 1.5), 0);
  const totalHours = rideHours + actHours;
  const stages = Math.max(1, Math.ceil(totalHours / Math.max(3, maxDailyHours)));
  const waterLiters = Math.max(1.5, Math.round((rideHours * 0.65 + actHours * 0.4) * 10) / 10);
  const kcal = Math.round(rideHours * 560 + actHours * 380);

  return {
    weightKg: Math.round(totalWeightKg * 10) / 10,
    rideHours,
    actHours,
    totalHours,
    stages,
    waterLiters,
    kcal
  };
}

/**
 * Split a route and its ordered spots into balanced daily stages based on `maxDailyHours`.
 */
export function splitIntoStages(route, orderedSpots = [], { profile = 'trekking', totalWeightKg = 21, maxDailyHours = 7.5 } = {}) {
  if (!route || !route.profile || !route.profile.length) return [];

  const est = calcTimeEstimate(route, orderedSpots, profile, totalWeightKg, maxDailyHours);
  const numDays = est.stages;
  const pts = route.profile;

  // Map each spot to its distance along the route
  const spotDists = orderedSpots.map(s => {
    const res = distanceToPolyline(s.lat, s.lon, route.coords);
    const pt = pts[res.nearestIndex] || pts[0];
    return { spot: s, distKm: pt?.distKm ?? 0 };
  });

  if (numDays === 1) {
    return [
      {
        day: 1,
        startKm: 0,
        endKm: route.distanceKm,
        distKm: Math.round(route.distanceKm * 10) / 10,
        ascentM: route.ascentM,
        descentM: route.descentM,
        rideHours: Math.round(est.rideHours * 10) / 10,
        totalHours: Math.round(est.totalHours * 10) / 10,
        spots: orderedSpots,
        endPoint: null
      }
    ];
  }

  // Compute cumulative effort units across profile points + spot activity penalties
  const baseSpeed = BIKE_PROFILES[profile]?.baseSpeed || 17.5;
  const extraKg = Math.max(0, totalWeightKg - BASE_BIKE_KG);
  const weightPenalty = Math.max(0.72, 1 - extraKg * 0.011);
  const climbFactor = 1 + extraKg * 0.018;

  const cumEffort = new Array(pts.length).fill(0);
  const spotHoursAtIdx = new Map();
  for (const item of spotDists) {
    const res = distanceToPolyline(item.spot.lat, item.spot.lon, route.coords);
    const hrs = CAT_META[item.spot.cat]?.estHours || 1.5;
    spotHoursAtIdx.set(res.nearestIndex, (spotHoursAtIdx.get(res.nearestIndex) || 0) + hrs);
  }

  for (let i = 1; i < pts.length; i++) {
    const dKm = Math.max(0, pts[i].distKm - pts[i - 1].distKm);
    const dEle = Math.max(0, pts[i].ele - pts[i - 1].ele);
    const segRideHrs = dKm / (baseSpeed * weightPenalty) + (dEle / 550) * climbFactor;
    const spotHrs = spotHoursAtIdx.get(i) || 0;
    cumEffort[i] = cumEffort[i - 1] + segRideHrs + spotHrs;
  }

  const totalEffort = Math.max(0.1, cumEffort[pts.length - 1]);
  const cutIndices = [0];
  for (let d = 1; d < numDays; d++) {
    const targetEffort = (totalEffort * d) / numDays;
    let idx = Math.min(pts.length - 1, cutIndices[cutIndices.length - 1] + 1);
    while (idx < pts.length - 2 && cumEffort[idx] < targetEffort) idx++;
    cutIndices.push(idx);
  }
  cutIndices.push(pts.length - 1);

  const stages = [];
  for (let d = 0; d < numDays; d++) {
    const i0 = cutIndices[d];
    const i1 = cutIndices[d + 1];
    const startKm = pts[i0].distKm;
    const endKm = pts[i1].distKm;

    let asc = 0;
    let desc = 0;
    for (let k = i0 + 1; k <= i1; k++) {
      const diff = pts[k].ele - pts[k - 1].ele;
      if (diff > 0.6) asc += diff;
      else if (diff < -0.6) desc += Math.abs(diff);
    }

    const daySpots = spotDists
      .filter(item =>
        d === numDays - 1
          ? item.distKm >= startKm - 0.01 && item.distKm <= endKm + 0.1
          : item.distKm >= startKm - 0.01 && item.distKm < endKm
      )
      .map(item => item.spot);

    const dayDist = Math.max(0, endKm - startKm);
    const dayRideHrs = dayDist / (baseSpeed * weightPenalty) + (asc / 550) * climbFactor;
    const dayActHrs = daySpots.reduce((s, sp) => s + (CAT_META[sp.cat]?.estHours || 1.5), 0);

    stages.push({
      day: d + 1,
      startKm: Math.round(startKm * 10) / 10,
      endKm: Math.round(endKm * 10) / 10,
      distKm: Math.round(dayDist * 10) / 10,
      ascentM: Math.round(asc),
      descentM: Math.round(desc),
      rideHours: Math.round(dayRideHrs * 10) / 10,
      totalHours: Math.round((dayRideHrs + dayActHrs) * 10) / 10,
      spots: daySpots,
      endPoint: d < numDays - 1 ? [pts[i1].lat, pts[i1].lon, Math.round(pts[i1].ele), Math.round(endKm * 10) / 10] : null
    });
  }

  return stages;
}

/**
 * Generate actionable tire width and safety advice from BRouter surface breakdown.
 */
export function getTireAdvice(surfaceBreakdown) {
  if (!surfaceBreakdown) return '';
  const { surfaces, ways } = surfaceBreakdown;
  const offroadPct = (surfaces.gravel || 0) + (surfaces.trail || 0);
  let advice = '';

  if ((surfaces.trail || 0) >= 25) {
    advice = '🛞 Setup Advice: 45–55mm+ knobby gravel or MTB tires recommended (significant steep/rough trail sections).';
  } else if (offroadPct >= 25) {
    advice = '🛞 Setup Advice: 38–45mm gravel tires ideal for mixed tarmac and alpine forest tracks.';
  } else {
    advice = '🛞 Setup Advice: 28–35mm endurance road or touring tires are plenty for this mostly paved route.';
  }

  if ((ways.mainRoad || 0) >= 25) {
    advice += ' ⚠️ Notable main-road share — pack rear light/radar & high-vis vest.';
  }
  return advice;
}

/**
 * Look up local mountain rescue phone number and OpenAIP airspace URL for coordinates.
 */
export function getEmergencyInfo(lat, lon) {
  for (const entry of EMERGENCY_CONTACTS) {
    if (entry.code === 'CH' && lat < 46.11 && lon < 6.95) continue;
    const [minLat, minLon, maxLat, maxLon] = entry.bounds;
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      return {
        ...entry,
        airspaceUrl: `https://www.openaip.net/?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=10`
      };
    }
  }
  return {
    code: 'GLOBAL',
    name: 'International Emergency',
    mountain: '112 / 911',
    general: '112 / 911',
    airspaceUrl: `https://www.openaip.net/?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=10`
  };
}
