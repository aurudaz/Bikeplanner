import { CAT_META } from './config.js';
import { formatDistance, formatElevation, haversineKm } from './geometry.js';

export class ElevationChart {
  constructor({ canvas, wrap, tooltip, onHoverPoint, onLeave }) {
    this.canvas = canvas;
    this.wrap = wrap;
    this.tooltip = tooltip;
    this.onHoverPoint = onHoverPoint;
    this.onLeave = onLeave;
    this.route = null;
    this.spots = [];
    this.stages = [];
    this.unit = 'metric';

    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => {
      this.tooltip.style.display = 'none';
      if (this.onLeave) this.onLeave();
      this.draw(-1);
    });

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.draw(-1));
      this.ro.observe(this.wrap);
    } else {
      window.addEventListener('resize', () => this.draw(-1));
    }
  }

  setData({ route, selectedSpots = [], stages = [], unit = 'metric' }) {
    this.route = route;
    this.spots = selectedSpots;
    this.stages = stages;
    this.unit = unit;
    this.draw(-1);
  }

  draw(hoverIdx = -1) {
    const r = this.route;
    if (!r || !r.profile?.length) return;

    const dpr = window.devicePixelRatio || 1;
    const w = this.wrap.clientWidth;
    const h = this.wrap.clientHeight;
    if (w < 30 || h < 30) return;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    const ctx = this.canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const padL = 44;
    const padR = 12;
    const padT = 14;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const maxD = Math.max(0.1, r.profile[r.profile.length - 1].distKm);
    const minE = Math.floor(r.minElev / 100) * 100;
    const maxE = Math.ceil((r.maxElev + 50) / 100) * 100;
    const spanE = Math.max(100, maxE - minE);

    const xOf = d => padL + (d / maxD) * plotW;
    const yOf = e => padT + plotH - ((e - minE) / spanE) * plotH;

    // Horizontal grid & Y labels
    ctx.strokeStyle = 'rgba(148,163,184,0.18)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    for (let i = 0; i <= 3; i++) {
      const eVal = minE + (spanE * i) / 3;
      const y = yOf(eVal);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(formatElevation(eVal, this.unit), 2, y + 3);
    }

    // Area fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.42)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');

    const step = Math.max(1, Math.floor(r.profile.length / 260));
    ctx.beginPath();
    ctx.moveTo(xOf(0), padT + plotH);
    for (let i = 0; i < r.profile.length; i += step) {
      ctx.lineTo(xOf(r.profile[i].distKm), yOf(r.profile[i].ele));
    }
    const last = r.profile[r.profile.length - 1];
    ctx.lineTo(xOf(last.distKm), yOf(last.ele));
    ctx.lineTo(xOf(last.distKm), padT + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Grade-colored route line
    for (let i = 0; i < r.profile.length - 1; i += step) {
      const next = Math.min(r.profile.length - 1, i + step);
      const p0 = r.profile[i];
      const p1 = r.profile[next];
      ctx.beginPath();
      ctx.moveTo(xOf(p0.distKm), yOf(p0.ele));
      ctx.lineTo(xOf(p1.distKm), yOf(p1.ele));
      const g = (p0.grade + p1.grade) / 2;
      ctx.strokeStyle = g >= 10 ? '#ef4444' : g >= 6 ? '#f97316' : '#10b981';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    // Day-stage vertical split markers
    for (const st of this.stages) {
      if (!st.endPoint) continue;
      const sx = xOf(st.endPoint[3]);
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx, padT);
      ctx.lineTo(sx, padT + plotH);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#eab308';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(`D${st.day} Camp`, Math.min(w - 52, sx + 3), padT + 10);
    }

    // Selected adventure spots plotted on profile
    for (const s of this.spots) {
      let best = r.profile[0];
      let bestD = Infinity;
      for (let i = 0; i < r.profile.length; i += step) {
        const d = haversineKm(s.lat, s.lon, r.profile[i].lat, r.profile[i].lon);
        if (d < bestD) {
          bestD = d;
          best = r.profile[i];
        }
      }
      const sx = xOf(best.distKm);
      const sy = yOf(best.ele);
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = CAT_META[s.cat]?.color || '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // X-axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    for (let i = 0; i <= 4; i++) {
      const dVal = (maxD * i) / 4;
      ctx.fillText(formatDistance(dVal, this.unit, 0), xOf(dVal) - 14, h - 5);
    }

    // Hover indicator
    if (hoverIdx >= 0 && hoverIdx < r.profile.length) {
      const pt = r.profile[hoverIdx];
      const hx = xOf(pt.distKm);
      const hy = yOf(pt.ele);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(hx, padT);
      ctx.lineTo(hx, padT + plotH);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }
  }

  handleMouseMove(e) {
    const r = this.route;
    if (!r || !r.profile?.length) return;
    const rect = this.canvas.getBoundingClientRect();
    const padL = 44;
    const padR = 12;
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left - padL) / Math.max(1, rect.width - padL - padR)));
    const targetDist = frac * r.profile[r.profile.length - 1].distKm;

    let lo = 0;
    let hi = r.profile.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (r.profile[mid].distKm < targetDist) lo = mid + 1;
      else hi = mid;
    }
    const pt = r.profile[lo];
    this.draw(lo);

    this.tooltip.style.display = 'block';
    this.tooltip.textContent =
      `${formatDistance(pt.distKm, this.unit)} · ${formatElevation(pt.ele, this.unit)} · ${pt.grade >= 0 ? '+' : ''}${pt.grade.toFixed(1)}%`;

    if (this.onHoverPoint) this.onHoverPoint(pt);
  }
}
