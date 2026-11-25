/**
 * Fetch helper with AbortController timeout.
 */
async function fetchJsonWithTimeout(url, timeoutMs = 8000, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Global geocoding search using Photon (Komoot Open Data) with Nominatim fallback.
 * Optional biasLatLon biases results toward the user's current map viewport.
 * @param {string} query
 * @param {{ lat: number, lon: number }|null} biasLatLon
 * @returns {Promise<Array<{ label: string, sub: string, fullName: string, lat: number, lon: number }>>}
 */
export async function geocodeSearch(query, biasLatLon = null, fetchImpl = fetch) {
  const q = String(query || '').trim();
  if (!q) return [];

  const biasParams = biasLatLon && Number.isFinite(biasLatLon.lat) && Number.isFinite(biasLatLon.lon)
    ? `&lat=${biasLatLon.lat.toFixed(4)}&lon=${biasLatLon.lon.toFixed(4)}`
    : '';

  const photon = await fetchJsonWithTimeout(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6${biasParams}`,
    8000,
    fetchImpl
  );

  if (photon && Array.isArray(photon.features) && photon.features.length) {
    return photon.features.map(f => {
      const p = f.properties || {};
      const parts = [p.city || p.town || p.village, p.state, p.country].filter(Boolean);
      const label = p.name || parts[0] || q;
      const fullName = [p.name, p.country].filter(Boolean).join(', ') || label;
      return {
        label,
        sub: parts.join(', '),
        fullName,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0]
      };
    });
  }

  const nom = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(q)}`,
    8000,
    fetchImpl
  );

  if (Array.isArray(nom)) {
    return nom.map(d => {
      const chunks = String(d.display_name || q).split(',').map(s => s.trim());
      return {
        label: chunks[0] || q,
        sub: chunks.slice(1, 3).join(', '),
        fullName: chunks.slice(0, 2).join(', '),
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon)
      };
    });
  }

  return [];
}

/**
 * Reverse geocode a coordinate into a concise human-readable place name.
 * Falls back cleanly to formatted coordinates when offline or unnamed.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lat, lon, fetchImpl = fetch) {
  const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;

  const photon = await fetchJsonWithTimeout(
    `https://photon.komoot.io/reverse?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`,
    6000,
    fetchImpl
  );
  const feat = photon?.features?.[0];
  if (feat?.properties) {
    const p = feat.properties;
    const place = p.city || p.town || p.village || p.name || p.county;
    const country = p.country;
    const joined = [place, country].filter(Boolean).join(', ');
    if (joined) return joined;
  }

  const nom = await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`,
    6000,
    fetchImpl
  );
  if (nom?.address) {
    const a = nom.address;
    const place = a.village || a.town || a.city || a.municipality || a.county || nom.name;
    const joined = [place, a.country].filter(Boolean).join(', ');
    if (joined) return joined;
  }

  return fallback;
}
