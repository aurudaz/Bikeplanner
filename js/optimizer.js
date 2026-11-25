import { CAT_ORDER } from './config.js';
import { distanceToPolyline, haversineKm } from './geometry.js';

/**
 * Filter raw Overpass spots by difficulty, corridor distance, and paragliding role,
 * then score them by metadata richness vs detour distance.
 */
export function scoreAndFilterSpots(spots, {
  mode,
  baseRoute,
  start,
  mapCenter,
  radiusKm,
  budgetKm,
  minDiff = 1,
  maxDiff = 3,
  includeUnrated = true,
  pgLaunchesOnly = false,
  enabledCats
}) {
  const filtered = [];
  const hubPt = start || mapCenter;

  for (const raw of spots || []) {
    if (enabledCats && !enabledCats[raw.cat]) continue;
    if (pgLaunchesOnly && raw.cat === 'pg' && raw.siteRole === 'landing') continue;
    if (raw.diffLevel === 0 && !includeUnrated) continue;
    if (raw.diffLevel > 0 && (raw.diffLevel < minDiff || raw.diffLevel > maxDiff)) continue;

    const spot = { ...raw };

    if (mode === 'p2p' && baseRoute?.coords?.length) {
      const { distKm, progress } = distanceToPolyline(spot.lat, spot.lon, baseRoute.coords);
      if (distKm > radiusKm) continue;
      spot.distFromBase = distKm;
      spot.estDetourKm = Math.round(distKm * 2.4 * 10) / 10;
      spot.progress = progress;
    } else if (hubPt) {
      const distFromHub = haversineKm(hubPt.lat, hubPt.lon, spot.lat, spot.lon);
      const maxSearchR = mode === 'loop' ? Math.max(radiusKm, budgetKm * 0.45) : radiusKm * 2.5;
      if (distFromHub > maxSearchR) continue;
      spot.distFromBase = distFromHub;
      spot.estDetourKm = Math.round(distFromHub * 1.45 * 10) / 10;
      spot.progress = Math.atan2(spot.lat - hubPt.lat, spot.lon - hubPt.lon);
    } else {
      spot.distFromBase = 0;
      spot.estDetourKm = 0;
      spot.progress = 0;
    }

    spot.qualityScore =
      (spot.hasRealName ? 35 : 0) +
      (spot.diffLevel > 0 ? 20 : 0) +
      (spot.website ? 10 : 0) +
      (spot.ele != null ? 5 : 0) +
      (spot.orientation ? 6 : 0) +
      (spot.cat === 'pg' && spot.siteRole === 'landing' ? -18 : 0) -
      spot.distFromBase * 3.0;

    filtered.push(spot);
  }

  filtered.sort((a, b) => b.qualityScore - a.qualityScore);
  return filtered;
}

/**
 * Select a balanced multi-category set of spots respecting pinned spots,
 * requested per-category quotas, minimum spacing, and detour budget.
 * Uses round-robin interleaving across categories so one category never starves another.
 */
export function selectOptimalSpots(filteredSpots, {
  mode,
  targetCounts,
  budgetKm,
  pinnedIds = new Set()
}) {
  const selectedIds = new Set();
  const chosen = [];
  let usedBudget = 0;

  const byId = new Map(filteredSpots.map(s => [s.id, s]));

  // 1. Always preserve user-pinned spots that remain in the filtered pool
  for (const id of pinnedIds) {
    const pinned = byId.get(id);
    if (pinned) {
      chosen.push(pinned);
      selectedIds.add(pinned.id);
      usedBudget += pinned.estDetourKm;
    }
  }

  // 2. Round-robin pick across requested categories
  const catPools = {};
  const catCounts = {};
  for (const cat of CAT_ORDER) {
    catPools[cat] = filteredSpots.filter(s => s.cat === cat && !selectedIds.has(s.id));
    catCounts[cat] = chosen.filter(s => s.cat === cat).length;
  }

  let progressMade = true;
  while (progressMade) {
    progressMade = false;
    for (const cat of CAT_ORDER) {
      const want = targetCounts?.[cat] || 0;
      if (catCounts[cat] >= want) continue;

      const pool = catPools[cat];
      while (pool.length) {
        const candidate = pool.shift();
        const tooClose = chosen.some(x => haversineKm(x.lat, x.lon, candidate.lat, candidate.lon) < 1.5);
        if (tooClose && pool.length > want) continue;

        const marginalCost =
          mode === 'p2p'
            ? candidate.estDetourKm
            : chosen.length === 0
              ? candidate.distFromBase * 2.4
              : Math.min(...chosen.map(x => haversineKm(x.lat, x.lon, candidate.lat, candidate.lon))) * 1.3;

        if (usedBudget + marginalCost <= budgetKm * 1.15 || chosen.length === 0) {
          chosen.push(candidate);
          selectedIds.add(candidate.id);
          usedBudget += marginalCost;
          catCounts[cat] += 1;
          progressMade = true;
          break;
        }
      }
    }
  }

  return selectedIds;
}

function tourDistance(waypoints, isClosedLoop) {
  let sum = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    sum += haversineKm(waypoints[i].lat, waypoints[i].lon, waypoints[i + 1].lat, waypoints[i + 1].lon);
  }
  if (isClosedLoop && waypoints.length > 1) {
    const last = waypoints[waypoints.length - 1];
    sum += haversineKm(last.lat, last.lon, waypoints[0].lat, waypoints[0].lon);
  }
  return sum;
}

/**
 * Order selected spots cleanly along the route and eliminate crossings via 2-opt swaps.
 * Preserves fixed Start and End in P2P mode, and Start anchor in Loop mode.
 */
export function orderWaypoints2Opt(spots, { mode, start, end }) {
  if (!spots || spots.length <= 1) return [...(spots || [])];

  const sorted = [...spots].sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0));
  if (sorted.length < 3) return sorted;

  // For P2P with fixed start & end, optimize interior sequence; for loop, optimize closed tour anchored at start
  let tour = sorted;
  const evalCost = seq => {
    if (mode === 'p2p' && start && end) {
      return tourDistance([start, ...seq, end], false);
    }
    if (start) {
      return tourDistance([start, ...seq], true);
    }
    return tourDistance(seq, false);
  };

  let bestCost = evalCost(tour);
  let improved = true;
  let guard = 0;

  while (improved && guard < 40) {
    improved = false;
    guard++;
    for (let i = 0; i < tour.length - 1; i++) {
      for (let j = i + 1; j < tour.length; j++) {
        const candidate = [
          ...tour.slice(0, i),
          ...tour.slice(i, j + 1).reverse(),
          ...tour.slice(j + 1)
        ];
        const c = evalCost(candidate);
        if (c + 1e-6 < bestCost) {
          tour = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }
  }

  return tour;
}

/**
 * Choose the highest-detour non-pinned spot to trim when the real BRouter distance exceeds budget.
 * Returns null if all remaining spots are pinned.
 */
export function pickSpotToTrim(orderedSpots, pinnedIds = new Set()) {
  const trimmable = (orderedSpots || []).filter(s => !pinnedIds.has(s.id));
  if (!trimmable.length) return null;
  trimmable.sort((a, b) => (b.distFromBase || 0) - (a.distFromBase || 0) || (a.qualityScore || 0) - (b.qualityScore || 0));
  return trimmable[0];
}
