import { safeHttpUrl } from './geometry.js';

/**
 * Detect rough alpine/world region from coordinates for region-specific topo links.
 */
export function detectRegion(lat, lon) {
  const inSwissChamonixPocket = lat < 46.11 && lon < 6.95;
  if (!inSwissChamonixPocket && lat >= 45.82 && lat <= 47.81 && lon >= 5.96 && lon <= 10.5) return 'CH';
  if (lat >= 27.5 && lat <= 43.8 && lon >= -18.2 && lon <= 4.4) return 'ES';
  if (lat >= 41.3 && lat <= 51.1 && lon >= -5.2 && lon <= 9.6) return 'FR';
  if (lat >= 36.6 && lat <= 47.1 && lon >= 6.6 && lon <= 18.6) return 'IT';
  if (lat >= 46.35 && lat <= 49.05 && lon >= 9.5 && lon <= 17.2) return 'AT';
  if (lat >= 47.2 && lat <= 55.1 && lon >= 5.8 && lon <= 15.1) return 'DE';
  if (lat >= 45.4 && lat <= 46.9 && lon >= 13.35 && lon <= 16.6) return 'SI';
  if (lat >= 57.9 && lat <= 71.2 && lon >= 4.5 && lon <= 31.2) return 'NO';
  if (lat >= 49.8 && lat <= 60.9 && lon >= -8.7 && lon <= 1.8) return 'UK';
  if (lat >= 24.0 && lat <= 72.0 && lon >= -168.0 && lon <= -52.0) return 'USCA';
  if (lat >= -47.4 && lat <= -34.0 && lon >= 166.3 && lon <= 178.6) return 'NZ';
  if (lat >= 24.0 && lat <= 45.6 && lon >= 122.9 && lon <= 146.0) return 'JP';
  return 'GLOBAL';
}

function buildWikipediaUrl(tagVal) {
  if (!tagVal || typeof tagVal !== 'string') return null;
  if (tagVal.startsWith('http')) return safeHttpUrl(tagVal);
  const parts = tagVal.split(':');
  if (parts.length >= 2 && parts[0].length <= 5) {
    const lang = parts[0].replace(/[^a-z-]/gi, '').toLowerCase() || 'en';
    const title = encodeURIComponent(parts.slice(1).join(':').replace(/ /g, '_'));
    return `https://${lang}.wikipedia.org/wiki/${title}`;
  }
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(tagVal.replace(/ /g, '_'))}`;
}

/**
 * Generate sanitized, region-aware external topo/guide/weather links for an outdoor spot.
 * @param {object} spot
 * @returns {Array<{ label: string, url: string }>}
 */
export function getExternalLinks(spot) {
  const links = [];
  const q = encodeURIComponent(spot.name || '');
  const latStr = Number(spot.lat).toFixed(4);
  const lonStr = Number(spot.lon).toFixed(4);
  const region = detectRegion(spot.lat, spot.lon);

  const official = safeHttpUrl(spot.website);
  if (official) {
    links.push({ label: '🌐 Official', url: official });
  }

  const wiki = buildWikipediaUrl(spot.tags?.wikipedia);
  if (wiki) {
    links.push({ label: '📖 Wikipedia', url: wiki });
  }

  if (spot.cat === 'vf') {
    if (region === 'ES') {
      links.push({ label: '📘 DeAndar', url: `https://www.google.com/search?q=site:deandar.com+${q}` });
    } else if (region === 'FR') {
      links.push({ label: '📘 ViaFerrata-FR', url: `https://www.google.com/search?q=site:viaferrata-fr.net+${q}` });
      links.push({ label: '⛰️ Camptocamp', url: `https://www.camptocamp.org/waypoints?q=${q}` });
    } else if (region === 'IT') {
      links.push({ label: '📘 Ferrate365', url: `https://www.google.com/search?q=site:ferrate365.it+${q}` });
    } else if (['CH', 'AT', 'DE', 'SI'].includes(region)) {
      links.push({ label: '📘 Klettersteig.de', url: `https://www.google.com/search?q=site:klettersteig.de+${q}` });
      links.push({ label: '🏔️ Bergsteigen', url: `https://www.google.com/search?q=site:bergsteigen.com+${q}` });
    } else {
      links.push({ label: '📘 VF Topo', url: `https://www.google.com/search?q=via+ferrata+${q}+topo` });
    }
  } else if (spot.cat === 'pg') {
    links.push({ label: '🪂 PG Earth', url: `https://paraglidingearth.com/?lat=${latStr}&lng=${lonStr}&zoom=13` });
    links.push({ label: '🗺️ PG Map', url: `https://www.paraglidingmap.com/?lat=${latStr}&lng=${lonStr}&zoom=13` });
    links.push({ label: '💨 Windy', url: `https://www.windy.com/${Number(spot.lat).toFixed(3)}/${Number(spot.lon).toFixed(3)}?wind,${Number(spot.lat).toFixed(3)},${Number(spot.lon).toFixed(3)},12` });
    links.push({ label: '✈️ Airspace', url: `https://www.openaip.net/?lat=${latStr}&lon=${lonStr}&zoom=11` });
    if (region === 'CH') {
      links.push({ label: '🇨🇭 Burnair', url: `https://www.burnair.cloud/?layers=t,p&lat=${latStr}&lng=${lonStr}&z=12` });
    } else if (region === 'FR') {
      links.push({ label: '🇫🇷 SpotAir', url: `https://www.spotair.mobi/` });
    }
  } else if (spot.cat === 'cl') {
    links.push({ label: '🪨 TheCrag', url: `https://www.thecrag.com/en/climbing/world/map?lat=${latStr}&lon=${lonStr}&zoom=13` });
    links.push({ label: '🧗 27Crags', url: `https://27crags.com/crags?lat=${latStr}&lon=${lonStr}` });
    if (region === 'USCA') {
      links.push({ label: '🇺🇸 MtnProject', url: `https://www.mountainproject.com/search?q=${q}` });
    } else if (region === 'UK') {
      links.push({ label: '🇬🇧 UKClimbing', url: `https://www.ukclimbing.com/logbook/crags/?search=${q}` });
    } else if (['CH', 'FR', 'IT'].includes(region)) {
      links.push({ label: '⛰️ Camptocamp', url: `https://www.camptocamp.org/waypoints?q=${q}` });
    }
  } else if (spot.cat === 'cy') {
    links.push({ label: '💦 Descente-Canyon', url: `https://www.google.com/search?q=site:descente-canyon.com+${q}` });
    links.push({ label: '🪢 RopeWiki', url: `https://ropewiki.com/index.php?search=${q}` });
  } else if (spot.cat === 'pk') {
    if (spot.tags?.mountain_pass === 'yes') {
      links.push({ label: '🚴 Climbfinder', url: `https://www.google.com/search?q=site:climbfinder.com+${q}` });
    }
    links.push({ label: '🏔️ Peakbagger', url: `https://www.peakbagger.com/search.aspx?tid=M&ss=${q}` });
  } else if (spot.cat === 'sw') {
    links.push({ label: '♨️ Info Guide', url: `https://www.google.com/search?q=${q}+swimming+hot+spring` });
  }

  if (spot.osmType && spot.osmId) {
    links.push({ label: '🗺️ OSM', url: `https://www.openstreetmap.org/${spot.osmType}/${spot.osmId}` });
  }
  links.push({ label: '📍 GMaps', url: `https://www.google.com/maps/search/?api=1&query=${spot.lat},${spot.lon}` });
  return links;
}
