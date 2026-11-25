import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../js/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

test('every DOM ID referenced via $() in js/app.js exists in index.html', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');

  const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const referencedIds = [...new Set([...appJs.matchAll(/\$\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]))];

  assert.ok(referencedIds.length > 30, 'Expected many DOM references in app.js');
  for (const id of referencedIds) {
    assert.ok(htmlIds.has(id), `DOM ID "${id}" referenced in js/app.js is missing from index.html`);
  }
});

test('all local paths in index.html, manifest.webmanifest, and sw.js are relative (./) and exist on disk', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const localRefs = [...html.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(localRefs.length >= 4);

  // Ensure no root-absolute / paths slipped in for local resources
  assert.equal(/\s(?:href|src)="\/(?!\/)/.test(html), false, 'Found root-absolute path in index.html that breaks GitHub Pages subpaths');

  for (const ref of localRefs) {
    const abs = path.resolve(ROOT, ref);
    assert.ok(fs.existsSync(abs), `Local asset ${ref} does not exist on disk`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.ok(icon.src.startsWith('./'));
    assert.ok(fs.existsSync(path.resolve(ROOT, icon.src)));
  }

  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swFiles = [...sw.matchAll(/'(\.\/[^']*)'/g)].map(m => m[1]);
  for (const f of swFiles) {
    const rel = f === './' ? 'index.html' : f;
    assert.ok(fs.existsSync(path.resolve(ROOT, rel)), `Service worker asset ${f} missing on disk`);
  }
});

test('all 20 global presets have valid coordinates and modes', () => {
  assert.equal(PRESETS.length, 20);
  for (const p of PRESETS) {
    assert.ok(['p2p', 'loop'].includes(p.mode));
    assert.ok(p.start && Number.isFinite(p.start.lat) && Number.isFinite(p.start.lon));
    if (p.mode === 'p2p') {
      assert.ok(p.end && Number.isFinite(p.end.lat) && Number.isFinite(p.end.lon));
    }
  }
});
