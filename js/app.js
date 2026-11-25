import {
  BIKE_PROFILES,
  CAT_META,
  CAT_ORDER,
  PRESETS,
  PRESET_REGIONS
} from './config.js';
import {
  bboxSpanKm,
  computeApproachGap,
  escapeHtml,
  formatDistance,
  formatElevation,
  formatSpeed,
  formatTemp,
  getRouteBBox
} from './geometry.js';
import { getExternalLinks } from './externalLinks.js';
import { geocodeSearch, reverseGeocode } from './geocoder.js';
import { computeBikeRoute } from './routing.js';
import { fetchAdventureSpots, fetchSupportPOIs } from './overpass.js';
import {
  orderWaypoints2Opt,
  pickSpotToTrim,
  scoreAndFilterSpots,
  selectOptimalSpots
} from './optimizer.js';
import {
  evaluateParaglidingWind,
  fetchWeather,
  summarizeWeatherSafety
} from './weather.js';
import {
  calcTimeEstimate,
  getActiveGearChecklist,
  getEmergencyInfo,
  getTireAdvice,
  splitIntoStages
} from './logistics.js';
import {
  decodeTripHash,
  deleteSavedTrip,
  encodeTripHash,
  generateGeoJSON,
  generateGPX,
  generateTripMarkdown,
  loadSavedTrips,
  saveTripToStorage
} from './exporters.js';
import { MapView } from './mapView.js';
import { ElevationChart } from './elevationChart.js';

const $ = id => document.getElementById(id);

const THEME_KEY = 'vv_theme_v1';
const UNIT_KEY = 'vv_unit_v1';
const GEAR_KEY = 'vv_gear_checked_v1';

const state = {
  mode: 'p2p', // 'p2p' | 'loop' | 'explore'
  regionFilter: 'all',
  unit: 'metric', // 'metric' | 'imperial'
  theme: 'dark', // 'dark' | 'light'
  routeColorMode: 'solid',
  start: null,
  end: null,
  picking: null, // 'start' | 'end' | null
  baseRoute: null,
  finalRoute: null,
  rawDiscoveredSpots: [],
  allSpots: [],
  selectedIds: new Set(),
  pinnedIds: new Set(),
  manualOrderIds: null, // array of spot IDs when user manually reorders
  stages: [],
  activeTab: 'selected',
  supportEnabled: new Set(),
  waymarkedEnabled: false,
  weather: null,
  gearChecked: {}
};

function loadPrefs() {
  try {
    state.theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    state.unit = localStorage.getItem(UNIT_KEY) === 'imperial' ? 'imperial' : 'metric';
    const rawGear = localStorage.getItem(GEAR_KEY);
    state.gearChecked = rawGear ? JSON.parse(rawGear) : {};
  } catch {
    state.gearChecked = {};
  }
  applyTheme();
  applyUnitButton();
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  $('themeToggleBtn').textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

function applyUnitButton() {
  $('unitToggleBtn').textContent = state.unit === 'metric' ? 'km' : 'mi';
  updateSliderLabels();
}

function setStatus(msg, isError = false) {
  const el = $('statusBar');
  if (!msg) {
    el.style.display = 'none';
    return;
  }
  el.textContent = msg;
  el.className = isError ? 'error' : '';
  el.style.display = 'block';
}

// ============================================================================
// MAP & ELEVATION CHART INSTANCES
// ============================================================================
const mapView = new MapView('map', {
  onMapClick: async latlng => {
    if (!state.picking) return;
    const target = state.picking;
    setPicking(null);
    const pt = {
      lat: +latlng.lat.toFixed(5),
      lon: +latlng.lng.toFixed(5),
      name: `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`
    };
    if (target === 'start') {
      state.start = pt;
      $('startInput').value = pt.name;
    } else {
      state.end = pt;
      $('endInput').value = pt.name;
    }
    mapView.renderEndpoints(state.start, state.end, state.mode);

    const placeName = await reverseGeocode(pt.lat, pt.lon);
    pt.name = placeName;
    if (target === 'start' && state.start === pt) $('startInput').value = placeName;
    if (target === 'end' && state.end === pt) $('endInput').value = placeName;
    mapView.renderEndpoints(state.start, state.end, state.mode);
  },
  onSpotAction: (action, spotId) => {
    if (action === 'toggle') toggleSpotOnRoute(spotId);
    else if (action === 'pin') togglePinSpot(spotId);
  }
});

const elevChart = new ElevationChart({
  canvas: $('elevCanvas'),
  wrap: $('elevWrap'),
  tooltip: $('elevTooltip'),
  onHoverPoint: pt => mapView.showHoverPoint(pt.lat, pt.lon),
  onLeave: () => mapView.clearHoverPoint()
});

// ============================================================================
// PRESETS & PROFILE DROPDOWNS
// ============================================================================
function renderPresetRegions() {
  const bar = $('presetRegionBar');
  bar.innerHTML = '';
  for (const reg of PRESET_REGIONS) {
    const btn = document.createElement('button');
    btn.className = `region-tab ${state.regionFilter === reg.id ? 'active' : ''}`;
    btn.textContent = reg.label;
    btn.addEventListener('click', () => {
      state.regionFilter = reg.id;
      renderPresetRegions();
      renderPresetList();
    });
    bar.appendChild(btn);
  }
}

function renderPresetList() {
  const container = $('presetList');
  container.innerHTML = '';
  const items = state.regionFilter === 'all'
    ? PRESETS
    : PRESETS.filter(p => p.region === state.regionFilter);

  for (const p of items) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.textContent = `${p.flag} ${p.label}`;
    btn.addEventListener('click', () => applyPreset(p, true));
    container.appendChild(btn);
  }
}

function populateBikeProfiles() {
  const sel = $('bikeProfile');
  sel.innerHTML = '';
  for (const [id, info] of Object.entries(BIKE_PROFILES)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = info.label;
    sel.appendChild(opt);
  }
}

function applyPreset(p, autoRun = true) {
  setMode(p.mode);
  state.start = p.start ? { ...p.start } : null;
  state.end = p.end ? { ...p.end } : null;
  $('startInput').value = p.start?.name || '';
  $('endInput').value = p.end?.name || '';
  $('detourSlider').value = p.detour;
  $('radiusSlider').value = p.radius;
  $('bikeProfile').value = p.profile;

  const catMap = {
    vf: ['chkVF', 'cntVF'],
    pg: ['chkPG', 'cntPG'],
    cl: ['chkCL', 'cntCL'],
    cy: ['chkCY', 'cntCY'],
    pk: ['chkPK', 'cntPK'],
    sw: ['chkSW', 'cntSW']
  };
  for (const [cat, [chkId, cntId]] of Object.entries(catMap)) {
    const cfg = p.cats?.[cat] || [false, 1];
    $(chkId).checked = Boolean(cfg[0]);
    $(cntId).value = cfg[1];
  }

  state.pinnedIds.clear();
  state.manualOrderIds = null;
  syncQuickGearChipsFromActivities();
  updateSliderLabels();
  mapView.renderEndpoints(state.start, state.end, state.mode);
  if (state.start) mapView.setView(state.start.lat, state.start.lon, 9);
  if (autoRun) runTripPlanner();
}

// ============================================================================
// MODE, INPUTS, GEOCODING & GPS
// ============================================================================
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  $('endGroup').style.display = mode === 'p2p' ? 'block' : 'none';
  $('startGroup').style.display = mode === 'explore' ? 'block' : 'block';
  $('exploreHintBox').style.display = mode === 'explore' ? 'flex' : 'none';
  $('detourSliderWrap').style.display = mode === 'explore' ? 'none' : 'block';
  $('detourLabel').textContent = mode === 'p2p' ? 'Extra Detour Budget' : 'Target Loop Distance';
  updateSliderLabels();
  mapView.renderEndpoints(state.start, state.end, state.mode);
}

function updateSliderLabels() {
  const d = parseFloat($('detourSlider').value);
  const r = parseFloat($('radiusSlider').value);
  const h = parseFloat($('dailyHoursSlider').value);
  $('detourVal').textContent = state.mode === 'p2p' ? `+${formatDistance(d, state.unit, 0)}` : `~${formatDistance(d, state.unit, 0)} loop`;
  $('radiusVal').textContent = formatDistance(r, state.unit, 0);
  $('dailyHoursVal').textContent = `${h} h/day`;
}

function setPicking(target) {
  state.picking = state.picking === target ? null : target;
  $('pickStartBtn').classList.toggle('active', state.picking === 'start');
  $('pickEndBtn').classList.toggle('active', state.picking === 'end');
  $('pickHint').textContent = state.picking ? `Click map for ${state.picking.toUpperCase()}` : '';
  mapView.setCrosshair(Boolean(state.picking));
}

function attachAutocomplete(inputEl, sugEl, onSelect) {
  let timer = null;
  inputEl.addEventListener('input', () => {
    clearTimeout(timer);
    if (inputEl === $('startInput')) state.start = null;
    else state.end = null;

    const q = inputEl.value.trim();
    if (q.length < 3) {
      sugEl.style.display = 'none';
      return;
    }
    timer = setTimeout(async () => {
      const results = await geocodeSearch(q, mapView.getCenter());
      sugEl.innerHTML = '';
      if (!results.length) {
        sugEl.style.display = 'none';
        return;
      }
      for (const item of results) {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `<strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.sub)}</small>`;
        div.addEventListener('click', () => {
          inputEl.value = item.fullName;
          sugEl.style.display = 'none';
          onSelect({ name: item.fullName, lat: item.lat, lon: item.lon });
          mapView.renderEndpoints(state.start, state.end, state.mode);
          mapView.setView(item.lat, item.lon, 10);
        });
        sugEl.appendChild(div);
      }
      sugEl.style.display = 'block';
    }, 300);
  });

  document.addEventListener('click', e => {
    if (!inputEl.contains(e.target) && !sugEl.contains(e.target)) sugEl.style.display = 'none';
  });
}

async function resolveTextEndpoints() {
  if (!state.start && $('startInput').value.trim()) {
    const r = await geocodeSearch($('startInput').value.trim(), mapView.getCenter());
    if (r[0]) state.start = { name: r[0].fullName, lat: r[0].lat, lon: r[0].lon };
  }
  if (state.mode === 'p2p' && !state.end && $('endInput').value.trim()) {
    const r = await geocodeSearch($('endInput').value.trim(), mapView.getCenter());
    if (r[0]) state.end = { name: r[0].fullName, lat: r[0].lat, lon: r[0].lon };
  }
}

function getPlannerInputs() {
  const enabledCats = {
    vf: $('chkVF').checked,
    pg: $('chkPG').checked,
    cl: $('chkCL').checked,
    cy: $('chkCY').checked,
    pk: $('chkPK').checked,
    sw: $('chkSW').checked
  };
  const targetCounts = {
    vf: enabledCats.vf ? parseInt($('cntVF').value, 10) || 0 : 0,
    pg: enabledCats.pg ? parseInt($('cntPG').value, 10) || 0 : 0,
    cl: enabledCats.cl ? parseInt($('cntCL').value, 10) || 0 : 0,
    cy: enabledCats.cy ? parseInt($('cntCY').value, 10) || 0 : 0,
    pk: enabledCats.pk ? parseInt($('cntPK').value, 10) || 0 : 0,
    sw: enabledCats.sw ? parseInt($('cntSW').value, 10) || 0 : 0
  };
  return {
    profile: $('bikeProfile').value,
    budgetKm: parseFloat($('detourSlider').value),
    radiusKm: parseFloat($('radiusSlider').value),
    maxDailyHours: parseFloat($('dailyHoursSlider').value),
    enabledCats,
    targetCounts,
    minDiff: parseInt($('minDiff').value, 10),
    maxDiff: parseInt($('maxDiff').value, 10),
    includeUnrated: $('includeUnrated').checked,
    pgLaunchesOnly: $('pgLaunchesOnly').checked
  };
}

// ============================================================================
// GEAR WEIGHT & CHECKLIST SYNC
// ============================================================================
function getActiveQuickChipsMap() {
  const map = {};
  document.querySelectorAll('#gearChips .toggle-chip').forEach(chip => {
    map[chip.dataset.gear] = chip.classList.contains('active');
  });
  return map;
}

function syncQuickGearChipsFromActivities() {
  document.querySelectorAll('#gearChips .toggle-chip').forEach(chip => {
    const g = chip.dataset.gear;
    if (g === 'vf') chip.classList.toggle('active', $('chkVF').checked);
    if (g === 'pg') chip.classList.toggle('active', $('chkPG').checked);
    if (g === 'cl') chip.classList.toggle('active', $('chkCL').checked);
  });
  updateGearWeightBadge();
}

function getEffectiveGearInfo() {
  return getActiveGearChecklist(getOrderedSelectedSpots(), state.finalRoute, state.gearChecked, getActiveQuickChipsMap());
}

function updateGearWeightBadge() {
  const info = getEffectiveGearInfo();
  $('gearWeightBadge').textContent = `${info.totalWeightKg.toFixed(1)} kg total`;
  $('gearModalWeight').textContent = `Bike + Gear: ${info.totalWeightKg.toFixed(1)} kg`;
}

function renderGearChecklistModal() {
  const info = getEffectiveGearInfo();
  const body = $('gearChecklistBody');
  body.innerHTML = '';

  for (const grp of info.groups) {
    const card = document.createElement('div');
    card.className = 'gear-group-card';
    card.innerHTML = `<h4>${escapeHtml(grp.title)}</h4>`;
    for (const item of grp.items) {
      const row = document.createElement('label');
      row.className = 'gear-item-row';
      row.innerHTML = `
        <span><input type="checkbox" ${item.checked ? 'checked' : ''} /> ${escapeHtml(item.label)}</span>
        <span class="muted-note">${item.kg.toFixed(2)} kg</span>
      `;
      row.querySelector('input').addEventListener('change', e => {
        state.gearChecked[item.id] = e.target.checked;
        try {
          localStorage.setItem(GEAR_KEY, JSON.stringify(state.gearChecked));
        } catch {}
        updateGearWeightBadge();
        if (state.finalRoute) refreshRouteAnalyticsOnly();
      });
      card.appendChild(row);
    }
    body.appendChild(card);
  }
  updateGearWeightBadge();
}

// ============================================================================
// CORE TRIP PLANNING & OPTIMIZATION PIPELINE
// ============================================================================
function getOrderedSelectedSpots() {
  const byId = new Map(state.allSpots.map(s => [s.id, s]));
  const selected = [...state.selectedIds].map(id => byId.get(id)).filter(Boolean);

  if (state.manualOrderIds && state.manualOrderIds.length) {
    const orderIdx = new Map(state.manualOrderIds.map((id, idx) => [id, idx]));
    return selected.sort((a, b) => (orderIdx.get(a.id) ?? 999) - (orderIdx.get(b.id) ?? 999));
  }

  return orderWaypoints2Opt(selected, {
    mode: state.mode,
    start: state.start,
    end: state.end
  });
}

async function scanExploreArea() {
  const bounds = mapView.getBoundsArray();
  const span = bboxSpanKm(bounds);
  if (span.widthKm > 180 || span.heightKm > 180) {
    setStatus(`Visible area is ${Math.round(span.widthKm)}×${Math.round(span.heightKm)} km — zoom in closer (<180 km) to scan Overpass safely.`, true);
    return;
  }

  const btn = $('scanMapBtn');
  btn.disabled = true;
  try {
    const cfg = getPlannerInputs();
    setStatus('Scanning visible map area across all selected sports...');
    const discovered = await fetchAdventureSpots(bounds, cfg.enabledCats);
    state.rawDiscoveredSpots = discovered;
    state.baseRoute = null;
    mapView.clearBaseRoute();

    const filtered = scoreAndFilterSpots(discovered, {
      mode: 'explore',
      baseRoute: null,
      start: state.start,
      mapCenter: mapView.getCenter(),
      radiusKm: cfg.radiusKm,
      budgetKm: cfg.budgetKm,
      minDiff: cfg.minDiff,
      maxDiff: cfg.maxDiff,
      includeUnrated: cfg.includeUnrated,
      pgLaunchesOnly: cfg.pgLaunchesOnly,
      enabledCats: cfg.enabledCats
    });
    state.allSpots = filtered;
    state.selectedIds = new Set([...state.selectedIds].filter(id => filtered.some(s => s.id === id)));
    state.activeTab = 'all';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'all'));

    mapView.renderSpots(state.allSpots, {
      selectedIds: state.selectedIds,
      pinnedIds: state.pinnedIds,
      weather: state.weather,
      unit: state.unit
    });
    renderSpotList();
    $('spotsSection').style.display = 'block';
    $('reoptimizeBtn').style.display = filtered.length ? 'block' : 'none';
    setStatus(`Discovered ${filtered.length} outdoor spots in view. Select spots to include, then click "Optimize Bike Route".`);
  } catch (err) {
    setStatus(`Scan error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

async function runTripPlanner(useCachedSpots = false) {
  const btn = $('planBtn');
  btn.disabled = true;
  try {
    const cfg = getPlannerInputs();
    if (!useCachedSpots) state.manualOrderIds = null;

    if (state.mode !== 'explore') {
      setStatus('Resolving start & destination...');
      await resolveTextEndpoints();
      if (!state.start) throw new Error('Please enter or pick a Start location.');
      if (state.mode === 'p2p' && !state.end) throw new Error('Please enter a Destination (or switch to Hub Loop / Explore Area).');
    } else if (!state.start && state.selectedIds.size === 0 && !useCachedSpots) {
      await scanExploreArea();
      return;
    }

    mapView.renderEndpoints(state.start, state.end, state.mode);

    let searchBBox;
    if (state.mode === 'p2p') {
      if (!useCachedSpots || !state.baseRoute) {
        setStatus('Computing baseline direct bike route...');
        state.baseRoute = await computeBikeRoute([state.start, state.end], cfg.profile);
        mapView.drawBaseRoute(state.baseRoute);
      }
      searchBBox = getRouteBBox(state.baseRoute.coords, cfg.radiusKm);
    } else if (state.mode === 'loop') {
      state.baseRoute = null;
      mapView.clearBaseRoute();
      const hubRadius = Math.max(cfg.radiusKm, Math.min(45, cfg.budgetKm * 0.45));
      searchBBox = getRouteBBox([[state.start.lat, state.start.lon]], hubRadius);
    } else {
      state.baseRoute = null;
      mapView.clearBaseRoute();
      searchBBox = mapView.getBoundsArray();
    }

    if (!useCachedSpots || !state.rawDiscoveredSpots.length) {
      setStatus('Querying OpenStreetMap open data (Via Ferrata, Paragliding, Climbing, Passes, Swim)...');
      state.rawDiscoveredSpots = await fetchAdventureSpots(searchBBox, cfg.enabledCats);
    }

    const filtered = scoreAndFilterSpots(state.rawDiscoveredSpots, {
      mode: state.mode,
      baseRoute: state.baseRoute,
      start: state.start,
      mapCenter: mapView.getCenter(),
      radiusKm: cfg.radiusKm,
      budgetKm: cfg.budgetKm,
      minDiff: cfg.minDiff,
      maxDiff: cfg.maxDiff,
      includeUnrated: cfg.includeUnrated,
      pgLaunchesOnly: cfg.pgLaunchesOnly,
      enabledCats: cfg.enabledCats
    });
    state.allSpots = filtered;

    if (!(state.mode === 'explore' && state.selectedIds.size > 0)) {
      state.selectedIds = selectOptimalSpots(filtered, {
        mode: state.mode,
        targetCounts: cfg.targetCounts,
        budgetKm: cfg.budgetKm,
        pinnedIds: state.pinnedIds
      });
    }

    await routeThroughSelectedSpots(state.mode !== 'explore', cfg.budgetKm);

    const midPt = state.finalRoute.coords[Math.floor(state.finalRoute.coords.length / 2)];
    fetchWeather(midPt[0], midPt[1]).then(wx => {
      if (wx) {
        state.weather = wx;
        renderWeatherAndLogistics();
        mapView.renderSpots(state.allSpots, {
          selectedIds: state.selectedIds,
          pinnedIds: state.pinnedIds,
          weather: state.weather,
          unit: state.unit
        });
        renderSpotList();
      }
    });

    if (state.supportEnabled.size > 0) refreshSupportLayer();

    $('spotsSection').style.display = 'block';
    $('reoptimizeBtn').style.display = 'block';
    $('telemetry').style.display = 'flex';
    $('analyticsDrawer').classList.add('open');
    setTimeout(() => {
      mapView.invalidateSize();
      elevChart.draw(-1);
    }, 180);

    const selCount = state.selectedIds.size;
    setStatus(
      filtered.length
        ? `Found ${filtered.length} spots · Routed through ${selCount} spot${selCount === 1 ? '' : 's'}. Click any spot to add, remove, or pin.`
        : 'Route built, but no matching spots found here. Try widening Search Radius or enabling more categories.'
    );
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

function buildWaypointsForRoute(ordered) {
  const cfg = getPlannerInputs();
  if (state.mode === 'p2p') {
    return [state.start, ...ordered, state.end];
  }
  if (state.mode === 'loop') {
    if (!ordered.length) {
      const rDeg = Math.min(0.14, (cfg.budgetKm / 4) / 111);
      return [
        state.start,
        { lat: state.start.lat + rDeg, lon: state.start.lon + rDeg * 0.6 },
        { lat: state.start.lat, lon: state.start.lon + rDeg * 1.2 },
        state.start
      ];
    }
    return [state.start, ...ordered, state.start];
  }
  // Explore mode
  if (state.start && ordered.length) return [state.start, ...ordered, state.start];
  if (ordered.length >= 2) return [...ordered, ordered[0]];
  if (ordered.length === 1 && state.start) return [state.start, ordered[0], state.start];
  throw new Error('Select at least 2 spots (or set a Start town + 1 spot) in Explore mode to build a route.');
}

async function computeRouteWithUnroutableRecovery(ordered, profile) {
  let working = [...ordered];
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const route = await computeBikeRoute(buildWaypointsForRoute(working), profile);
      return { route, working };
    } catch (err) {
      if (working.length <= 1) throw err;
      const drop = pickSpotToTrim(working, state.pinnedIds) || working[working.length - 1];
      state.selectedIds.delete(drop.id);
      working = working.filter(s => s.id !== drop.id);
      setStatus(`Skipped unroutable mountain coordinate (${drop.name}), re-routing...`);
    }
  }
  const route = await computeBikeRoute(buildWaypointsForRoute(working), profile);
  return { route, working };
}

async function routeThroughSelectedSpots(enforceBudget = false, budgetKm = 40) {
  const cfg = getPlannerInputs();
  let ordered = getOrderedSelectedSpots();

  setStatus(`Routing optimal bike path through ${ordered.length} spot${ordered.length === 1 ? '' : 's'}...`);
  let { route } = await computeRouteWithUnroutableRecovery(ordered, cfg.profile);

  // Iterative budget trimmer (up to 3 passes, never trims pinned spots)
  if (enforceBudget) {
    for (let pass = 0; pass < 3; pass++) {
      ordered = getOrderedSelectedSpots();
      if (ordered.length <= 1) break;
      const usedKm = state.mode === 'p2p' ? route.distanceKm - state.baseRoute.distanceKm : route.distanceKm;
      if (usedKm <= budgetKm * 1.15) break;

      const victim = pickSpotToTrim(ordered, state.pinnedIds);
      if (!victim) break;
      state.selectedIds.delete(victim.id);
      ordered = getOrderedSelectedSpots();
      setStatus(`Trimmed distant spot (${victim.name}) to stay inside your ${formatDistance(budgetKm, state.unit, 0)} budget...`);
      const res = await computeRouteWithUnroutableRecovery(ordered, cfg.profile);
      route = res.route;
    }
  }

  state.finalRoute = route;
  ordered = getOrderedSelectedSpots();

  // Compute hike-to-spot approach gaps for every selected spot
  for (const s of state.allSpots) {
    s.approach = state.selectedIds.has(s.id) ? computeApproachGap(s, route.coords) : null;
  }

  refreshRouteAnalyticsOnly(true);
}

function refreshRouteAnalyticsOnly(fitBounds = false) {
  if (!state.finalRoute) return;
  const cfg = getPlannerInputs();
  const ordered = getOrderedSelectedSpots();
  const gearInfo = getEffectiveGearInfo();

  state.stages = splitIntoStages(state.finalRoute, ordered, {
    profile: cfg.profile,
    totalWeightKg: gearInfo.totalWeightKg,
    maxDailyHours: cfg.maxDailyHours
  });

  mapView.drawFinalRoute(state.finalRoute, state.routeColorMode, fitBounds);
  mapView.drawApproaches(ordered, state.unit);
  mapView.drawStageMarkers(state.stages, state.unit);
  mapView.renderSpots(state.allSpots, {
    selectedIds: state.selectedIds,
    pinnedIds: state.pinnedIds,
    weather: state.weather,
    unit: state.unit
  });

  renderSpotList();
  renderStagesList();
  updateTelemetry();
  updateBudgetMeter();
  renderSurfaceAnalytics();
  renderWeatherAndLogistics();
  updateGearWeightBadge();

  elevChart.setData({
    route: state.finalRoute,
    selectedSpots: ordered,
    stages: state.stages,
    unit: state.unit
  });
}

async function toggleSpotOnRoute(spotId) {
  if (state.selectedIds.has(spotId)) {
    state.selectedIds.delete(spotId);
    state.pinnedIds.delete(spotId);
    if (state.manualOrderIds) state.manualOrderIds = state.manualOrderIds.filter(id => id !== spotId);
  } else {
    state.selectedIds.add(spotId);
    if (state.manualOrderIds) state.manualOrderIds.push(spotId);
  }

  try {
    await routeThroughSelectedSpots(false);
    $('spotsSection').style.display = 'block';
    $('telemetry').style.display = 'flex';
    $('analyticsDrawer').classList.add('open');
    setStatus(`Updated route (${state.selectedIds.size} spot${state.selectedIds.size === 1 ? '' : 's'} included).`);
  } catch (err) {
    setStatus(`Could not route via that spot: ${err.message}`, true);
  }
}

function togglePinSpot(spotId) {
  if (state.pinnedIds.has(spotId)) {
    state.pinnedIds.delete(spotId);
  } else {
    state.pinnedIds.add(spotId);
    state.selectedIds.add(spotId);
  }
  mapView.renderSpots(state.allSpots, {
    selectedIds: state.selectedIds,
    pinnedIds: state.pinnedIds,
    weather: state.weather,
    unit: state.unit
  });
  renderSpotList();
}

async function moveSpotOrder(spotId, delta) {
  const ordered = getOrderedSelectedSpots().map(s => s.id);
  const idx = ordered.indexOf(spotId);
  const next = idx + delta;
  if (idx === -1 || next < 0 || next >= ordered.length) return;
  [ordered[idx], ordered[next]] = [ordered[next], ordered[idx]];
  state.manualOrderIds = ordered;
  await routeThroughSelectedSpots(false);
}

// ============================================================================
// TELEMETRY, BUDGET METER, SURFACE, WEATHER, STAGES & SPOTS UI
// ============================================================================
function updateBudgetMeter() {
  const wrap = $('budgetMeterWrap');
  if (!state.finalRoute || state.mode === 'explore') {
    wrap.style.display = 'none';
    return;
  }
  const budgetKm = parseFloat($('detourSlider').value);
  const usedKm = state.mode === 'p2p' && state.baseRoute
    ? Math.max(0, state.finalRoute.distanceKm - state.baseRoute.distanceKm)
    : state.finalRoute.distanceKm;

  const pct = Math.min(100, Math.round((usedKm / Math.max(1, budgetKm)) * 100));
  const over = usedKm > budgetKm * 1.15;
  wrap.style.display = 'block';
  $('budgetMeterBar').style.width = `${pct}%`;
  $('budgetMeterBar').className = `budget-meter-fill ${over ? 'over' : ''}`;
  $('budgetMeterLabel').textContent = state.mode === 'p2p'
    ? `Actual detour: +${formatDistance(usedKm, state.unit)} of +${formatDistance(budgetKm, state.unit, 0)} budget`
    : `Loop length: ${formatDistance(usedKm, state.unit)} (target ~${formatDistance(budgetKm, state.unit, 0)})`;
}

function updateTelemetry() {
  const r = state.finalRoute;
  if (!r) return;
  const cfg = getPlannerInputs();
  const gearInfo = getEffectiveGearInfo();
  const ordered = getOrderedSelectedSpots();
  const est = calcTimeEstimate(r, ordered, cfg.profile, gearInfo.totalWeightKg, cfg.maxDailyHours);

  $('statDist').textContent = formatDistance(r.distanceKm, state.unit);
  if (state.baseRoute) {
    const diff = r.distanceKm - state.baseRoute.distanceKm;
    $('statDetour').textContent = diff >= 0 ? `(+${formatDistance(diff, state.unit)} vs direct)` : `(${formatDistance(diff, state.unit)})`;
  } else {
    $('statDetour').textContent = state.mode === 'loop' ? '(Loop)' : '(Explore)';
  }

  $('statElev').textContent = `↗ ${formatElevation(r.ascentM, state.unit)} ↘ ${formatElevation(r.descentM, state.unit)}`;
  $('statMaxElev').textContent = `(Max ${formatElevation(r.maxElev, state.unit)})`;
  $('statTime').textContent = `${est.rideHours.toFixed(1)}h bike` + (est.actHours > 0 ? ` + ${est.actHours.toFixed(1)}h spots` : '');
  $('statStages').textContent = `(${est.stages} day${est.stages > 1 ? 's' : ''})`;
  $('elevSummary').textContent = `${formatElevation(r.minElev, state.unit)} – ${formatElevation(r.maxElev, state.unit)} · Max ${r.maxGradePct}%`;
}

function renderSurfaceAnalytics() {
  const r = state.finalRoute;
  if (!r) return;
  $('routingSourceBadge').textContent = r.source;
  const container = $('surfaceContent');
  const advisor = $('tireAdvisor');

  if (!r.surfaceBreakdown) {
    container.innerHTML = `<div class="muted-body">Detailed OSM surface breakdown unavailable on OSRM fallback. Max grade: ${r.maxGradePct}%, >8% climbs: ${formatDistance(r.steepClimbKm, state.unit)}.</div>`;
    advisor.style.display = 'none';
    return;
  }

  const { surfaces, surfacesKm, ways, officialCycleRoutePct } = r.surfaceBreakdown;
  container.innerHTML = `
    <div class="bar-group">
      <div class="bar-label">
        <span>Surface</span>
        <span>Asphalt ${surfaces.asphalt}% (${formatDistance(surfacesKm.asphalt, state.unit)}) · Gravel ${surfaces.gravel}% · Trail ${surfaces.trail}%</span>
      </div>
      <div class="stacked-bar">
        <div class="seg" style="width:${surfaces.asphalt}%;background:#64748b;" title="Asphalt"></div>
        <div class="seg" style="width:${surfaces.gravel}%;background:#eab308;" title="Gravel"></div>
        <div class="seg" style="width:${surfaces.trail}%;background:#f97316;" title="Trail"></div>
        <div class="seg" style="width:${surfaces.other}%;background:#334155;" title="Other"></div>
      </div>
    </div>
    <div class="bar-group">
      <div class="bar-label">
        <span>Road Class</span>
        <span>Cycleway ${ways.cycleway}% · Quiet ${ways.quietRoad}% · Track ${ways.trackPath}%</span>
      </div>
      <div class="stacked-bar">
        <div class="seg" style="width:${ways.cycleway}%;background:#10b981;"></div>
        <div class="seg" style="width:${ways.quietRoad}%;background:#38bdf8;"></div>
        <div class="seg" style="width:${ways.trackPath}%;background:#f59e0b;"></div>
        <div class="seg" style="width:${ways.mainRoad}%;background:#ef4444;"></div>
      </div>
      <div class="legend-list">
        <span class="legend-item"><i class="dot" style="background:#10b981"></i>Cycleway (${officialCycleRoutePct}% signed net)</span>
        <span class="legend-item"><i class="dot" style="background:#38bdf8"></i>Quiet Rd</span>
        <span class="legend-item"><i class="dot" style="background:#f59e0b"></i>Track</span>
        <span class="legend-item"><i class="dot" style="background:#ef4444"></i>Main (${ways.mainRoad}%)</span>
        <span class="legend-item">⛰️ Max ${r.maxGradePct}% (${formatDistance(r.steepClimbKm, state.unit)} &gt;8%)</span>
      </div>
    </div>
  `;

  const advice = getTireAdvice(r.surfaceBreakdown);
  advisor.textContent = advice;
  advisor.style.display = advice ? 'block' : 'none';
}

function renderWeatherAndLogistics() {
  const r = state.finalRoute;
  if (!r) return;
  const cfg = getPlannerInputs();
  const gearInfo = getEffectiveGearInfo();
  const ordered = getOrderedSelectedSpots();
  const est = calcTimeEstimate(r, ordered, cfg.profile, gearInfo.totalWeightKg, cfg.maxDailyHours);
  const summary = summarizeWeatherSafety(state.weather, r.maxElev);

  let wxHtml = '';
  if (summary) {
    $('statWxPill').style.display = 'flex';
    $('statWxShort').textContent = `${formatTemp(summary.currentTempC, state.unit)} · ${formatSpeed(summary.windKmh, state.unit)} ${summary.windDirLabel}`;

    const summitStr = summary.summitTempC != null ? formatTemp(summary.summitTempC, state.unit) : '—';
    const daylightStr = summary.daylight ? `${summary.daylight.sunrise}–${summary.daylight.sunset} (${summary.daylight.durationLabel})` : '—';
    const daysHtml = summary.days
      .map(
        d => `
        <div class="wx-day">
          <strong>${escapeHtml(d.date.slice(5))}</strong>
          <div>${formatTemp(d.tMin, state.unit)} / ${formatTemp(d.tMax, state.unit)}</div>
          <div>🌧️ ${d.rainProb}% · 💨 ${formatSpeed(d.windMax, state.unit)} ${d.windDir}</div>
        </div>`
      )
      .join('');

    wxHtml = `
      <div class="wx-status ${summary.status}">${escapeHtml(summary.message)}</div>
      <div class="wx-grid">
        <div class="wx-box"><small>Valley / Summit (${formatElevation(r.maxElev, state.unit)})</small><strong>${formatTemp(summary.currentTempC, state.unit)} → ${summitStr}</strong></div>
        <div class="wx-box"><small>Wind / Gusts · Daylight</small><strong>${formatSpeed(summary.windKmh, state.unit)}/${formatSpeed(summary.gustsKmh, state.unit)} ${summary.windDirLabel}</strong><small>${escapeHtml(daylightStr)}</small></div>
      </div>
      <div class="wx-days">${daysHtml}</div>
    `;
  }

  $('weatherContent').innerHTML = `
    ${wxHtml}
    <div class="wx-grid" style="margin-bottom:0;">
      <div class="wx-box"><small>Bike + Gear Load</small><strong>${est.weightKg.toFixed(1)} kg · ${est.stages}d trip</strong></div>
      <div class="wx-box"><small>Est. Water / Fuel</small><strong>${est.waterLiters} L · ${est.kcal} kcal</strong></div>
    </div>
  `;

  const midPt = r.coords[Math.floor(r.coords.length / 2)];
  const emerg = getEmergencyInfo(midPt[0], midPt[1]);
  const eBox = $('emergencyBox');
  eBox.style.display = 'flex';
  eBox.innerHTML = `
    <span>🆘 <strong>${escapeHtml(emerg.name)}</strong>: Mountain <strong>${escapeHtml(emerg.mountain)}</strong></span>
    <a class="mini-btn" href="${escapeHtml(emerg.airspaceUrl)}" target="_blank" rel="noopener noreferrer">✈️ OpenAIP</a>
  `;
}

function renderSpotList() {
  const selSpots = getOrderedSelectedSpots();
  $('spotSummaryCount').textContent = `${state.allSpots.length} found`;
  $('tabSelCount').textContent = selSpots.length;
  $('tabAllCount').textContent = state.allSpots.length;

  const isStagesTab = state.activeTab === 'stages';
  $('spotList').style.display = isStagesTab ? 'none' : 'flex';
  $('spotFilterBar').style.display = isStagesTab ? 'none' : 'grid';
  $('stagesList').style.display = isStagesTab ? 'flex' : 'none';
  if (isStagesTab) {
    renderStagesList();
    return;
  }

  const q = $('spotSearchInput').value.trim().toLowerCase();
  const catFilter = $('spotCatFilter').value;
  const sortMode = $('spotSortSelect').value;

  let list = state.activeTab === 'selected' ? [...selSpots] : [...state.allSpots];
  if (q) list = list.filter(s => s.name.toLowerCase().includes(q) || s.diffLabel.toLowerCase().includes(q));
  if (catFilter !== 'all') list = list.filter(s => s.cat === catFilter);

  if (state.activeTab === 'all') {
    if (sortMode === 'closest') list.sort((a, b) => (a.distFromBase || 0) - (b.distFromBase || 0));
    else if (sortMode === 'elevation') list.sort((a, b) => (b.ele ?? -999) - (a.ele ?? -999));
    else list.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }

  const container = $('spotList');
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = '<div class="muted-body" style="padding:6px;">No spots match this filter. Try switching to "All Nearby" or clearing filters.</div>';
    return;
  }

  list.forEach((spot, idx) => {
    const isSel = state.selectedIds.has(spot.id);
    const isPinned = state.pinnedIds.has(spot.id);
    const meta = CAT_META[spot.cat];
    const diffCls = spot.diffLevel === 1 ? 'easy' : spot.diffLevel === 2 ? 'moderate' : spot.diffLevel === 3 ? 'hard' : '';
    const windInfo = spot.cat === 'pg' ? evaluateParaglidingWind(spot, state.weather) : null;

    const extLinks = getExternalLinks(spot)
      .slice(0, 3)
      .map(l => `<a class="mini-btn" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`)
      .join('');

    const card = document.createElement('div');
    card.className = `spot-card ${spot.cat} ${isSel ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="spot-head">
        <span class="spot-name">${meta.icon} ${escapeHtml(spot.name)}</span>
        <span class="badge ${diffCls}">${escapeHtml(spot.diffLabel)}</span>
      </div>
      <div class="spot-meta">
        <span>📏 +${formatDistance(spot.estDetourKm || 0, state.unit)} detour</span>
        ${spot.ele != null ? `<span>⛰️ ${formatElevation(spot.ele, state.unit)}</span>` : ''}
        ${spot.orientation ? `<span>🧭 ${escapeHtml(spot.orientation)}</span>` : ''}
        ${isSel && spot.approach?.needsHike ? `<span class="badge caution">🥾 Hike ${formatDistance(spot.approach.distKm, state.unit)} (+${formatElevation(spot.approach.elevGainM, state.unit)})</span>` : ''}
        ${windInfo && windInfo.status !== 'unknown' ? `<span class="badge ${windInfo.status}">${escapeHtml(windInfo.label)}</span>` : ''}
      </div>
      <div class="spot-actions">
        <button class="mini-btn ${isSel ? 'route-rem' : 'route-add'}" data-act="toggle">${isSel ? '✓ On Route' : '+ Add'}</button>
        <button class="mini-btn ${isPinned ? 'pin-active' : ''}" data-act="pin" title="Pin spot so optimizer keeps it">${isPinned ? '📌 Pinned' : '📌'}</button>
        ${state.activeTab === 'selected' && isSel && idx > 0 ? '<button class="mini-btn" data-act="up" title="Move earlier">↑</button>' : ''}
        ${state.activeTab === 'selected' && isSel && idx < list.length - 1 ? '<button class="mini-btn" data-act="down" title="Move later">↓</button>' : ''}
        ${extLinks}
      </div>
    `;

    card.querySelector('.spot-name').addEventListener('click', () => mapView.openSpotPopup(spot));
    card.querySelector('[data-act="toggle"]').addEventListener('click', () => toggleSpotOnRoute(spot.id));
    card.querySelector('[data-act="pin"]').addEventListener('click', () => togglePinSpot(spot.id));
    card.querySelector('[data-act="up"]')?.addEventListener('click', () => moveSpotOrder(spot.id, -1));
    card.querySelector('[data-act="down"]')?.addEventListener('click', () => moveSpotOrder(spot.id, 1));
    container.appendChild(card);
  });
}

function renderStagesList() {
  const container = $('stagesList');
  container.innerHTML = '';
  if (!state.stages.length) {
    container.innerHTML = '<div class="muted-body" style="padding:6px;">Plan a route to view daily stage breakdown.</div>';
    return;
  }
  for (const st of state.stages) {
    const card = document.createElement('div');
    card.className = 'spot-card';
    const spotLabels = st.spots.length
      ? st.spots.map(s => `${CAT_META[s.cat].icon} ${escapeHtml(s.name)}`).join(' · ')
      : 'Pure riding stage';
    card.innerHTML = `
      <div class="spot-head">
        <strong>Day ${st.day} (${formatDistance(st.startKm, state.unit)} → ${formatDistance(st.endKm, state.unit)})</strong>
        <span class="badge">${st.totalHours}h total</span>
      </div>
      <div class="spot-meta">
        <span>🛣️ ${formatDistance(st.distKm, state.unit)}</span>
        <span>↗ ${formatElevation(st.ascentM, state.unit)}</span>
        <span>↘ ${formatElevation(st.descentM, state.unit)}</span>
        <span>🚴 ${st.rideHours}h ride</span>
      </div>
      <div class="muted-body">${spotLabels}</div>
    `;
    container.appendChild(card);
  }
}

// ============================================================================
// SUPPORT LAYERS
// ============================================================================
async function refreshSupportLayer() {
  if (state.supportEnabled.size === 0 || !state.finalRoute) {
    mapView.renderSupportPOIs([]);
    return;
  }
  try {
    const bbox = getRouteBBox(state.finalRoute.coords, 4);
    const pois = await fetchSupportPOIs(bbox, state.supportEnabled);
    mapView.renderSupportPOIs(pois);
  } catch (err) {
    console.warn('Support POI error:', err);
  }
}

// ============================================================================
// SHARE, SAVE, IMPORT & EXPORT
// ============================================================================
function buildCurrentTripSnapshot() {
  const cfg = getPlannerInputs();
  return {
    v: 2,
    mode: state.mode,
    start: state.start,
    end: state.end,
    profile: cfg.profile,
    detour: cfg.budgetKm,
    radius: cfg.radiusKm,
    dailyHours: cfg.maxDailyHours,
    enabledCats: cfg.enabledCats,
    targetCounts: cfg.targetCounts,
    minDiff: cfg.minDiff,
    maxDiff: cfg.maxDiff,
    selectedIds: [...state.selectedIds],
    pinnedIds: [...state.pinnedIds]
  };
}

async function restoreTripSnapshot(snap) {
  setMode(snap.mode || 'p2p');
  state.start = snap.start || null;
  state.end = snap.end || null;
  $('startInput').value = state.start?.name || '';
  $('endInput').value = state.end?.name || '';
  if (snap.profile && BIKE_PROFILES[snap.profile]) $('bikeProfile').value = snap.profile;
  if (snap.detour) $('detourSlider').value = snap.detour;
  if (snap.radius) $('radiusSlider').value = snap.radius;
  if (snap.dailyHours) $('dailyHoursSlider').value = snap.dailyHours;

  if (snap.enabledCats) {
    $('chkVF').checked = Boolean(snap.enabledCats.vf);
    $('chkPG').checked = Boolean(snap.enabledCats.pg);
    $('chkCL').checked = Boolean(snap.enabledCats.cl);
    $('chkCY').checked = Boolean(snap.enabledCats.cy);
    $('chkPK').checked = Boolean(snap.enabledCats.pk);
    $('chkSW').checked = Boolean(snap.enabledCats.sw);
  }
  if (snap.targetCounts) {
    $('cntVF').value = snap.targetCounts.vf ?? 2;
    $('cntPG').value = snap.targetCounts.pg ?? 1;
    $('cntCL').value = snap.targetCounts.cl ?? 1;
    $('cntCY').value = snap.targetCounts.cy ?? 1;
    $('cntPK').value = snap.targetCounts.pk ?? 1;
    $('cntSW').value = snap.targetCounts.sw ?? 1;
  }
  if (snap.minDiff) $('minDiff').value = String(snap.minDiff);
  if (snap.maxDiff) $('maxDiff').value = String(snap.maxDiff);

  state.pinnedIds = new Set(snap.pinnedIds || []);
  updateSliderLabels();
  syncQuickGearChipsFromActivities();
  mapView.renderEndpoints(state.start, state.end, state.mode);
  if (state.start) mapView.setView(state.start.lat, state.start.lon, 9);

  await runTripPlanner(false);
  if (Array.isArray(snap.selectedIds) && snap.selectedIds.length) {
    const valid = snap.selectedIds.filter(id => state.allSpots.some(s => s.id === id));
    if (valid.length) {
      state.selectedIds = new Set(valid);
      await routeThroughSelectedSpots(false);
    }
  }
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(okMsg);
  } catch {
    setStatus('Copied preview ready — select text to copy manually.');
  }
}

function renderSavedTripsModal() {
  const body = $('savedTripsBody');
  const trips = loadSavedTrips();
  body.innerHTML = '';
  if (!trips.length) {
    body.innerHTML = '<div class="muted-body">No trips saved yet. Plan a route and click 💾 Save on the map bar.</div>';
    return;
  }
  for (const t of trips) {
    const card = document.createElement('div');
    card.className = 'saved-trip-card';
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(t.title || 'Saved Adventure')}</strong>
        <div class="muted-note">${escapeHtml((t.savedAt || '').slice(0, 10))} · ${formatDistance(t.distanceKm || 0, state.unit)}</div>
      </div>
      <div style="display:flex;gap:5px;">
        <button class="mini-btn route-add" data-act="load">Load</button>
        <button class="mini-btn" data-act="del">🗑️</button>
      </div>
    `;
    card.querySelector('[data-act="load"]').addEventListener('click', () => {
      $('savedModal').style.display = 'none';
      restoreTripSnapshot(t.snapshot);
    });
    card.querySelector('[data-act="del"]').addEventListener('click', () => {
      deleteSavedTrip(t.id);
      renderSavedTripsModal();
    });
    body.appendChild(card);
  }
}

function openExportModal() {
  if (!state.finalRoute) {
    setStatus('Plan a route first before exporting or sharing.', true);
    return;
  }
  const ordered = getOrderedSelectedSpots();
  const midPt = state.finalRoute.coords[Math.floor(state.finalRoute.coords.length / 2)];
  const md = generateTripMarkdown({
    route: state.finalRoute,
    start: state.start,
    end: state.end,
    mode: state.mode,
    selectedSpots: ordered,
    stages: state.stages,
    weatherSummary: summarizeWeatherSafety(state.weather, state.finalRoute.maxElev),
    emergency: getEmergencyInfo(midPt[0], midPt[1]),
    unit: state.unit
  });
  $('tripMarkdownPreview').value = md;
  $('exportModal').style.display = 'flex';
}

// ============================================================================
// UI EVENT WIRING
// ============================================================================
function wireEvents() {
  $('mobileMenuBtn').addEventListener('click', () => $('sidebar').classList.add('open'));
  $('closeSidebarBtn').addEventListener('click', () => $('sidebar').classList.remove('open'));
  $('toggleDrawerBtn').addEventListener('click', () => {
    $('analyticsDrawer').classList.toggle('open');
    setTimeout(() => {
      mapView.invalidateSize();
      elevChart.draw(-1);
    }, 200);
  });

  $('themeToggleBtn').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, state.theme);
    } catch {}
    applyTheme();
  });

  $('unitToggleBtn').addEventListener('click', () => {
    state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
    try {
      localStorage.setItem(UNIT_KEY, state.unit);
    } catch {}
    applyUnitButton();
    if (state.finalRoute) refreshRouteAnalyticsOnly(false);
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  $('detourSlider').addEventListener('input', updateSliderLabels);
  $('radiusSlider').addEventListener('input', updateSliderLabels);
  $('dailyHoursSlider').addEventListener('input', () => {
    updateSliderLabels();
    if (state.finalRoute) refreshRouteAnalyticsOnly(false);
  });

  $('pickStartBtn').addEventListener('click', () => setPicking('start'));
  $('pickEndBtn').addEventListener('click', () => setPicking('end'));
  $('swapBtn').addEventListener('click', () => {
    [state.start, state.end] = [state.end, state.start];
    $('startInput').value = state.start?.name || '';
    $('endInput').value = state.end?.name || '';
    mapView.renderEndpoints(state.start, state.end, state.mode);
  });

  $('locateMeBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported in this browser.', true);
      return;
    }
    setStatus('Locating your position...');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = +pos.coords.latitude.toFixed(5);
        const lon = +pos.coords.longitude.toFixed(5);
        const name = await reverseGeocode(lat, lon);
        state.start = { lat, lon, name };
        $('startInput').value = name;
        mapView.renderEndpoints(state.start, state.end, state.mode);
        mapView.setView(lat, lon, 11);
        setStatus(`Start set to your location (${name}).`);
      },
      err => setStatus(`GPS error: ${err.message}`, true),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  attachAutocomplete($('startInput'), $('startSuggestions'), pt => {
    state.start = pt;
  });
  attachAutocomplete($('endInput'), $('endSuggestions'), pt => {
    state.end = pt;
  });

  $('scanMapBtn').addEventListener('click', scanExploreArea);
  $('planBtn').addEventListener('click', () => runTripPlanner(false));
  $('reoptimizeBtn').addEventListener('click', () => runTripPlanner(true));

  ['chkVF', 'chkPG', 'chkCL'].forEach(id => {
    $(id).addEventListener('change', syncQuickGearChipsFromActivities);
  });

  $('gearChips').addEventListener('click', e => {
    const chip = e.target.closest('.toggle-chip');
    if (!chip) return;
    chip.classList.toggle('active');
    updateGearWeightBadge();
    if (state.finalRoute) refreshRouteAnalyticsOnly(false);
  });

  $('waymarkedChip').addEventListener('click', () => {
    state.waymarkedEnabled = !state.waymarkedEnabled;
    $('waymarkedChip').classList.toggle('active', state.waymarkedEnabled);
    mapView.toggleWaymarkedOverlay(state.waymarkedEnabled);
  });

  $('supportChips').addEventListener('click', e => {
    const chip = e.target.closest('.toggle-chip');
    if (!chip) return;
    chip.classList.toggle('active');
    const key = chip.dataset.support;
    if (chip.classList.contains('active')) state.supportEnabled.add(key);
    else state.supportEnabled.delete(key);
    refreshSupportLayer();
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderSpotList();
    });
  });

  $('spotSearchInput').addEventListener('input', renderSpotList);
  $('spotCatFilter').addEventListener('change', renderSpotList);
  $('spotSortSelect').addEventListener('change', renderSpotList);

  $('routeColorMode').addEventListener('change', e => {
    state.routeColorMode = e.target.value;
    if (state.finalRoute) mapView.drawFinalRoute(state.finalRoute, state.routeColorMode, false);
  });

  // Modals
  $('openGearModalBtn').addEventListener('click', () => {
    renderGearChecklistModal();
    $('gearModal').style.display = 'flex';
  });
  $('closeGearModalBtn').addEventListener('click', () => ($('gearModal').style.display = 'none'));

  $('openSavedModalBtn').addEventListener('click', () => {
    renderSavedTripsModal();
    $('savedModal').style.display = 'flex';
  });
  $('closeSavedModalBtn').addEventListener('click', () => ($('savedModal').style.display = 'none'));

  $('saveTripBtn').addEventListener('click', () => {
    if (!state.finalRoute) return;
    const title = `${state.start?.name || 'Custom'}${state.mode === 'p2p' && state.end ? ` → ${state.end.name}` : ' Loop'}`;
    saveTripToStorage({
      title,
      distanceKm: state.finalRoute.distanceKm,
      snapshot: buildCurrentTripSnapshot()
    });
    setStatus(`Saved "${title}" to browser storage!`);
  });

  $('exportAllTripsBtn').addEventListener('click', () => {
    const trips = loadSavedTrips();
    downloadTextFile(`velovertical-trips-${Date.now()}.json`, JSON.stringify(trips, null, 2), 'application/json');
  });

  $('importTripFile').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (item?.snapshot?.start) saveTripToStorage(item);
      }
      renderSavedTripsModal();
      setStatus(`Imported ${arr.length} trip(s).`);
    } catch {
      setStatus('Invalid trip JSON file.', true);
    }
    e.target.value = '';
  });

  $('shareUrlBtn').addEventListener('click', () => {
    const hash = encodeTripHash(buildCurrentTripSnapshot());
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, '', hash);
    copyToClipboard(url, 'Shareable trip link copied to clipboard!');
  });

  $('openExportModalBtn').addEventListener('click', openExportModal);
  $('closeExportModalBtn').addEventListener('click', () => ($('exportModal').style.display = 'none'));

  $('downloadGpxBtn').addEventListener('click', () => {
    const gpx = generateGPX({
      route: state.finalRoute,
      start: state.start,
      end: state.end,
      mode: state.mode,
      selectedSpots: getOrderedSelectedSpots(),
      stages: state.stages
    });
    downloadTextFile(`velovertical-${Date.now().toString().slice(-5)}.gpx`, gpx, 'application/gpx+xml');
  });

  $('downloadGeoJsonBtn').addEventListener('click', () => {
    const geo = generateGeoJSON({
      route: state.finalRoute,
      start: state.start,
      end: state.end,
      mode: state.mode,
      selectedSpots: getOrderedSelectedSpots(),
      stages: state.stages
    });
    downloadTextFile(`velovertical-${Date.now().toString().slice(-5)}.geojson`, geo, 'application/geo+json');
  });

  $('copyShareLinkBtn').addEventListener('click', () => {
    const hash = encodeTripHash(buildCurrentTripSnapshot());
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, '', hash);
    copyToClipboard(url, 'Shareable link copied!');
  });

  $('copyMarkdownBtn').addEventListener('click', () => {
    copyToClipboard($('tripMarkdownPreview').value, 'Markdown trip sheet copied!');
  });

  $('printTripBtn').addEventListener('click', () => window.print());

  // Close modals on backdrop click or Escape
  ['gearModal', 'savedModal', 'exportModal'].forEach(id => {
    $(id).addEventListener('click', e => {
      if (e.target === $(id)) $(id).style.display = 'none';
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (state.picking) setPicking(null);
      ['gearModal', 'savedModal', 'exportModal'].forEach(id => ($(id).style.display = 'none'));
    }
  });
}

// ============================================================================
// BOOTSTRAP
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  loadPrefs();
  populateBikeProfiles();
  renderPresetRegions();
  renderPresetList();
  wireEvents();
  updateGearWeightBadge();

  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const shared = decodeTripHash(window.location.hash);
  if (shared) {
    restoreTripSnapshot(shared);
  } else {
    applyPreset(PRESETS[0], false);
  }
});
