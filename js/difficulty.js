const ALPINE_GRADE_LEVELS = { F: 1, PD: 1, AD: 2, D: 2, TD: 3, ED: 3 };

/**
 * Parse Roman numeral climbing grades (UIAA I..XI).
 */
function parseUiaaNumber(raw) {
  const map = { I: 1, V: 5, X: 10 };
  const clean = raw.toUpperCase().replace(/[^IVX]/g, '');
  if (!clean) return null;
  let total = 0;
  for (let i = 0; i < clean.length; i++) {
    const cur = map[clean[i]] || 0;
    const next = map[clean[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total > 0 ? total : null;
}

/**
 * Classify OSM outdoor spot difficulty into normalized levels:
 * 0 = unrated/informational, 1 = easy, 2 = moderate, 3 = hard.
 * @param {string} cat
 * @param {Record<string, string>} tags
 */
export function classifyDifficulty(cat, tags = {}) {
  if (cat === 'vf') {
    const raw = (tags.via_ferrata_scale || tags['via_ferrata:scale'] || tags.difficulty || '').trim().toUpperCase();
    if (!raw) return { level: 0, label: 'Unrated VF' };

    const kMatch = raw.match(/K\s*([1-6])/);
    if (kMatch) {
      const n = parseInt(kMatch[1], 10);
      return { level: n <= 2 ? 1 : n <= 4 ? 2 : 3, label: `K${n} ${n <= 2 ? 'Easy' : n <= 4 ? 'Moderate' : 'Hard'}` };
    }

    const alpineMatch = raw.match(/\b(ED|TD|AD|PD|F|D)\b/);
    if (alpineMatch && !/^[A-F]$/.test(raw)) {
      const code = alpineMatch[1];
      const level = ALPINE_GRADE_LEVELS[code] || 2;
      return { level, label: `${code} ${level === 1 ? 'Easy' : level === 2 ? 'Moderate' : 'Hard'}` };
    }

    const letterOrDigit = raw.match(/\b([1-6])\b|\b([A-F])([+-])?\b/);
    if (letterOrDigit) {
      const n = letterOrDigit[1]
        ? parseInt(letterOrDigit[1], 10)
        : 'ABCDEF'.indexOf(letterOrDigit[2]) + 1;
      const tier = n <= 2 ? 'Easy' : n <= 4 ? 'Moderate' : 'Hard';
      return { level: n <= 2 ? 1 : n <= 4 ? 2 : 3, label: `K${n} ${tier}` };
    }
    return { level: 2, label: raw };
  }

  if (cat === 'cl') {
    const fr = (tags['climbing:grade:french:min'] || tags['climbing:grade:french:max'] || '').trim().toLowerCase();
    if (fr) {
      if (/^[1-5]/.test(fr)) return { level: 1, label: `Fr ${fr.toUpperCase()} Easy` };
      if (/^6/.test(fr)) return { level: 2, label: `Fr ${fr.toUpperCase()} Mod` };
      if (/^[789]/.test(fr)) return { level: 3, label: `Fr ${fr.toUpperCase()} Hard` };
    }

    const yds = (tags['climbing:grade:yds:min'] || tags['climbing:grade:yds:max'] || tags.difficulty || '').trim();
    const ydsMatch = yds.match(/5\.(\d{1,2})([a-d])?/i);
    if (ydsMatch) {
      const num = parseInt(ydsMatch[1], 10);
      if (num <= 9) return { level: 1, label: `YDS ${ydsMatch[0]} Easy` };
      if (num <= 11) return { level: 2, label: `YDS ${ydsMatch[0]} Mod` };
      return { level: 3, label: `YDS ${ydsMatch[0]} Hard` };
    }

    const uiaa = (tags['climbing:grade:uiaa:min'] || tags['climbing:grade:uiaa:max'] || '').trim();
    if (uiaa) {
      const uNum = parseUiaaNumber(uiaa);
      if (uNum != null) {
        if (uNum <= 5) return { level: 1, label: `UIAA ${uiaa} Easy` };
        if (uNum <= 7) return { level: 2, label: `UIAA ${uiaa} Mod` };
        return { level: 3, label: `UIAA ${uiaa} Hard` };
      }
    }

    const fallback = (tags.difficulty || '').trim().toLowerCase();
    if (!fallback) return { level: 0, label: tags.climbing === 'boulder' ? 'Bouldering' : 'Unrated Crag' };
    if (/^[345]/.test(fallback) || fallback.includes('easy')) return { level: 1, label: `${fallback.toUpperCase()} Easy` };
    if (/^6/.test(fallback) || fallback.includes('mod')) return { level: 2, label: `${fallback.toUpperCase()} Mod` };
    if (/^[789]/.test(fallback) || fallback.includes('hard')) return { level: 3, label: `${fallback.toUpperCase()} Hard` };
    return { level: 2, label: fallback.toUpperCase() };
  }

  if (cat === 'pg') {
    const siteType = (tags['free_flying:site'] || '').toLowerCase();
    const orient = tags['free_flying:site:orientation'] || tags.wind_direction || '';
    const diff = (tags.difficulty || '').toLowerCase();
    const roleLabel =
      siteType === 'landing'
        ? 'Landing'
        : orient
          ? `Launch (${orient})`
          : 'Launch Site';

    if (diff.includes('easy') || diff.includes('beginner') || diff.includes('school')) {
      return { level: 1, label: `${roleLabel} · Easy` };
    }
    if (diff.includes('mod') || diff.includes('inter')) {
      return { level: 2, label: `${roleLabel} · Mod` };
    }
    if (diff.includes('hard') || diff.includes('expert') || diff.includes('advanced')) {
      return { level: 3, label: `${roleLabel} · Expert` };
    }
    return { level: 0, label: roleLabel };
  }

  if (cat === 'cy') {
    if (tags.waterway === 'waterfall') return { level: 1, label: 'Waterfall' };
    const grade = (tags['canyoning:grade'] || tags.difficulty || '').trim();
    if (!grade) return { level: 0, label: 'Canyon' };
    if (/^[12]|easy|v[12]/i.test(grade)) return { level: 1, label: `Canyon ${grade} Easy` };
    if (/^[34]|mod|v[34]/i.test(grade)) return { level: 2, label: `Canyon ${grade} Mod` };
    return { level: 3, label: `Canyon ${grade} Hard` };
  }

  if (cat === 'pk') {
    const ele = Number(tags.ele);
    const kind = tags.mountain_pass === 'yes' ? 'Pass' : 'Peak';
    if (!Number.isFinite(ele)) return { level: 0, label: kind };
    if (ele < 1500) return { level: 1, label: `${kind} ${Math.round(ele)}m` };
    if (ele < 2400) return { level: 2, label: `${kind} ${Math.round(ele)}m` };
    return { level: 3, label: `Alpine ${kind} ${Math.round(ele)}m` };
  }

  if (cat === 'sw') {
    if (tags.natural === 'hot_spring') return { level: 1, label: 'Hot Spring' };
    return { level: 1, label: 'Wild Swim' };
  }

  return { level: 0, label: 'Unrated' };
}

const COMPASS_DEG = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5
};

/**
 * Parse OSM wind orientation strings like "S, SW", "N-NE", "ESE/SE" into degree arrays.
 * @param {string|null|undefined} raw
 * @returns {number[]}
 */
export function parseWindOrientations(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const tokens = raw
    .toUpperCase()
    .split(/[\s,;/|-]+/)
    .map(t => t.trim())
    .filter(Boolean);

  const angles = [];
  for (const tok of tokens) {
    if (COMPASS_DEG[tok] != null) {
      angles.push(COMPASS_DEG[tok]);
    } else if (/^[NS]?O$/.test(tok)) {
      const mapped = tok.replace('O', 'W');
      if (COMPASS_DEG[mapped] != null) angles.push(COMPASS_DEG[mapped]);
    }
  }
  return [...new Set(angles)];
}
