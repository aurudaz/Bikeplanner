export const APP_NAME = 'VeloVertical';
export const APP_VERSION = '2.0.0';

export const PRESET_REGIONS = [
  { id: 'all', label: 'All (20)' },
  { id: 'alps', label: 'Alps' },
  { id: 'iberia', label: 'Iberia' },
  { id: 'europe', label: 'Europe' },
  { id: 'world', label: 'Worldwide' }
];

export const PRESETS = [
  // Alps (7)
  {
    id: 'interlaken-andermatt',
    region: 'alps',
    flag: '🇨🇭',
    label: 'Interlaken → Andermatt',
    mode: 'p2p',
    start: { name: 'Interlaken, Switzerland', lat: 46.6863, lon: 7.8632 },
    end: { name: 'Andermatt, Switzerland', lat: 46.6368, lon: 8.5940 },
    detour: 30,
    radius: 12,
    profile: 'trekking',
    cats: { vf: [true, 2], pg: [true, 1], cl: [false, 1], cy: [false, 1], pk: [true, 1], sw: [false, 1] }
  },
  {
    id: 'lauterbrunnen-loop',
    region: 'alps',
    flag: '🇨🇭',
    label: 'Lauterbrunnen Loop',
    mode: 'loop',
    start: { name: 'Lauterbrunnen, Switzerland', lat: 46.5935, lon: 7.9091 },
    end: null,
    detour: 55,
    radius: 16,
    profile: 'mtb',
    cats: { vf: [true, 2], pg: [true, 2], cl: [false, 1], cy: [true, 1], pk: [false, 1], sw: [false, 1] }
  },
  {
    id: 'martigny-brig',
    region: 'alps',
    flag: '🇨🇭',
    label: 'Martigny → Brig',
    mode: 'p2p',
    start: { name: 'Martigny, Switzerland', lat: 46.1031, lon: 7.0728 },
    end: { name: 'Brig, Switzerland', lat: 46.3159, lon: 7.9876 },
    detour: 40,
    radius: 14,
    profile: 'trekking',
    cats: { vf: [true, 2], pg: [true, 1], cl: [true, 1], cy: [false, 1], pk: [false, 1], sw: [true, 1] }
  },
  {
    id: 'chamonix-annecy',
    region: 'alps',
    flag: '🇫🇷',
    label: 'Chamonix → Annecy',
    mode: 'p2p',
    start: { name: 'Chamonix-Mont-Blanc, France', lat: 45.9237, lon: 6.8694 },
    end: { name: 'Annecy, France', lat: 45.8992, lon: 6.1294 },
    detour: 35,
    radius: 14,
    profile: 'trekking',
    cats: { vf: [true, 2], pg: [true, 2], cl: [true, 1], cy: [false, 1], pk: [true, 1], sw: [true, 1] }
  },
  {
    id: 'cortina-arabba',
    region: 'alps',
    flag: '🇮🇹',
    label: 'Cortina → Arabba (Dolomites)',
    mode: 'p2p',
    start: { name: "Cortina d'Ampezzo, Italy", lat: 46.5405, lon: 12.1357 },
    end: { name: 'Arabba, Italy', lat: 46.4979, lon: 11.8744 },
    detour: 30,
    radius: 12,
    profile: 'gravel',
    cats: { vf: [true, 3], pg: [true, 1], cl: [true, 1], cy: [false, 1], pk: [true, 2], sw: [false, 1] }
  },
  {
    id: 'innsbruck-mayrhofen',
    region: 'alps',
    flag: '🇦🇹',
    label: 'Innsbruck → Mayrhofen (Tyrol)',
    mode: 'p2p',
    start: { name: 'Innsbruck, Austria', lat: 47.2692, lon: 11.4041 },
    end: { name: 'Mayrhofen, Austria', lat: 47.1678, lon: 11.8634 },
    detour: 35,
    radius: 14,
    profile: 'trekking',
    cats: { vf: [true, 2], pg: [true, 2], cl: [false, 1], cy: [true, 1], pk: [false, 1], sw: [false, 1] }
  },
  {
    id: 'bovec-bled',
    region: 'alps',
    flag: '🇸🇮',
    label: 'Bovec → Bled (Julian Alps)',
    mode: 'p2p',
    start: { name: 'Bovec, Slovenia', lat: 46.3375, lon: 13.5522 },
    end: { name: 'Bled, Slovenia', lat: 46.3683, lon: 14.1146 },
    detour: 35,
    radius: 15,
    profile: 'gravel',
    cats: { vf: [true, 1], pg: [true, 2], cl: [false, 1], cy: [true, 2], pk: [true, 1], sw: [true, 1] }
  },

  // Iberia & Pyrenees (5)
  {
    id: 'ainsa-benasque',
    region: 'iberia',
    flag: '🇪🇸',
    label: 'Aínsa → Benasque',
    mode: 'p2p',
    start: { name: 'Aínsa, Aragon, Spain', lat: 42.4173, lon: 0.1376 },
    end: { name: 'Benasque, Aragon, Spain', lat: 42.6050, lon: 0.5228 },
    detour: 35,
    radius: 15,
    profile: 'mtb',
    cats: { vf: [true, 2], pg: [true, 1], cl: [false, 1], cy: [true, 1], pk: [false, 1], sw: [false, 1] }
  },
  {
    id: 'berga-ripoll',
    region: 'iberia',
    flag: '🇪🇸',
    label: 'Berga → Ripoll',
    mode: 'p2p',
    start: { name: 'Berga, Catalonia, Spain', lat: 42.1043, lon: 1.8463 },
    end: { name: 'Ripoll, Catalonia, Spain', lat: 42.1997, lon: 2.1903 },
    detour: 30,
    radius: 14,
    profile: 'trekking',
    cats: { vf: [true, 2], pg: [true, 2], cl: [true, 1], cy: [false, 1], pk: [false, 1], sw: [false, 1] }
  },
  {
    id: 'ronda-chorro',
    region: 'iberia',
    flag: '🇪🇸',
    label: 'Ronda → El Chorro',
    mode: 'p2p',
    start: { name: 'Ronda, Andalusia, Spain', lat: 36.7423, lon: -5.1671 },
    end: { name: 'El Chorro, Andalusia, Spain', lat: 36.9068, lon: -4.7595 },
    detour: 30,
    radius: 14,
    profile: 'trekking',
    cats: { vf: [true, 2], pg: [true, 1], cl: [true, 2], cy: [false, 1], pk: [false, 1], sw: [false, 1] }
  },
  {
    id: 'picos-europa-loop',
    region: 'iberia',
    flag: '🇪🇸',
    label: 'Picos de Europa Loop',
    mode: 'loop',
    start: { name: 'Potes, Cantabria, Spain', lat: 43.1538, lon: -4.6234 },
    end: null,
    detour: 65,
    radius: 18,
    profile: 'gravel',
    cats: { vf: [true, 2], pg: [true, 1], cl: [true, 1], cy: [false, 1], pk: [true, 2], sw: [false, 1] }
  },
  {
    id: 'tenerife-teide-loop',
    region: 'iberia',
    flag: '🇪🇸',
    label: 'Tenerife Teide Loop',
    mode: 'loop',
    start: { name: 'La Orotava, Tenerife, Spain', lat: 28.3905, lon: -16.5236 },
    end: null,
    detour: 75,
    radius: 20,
    profile: 'fastbike-lowtraffic',
    cats: { vf: [false, 1], pg: [true, 2], cl: [true, 1], cy: [false, 1], pk: [true, 2], sw: [true, 1] }
  },

  // Europe (4)
  {
    id: 'andalsnes-geiranger',
    region: 'europe',
    flag: '🇳🇴',
    label: 'Åndalsnes → Geiranger',
    mode: 'p2p',
    start: { name: 'Åndalsnes, Norway', lat: 62.5675, lon: 7.6870 },
    end: { name: 'Geiranger, Norway', lat: 62.1008, lon: 7.2059 },
    detour: 30,
    radius: 16,
    profile: 'trekking',
    cats: { vf: [true, 1], pg: [true, 1], cl: [false, 1], cy: [true, 2], pk: [true, 1], sw: [false, 1] }
  },
  {
    id: 'corte-calvi',
    region: 'europe',
    flag: '🇫🇷',
    label: 'Corte → Calvi (Corsica)',
    mode: 'p2p',
    start: { name: 'Corte, Corsica, France', lat: 42.3094, lon: 9.1492 },
    end: { name: 'Calvi, Corsica, France', lat: 42.5669, lon: 8.7571 },
    detour: 40,
    radius: 16,
    profile: 'gravel',
    cats: { vf: [true, 1], pg: [true, 1], cl: [true, 1], cy: [true, 1], pk: [true, 1], sw: [true, 1] }
  },
  {
    id: 'meteora-vikos',
    region: 'europe',
    flag: '🇬🇷',
    label: 'Meteora → Vikos Gorge',
    mode: 'p2p',
    start: { name: 'Kalabaka (Meteora), Greece', lat: 39.7061, lon: 21.6269 },
    end: { name: 'Monodendri (Vikos), Greece', lat: 39.8825, lon: 20.7478 },
    detour: 35,
    radius: 18,
    profile: 'gravel',
    cats: { vf: [false, 1], pg: [true, 1], cl: [true, 2], cy: [false, 1], pk: [true, 1], sw: [true, 1] }
  },
  {
    id: 'fortwilliam-aviemore',
    region: 'europe',
    flag: '🇬🇧',
    label: 'Fort William → Aviemore',
    mode: 'p2p',
    start: { name: 'Fort William, Scotland, UK', lat: 56.8198, lon: -5.1052 },
    end: { name: 'Aviemore, Scotland, UK', lat: 57.1897, lon: -3.8293 },
    detour: 35,
    radius: 16,
    profile: 'gravel',
    cats: { vf: [true, 1], pg: [true, 1], cl: [true, 1], cy: [true, 1], pk: [true, 1], sw: [true, 1] }
  },

  // Worldwide (4)
  {
    id: 'ouray-telluride',
    region: 'world',
    flag: '🇺🇸',
    label: 'Ouray → Telluride (CO)',
    mode: 'p2p',
    start: { name: 'Ouray, Colorado, USA', lat: 38.0228, lon: -107.6714 },
    end: { name: 'Telluride, Colorado, USA', lat: 37.9375, lon: -107.8123 },
    detour: 35,
    radius: 16,
    profile: 'mtb',
    cats: { vf: [true, 2], pg: [true, 1], cl: [true, 1], cy: [false, 1], pk: [true, 2], sw: [true, 1] }
  },
  {
    id: 'squamish-whistler',
    region: 'world',
    flag: '🇨🇦',
    label: 'Squamish → Whistler (BC)',
    mode: 'p2p',
    start: { name: 'Squamish, BC, Canada', lat: 49.7016, lon: -123.1558 },
    end: { name: 'Whistler, BC, Canada', lat: 50.1163, lon: -122.9574 },
    detour: 30,
    radius: 15,
    profile: 'gravel',
    cats: { vf: [true, 1], pg: [true, 1], cl: [true, 2], cy: [true, 1], pk: [false, 1], sw: [true, 1] }
  },
  {
    id: 'queenstown-wanaka',
    region: 'world',
    flag: '🇳🇿',
    label: 'Queenstown → Wanaka',
    mode: 'p2p',
    start: { name: 'Queenstown, New Zealand', lat: -45.0312, lon: 168.6626 },
    end: { name: 'Wanaka, New Zealand', lat: -44.7032, lon: 169.1321 },
    detour: 35,
    radius: 16,
    profile: 'gravel',
    cats: { vf: [true, 1], pg: [true, 2], cl: [true, 1], cy: [false, 1], pk: [true, 1], sw: [true, 1] }
  },
  {
    id: 'matsumoto-hakuba',
    region: 'world',
    flag: '🇯🇵',
    label: 'Matsumoto → Hakuba (JP Alps)',
    mode: 'p2p',
    start: { name: 'Matsumoto, Nagano, Japan', lat: 36.2380, lon: 137.9720 },
    end: { name: 'Hakuba, Nagano, Japan', lat: 36.6982, lon: 137.8619 },
    detour: 30,
    radius: 15,
    profile: 'trekking',
    cats: { vf: [false, 1], pg: [true, 2], cl: [false, 1], cy: [true, 1], pk: [true, 1], sw: [true, 2] }
  }
];

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
  trekking: { label: '🚲 Bikepacking / Trekking (Balanced paths & quiet roads)', baseSpeed: 17.5, preferServer: 'brouter' },
  gravel: { label: '🪨 Gravel / All-Road (Compacted tracks & dirt lanes)', baseSpeed: 16.5, preferServer: 'bikerouter' },
  mtb: { label: '🚵 MTB / Alpine Trails (Singletrack & rough gravel)', baseSpeed: 14.0, preferServer: 'brouter' },
  'fastbike-lowtraffic': { label: '🚴 Road / Endurance (Paved, low traffic)', baseSpeed: 21.5, preferServer: 'brouter' },
  safety: { label: '🛡️ Cycleways & EuroVelo Priority (Safest)', baseSpeed: 17.0, preferServer: 'brouter' },
  river: { label: '🌊 Scenic Valley / River Paths (Flattest & car-free)', baseSpeed: 18.0, preferServer: 'brouter' }
};

export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
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
