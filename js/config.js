export const APP_NAME = 'VeloVertical';
export const APP_VERSION = '2.1.0';

export const CAT_META = {
  vf: { label: 'Via Ferrata', shortLabel: 'VF', icon: '🧗', color: '#f97316', estHours: 2.5, defaultEnabled: true, defaultCount: 2 },
  pg: { label: 'Paragliding', shortLabel: 'Paraglide', icon: '🪂', color: '#38bdf8', estHours: 1.8, defaultEnabled: true, defaultCount: 1 },
  cl: { label: 'Climbing Crags', shortLabel: 'Climb', icon: '🪨', color: '#a855f7', estHours: 2.5, defaultEnabled: false, defaultCount: 1 },
  cy: { label: 'Canyoning & Falls', shortLabel: 'Canyon', icon: '💦', color: '#14b8a6', estHours: 2.0, defaultEnabled: false, defaultCount: 1 },
  pk: { label: 'Passes & Summits', shortLabel: 'Passes', icon: '🏔️', color: '#eab308', estHours: 0.6, defaultEnabled: false, defaultCount: 1 },
  sw: { label: 'Wild Swim & Hot Springs', shortLabel: 'Swim', icon: '♨️', color: '#ec4899', estHours: 1.0, defaultEnabled: false, defaultCount: 1 }
};

export const CAT_ORDER = ['vf', 'pg', 'cl', 'cy', 'pk', 'sw'];

export const BIKE_PROFILES = {
  trekking: { label: '🚲 Bikepacking / Mixed Gravel & Quiet Roads', baseSpeed: 17.5 },
  mtb: { label: '🚵 Gravel / MTB Trails & Forest Tracks', baseSpeed: 14.5 },
  'fastbike-lowtraffic': { label: '🚴 Road / Endurance (Paved, Low Traffic)', baseSpeed: 21.5 },
  safety: { label: '🛡️ Official Cycleways & Safest Paths', baseSpeed: 17.0 },
  river: { label: '🌊 Scenic Valley & River Paths (Flattest)', baseSpeed: 18.0 }
};

export const OVERPASS_MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter'
];

export const EMERGENCY_CONTACTS = [
  { code: 'CH', name: 'Switzerland (Rega / Alpine)', mountain: '1414', general: '112 / 144', bounds: [45.75, 5.9, 47.85, 10.6] },
  { code: 'AT', name: 'Austria (Bergrettung)', mountain: '140', general: '112', bounds: [46.35, 9.5, 49.05, 17.2] },
  { code: 'IT', name: 'Italy (Soccorso Alpino)', mountain: '118 / 112', general: '112', bounds: [36.6, 6.6, 47.1, 18.6] },
  { code: 'FR', name: 'France (PGHM / Mountain)', mountain: '112', general: '112 / 15', bounds: [41.3, -5.2, 51.1, 9.6] },
  { code: 'ES', name: 'Spain (GREIM / 112)', mountain: '112 / 062', general: '112', bounds: [27.5, -18.2, 43.8, 4.4] },
  { code: 'SI', name: 'Slovenia (GRS)', mountain: '112', general: '112', bounds: [45.4, 13.35, 46.9, 16.6] },
  { code: 'NO', name: 'Norway (Police / Rescue)', mountain: '112 / 113', general: '112', bounds: [57.9, 4.5, 71.2, 31.2] },
  { code: 'UK', name: 'United Kingdom (Mountain Rescue)', mountain: '999 / 112', general: '999 / 112', bounds: [49.8, -8.7, 60.9, 1.8] },
  { code: 'GR', name: 'Greece (EMAK)', mountain: '112 / 199', general: '112', bounds: [34.8, 19.3, 41.8, 29.7] },
  { code: 'DE', name: 'Germany (Bergwacht)', mountain: '112', general: '112', bounds: [47.2, 5.8, 55.1, 15.1] },
  { code: 'USCA', name: 'North America (SAR)', mountain: '911', general: '911', bounds: [24.0, -168.0, 72.0, -52.0] },
  { code: 'NZ', name: 'New Zealand (Alpine / SAR)', mountain: '111', general: '111', bounds: [-47.4, 166.3, -34.0, 178.6] },
  { code: 'JP', name: 'Japan (Mountain Police / Fire)', mountain: '110 / 119', general: '110 / 119', bounds: [24.0, 122.9, 45.6, 146.0] }
];

export const GEAR_GROUPS = {
  base: {
    title: 'Bikepacking Base Setup',
    defaultKg: 9.0,
    items: [
      { id: 'base-bags', label: 'Frame, handlebar & saddle bags + drybags', kg: 1.4 },
      { id: 'base-sleep', label: 'Ultralight tent/bivy, quilt & sleeping pad', kg: 2.3 },
      { id: 'base-tools', label: 'Multi-tool, spare tube/plugs, pump, chain link & lube', kg: 0.8 },
      { id: 'base-nav', label: 'Powerbank (10,000mAh+), headtorch & GPS mount', kg: 0.5 },
      { id: 'base-water', label: '2x 750ml bottles + water filter/tablets', kg: 1.8 },
      { id: 'base-cook', label: 'Stove, food & rain shell jacket', kg: 2.2 }
    ]
  },
  vf: {
    title: 'Via Ferrata & Trailhead Bike Security',
    defaultKg: 2.5,
    items: [
      { id: 'vf-lanyard', label: 'Via ferrata energy-absorbing lanyard set', kg: 0.55 },
      { id: 'vf-harness', label: 'Lightweight alpine harness & climbing helmet (doubles for bike!)', kg: 0.65 },
      { id: 'vf-gloves', label: 'Via ferrata gloves + approach shoes (or flat MTB shoes)', kg: 0.6 },
      { id: 'vf-lock', label: 'Heavy-duty folding/U-lock + frame cable (to leave bike at trailhead)', kg: 0.7 }
    ]
  },
  pg: {
    title: 'Hike & Fly Paragliding Kit',
    defaultKg: 4.5,
    items: [
      { id: 'pg-wing', label: 'Single-skin / ultralight hike&fly wing (~1.8–2.5 kg)', kg: 2.2 },
      { id: 'pg-harness', label: 'Ultralight string harness + ultralight reserve', kg: 1.4 },
      { id: 'pg-vario', label: 'Mini vario, radio, speedbar & EN-966 helmet', kg: 0.9 }
    ]
  },
  cl: {
    title: 'Sport Climbing / Crag Kit',
    defaultKg: 4.0,
    items: [
      { id: 'cl-rope', label: 'Lightweight 60m single rope (or 40m alpine) + rope tarp', kg: 2.4 },
      { id: 'cl-rack', label: '10–12 quickdraws, belay device, locking biners & chalk bag', kg: 1.0 },
      { id: 'cl-shoes', label: 'Climbing shoes + harness', kg: 0.6 }
    ]
  },
  cy: {
    title: 'Canyoning / Gorge Kit',
    defaultKg: 3.0,
    items: [
      { id: 'cy-wet', label: 'Shorty neoprene or waterproof shell + grip river shoes', kg: 1.5 },
      { id: 'cy-tech', label: 'Drybag, 8mm canyon rope, descender & whistle', kg: 1.5 }
    ]
  },
  sw: {
    title: 'Wild Swim / Hot Spring Kit',
    defaultKg: 0.6,
    items: [
      { id: 'sw-towel', label: 'Quick-dry microfiber towel & swimwear', kg: 0.35 },
      { id: 'sw-shoes', label: 'Ultralight water sandals / booties', kg: 0.25 }
    ]
  },
  cold: {
    title: 'High-Alpine Weather Layer (>1800m)',
    defaultKg: 0.8,
    items: [
      { id: 'cold-puffy', label: 'Packable down/synthetic puffy & warm gloves', kg: 0.55 },
      { id: 'cold-blanket', label: 'Emergency space blanket & first-aid blister kit', kg: 0.25 }
    ]
  }
};
