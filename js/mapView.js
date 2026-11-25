import { CAT_META } from './config.js';
import { escapeHtml, formatDistance, formatElevation } from './geometry.js';
import { getExternalLinks } from './externalLinks.js';
import { evaluateParaglidingWind } from './weather.js';

const SURFACE_COLORS = {
  asphalt: '#64748b',
  gravel: '#eab308',
  trail: '#f97316',
  other: '#94a3b8'
};

function gradeColor(gradePct) {
  if (gradePct >= 11) return '#ef4444';
  if (gradePct >= 7) return '#f97316';
  if (gradePct >= 3) return '#eab308';
  if (gradePct <= -6) return '#38bdf8';
  return '#10b981';
}

export class MapView {
  constructor(elementId, { onMapClick, onSpotAction }) {
    this.onSpotAction = onSpotAction;
    this.map = L.map(elementId, { zoomControl: false }).setView([46.65, 8.2], 6);
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.tileLayers = {
      'CyclOSM (Best for Bike)': L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '© OpenStreetMap, CyclOSM'
      }),
      'OpenTopoMap (Terrain)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '© OpenStreetMap, SRTM, OpenTopoMap'
      }),
      OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }),
      'Satellite (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '© Esri, Maxar'
      })
    };
    this.tileLayers['CyclOSM (Best for Bike)'].addTo(this.map);

    this.waymarkedLayer = L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
      maxZoom: 18,
      opacity: 0.78,
      attribution: '© Waymarked Trails, OSM'
    });

    L.control.layers(this.tileLayers, { 'Official Bike Routes (Waymarked)': this.waymarkedLayer }, { position: 'topright' }).addTo(this.map);

    this.layers = {
      baseRoute: L.layerGroup().addTo(this.map),
      finalRoute: L.layerGroup().addTo(this.map),
      approaches: L.layerGroup().addTo(this.map),
      stages: L.layerGroup().addTo(this.map),
      endpoints: L.layerGroup().addTo(this.map),
      spots: L.layerGroup().addTo(this.map),
      support: L.layerGroup().addTo(this.map),
      hover: L.layerGroup().addTo(this.map)
    };

    this.spotMarkers = new Map();
    this.hoverDot = L.circleMarker([0, 0], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#38bdf8',
      fillOpacity: 1
    });

    if (onMapClick) {
      this.map.on('click', e => onMapClick(e.latlng));
    }

    // Bind popup button actions safely without inline onclick attributes
    this.map.on('popupopen', e => {
      const root = e.popup.getElement();
      if (!root) return;
      root.querySelectorAll('[data-spot-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.spotAction;
          const spotId = btn.dataset.spotId;
          if (this.onSpotAction) this.onSpotAction(action, spotId);
        });
      });
    });
  }

  toggleWaymarkedOverlay(enabled) {
    if (enabled) {
      if (!this.map.hasLayer(this.waymarkedLayer)) this.waymarkedLayer.addTo(this.map);
    } else if (this.map.hasLayer(this.waymarkedLayer)) {
      this.map.removeLayer(this.waymarkedLayer);
    }
  }

  getCenter() {
    const c = this.map.getCenter();
    return { lat: c.lat, lon: c.lng };
  }

  getBoundsArray() {
    const b = this.map.getBounds();
    return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
  }

  setView(lat, lon, zoom = 12) {
    this.map.setView([lat, lon], zoom);
  }

  panTo(lat, lon) {
    this.map.panTo([lat, lon]);
  }

  setCrosshair(active) {
    this.map.getContainer().style.cursor = active ? 'crosshair' : '';
  }

  invalidateSize() {
    this.map.invalidateSize();
  }

  showHoverPoint(lat, lon) {
    this.hoverDot.setLatLng([lat, lon]);
    if (!this.layers.hover.hasLayer(this.hoverDot)) {
      this.layers.hover.addLayer(this.hoverDot);
    }
  }

  clearHoverPoint() {
    this.layers.hover.clearLayers();
  }

  openSpotPopup(spot) {
    this.map.setView([spot.lat, spot.lon], Math.max(13, this.map.getZoom()));
    const mk = this.spotMarkers.get(spot.id);
    if (mk) mk.openPopup();
  }

  renderEndpoints(start, end, mode) {
    this.layers.endpoints.clearLayers();
    if (start) {
      L.marker([start.lat, start.lon], {
        icon: L.divIcon({
          className: '',
          html: '<div class="custom-pin" style="width:28px;height:28px;background:#10b981;font-size:14px;">🚩</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      })
        .bindPopup(`<strong>Start:</strong> ${escapeHtml(start.name)}`)
        .addTo(this.layers.endpoints);
    }
    if (mode === 'p2p' && end) {
      L.marker([end.lat, end.lon], {
        icon: L.divIcon({
          className: '',
          html: '<div class="custom-pin" style="width:28px;height:28px;background:#ef4444;font-size:14px;">🏁</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      })
        .bindPopup(`<strong>Destination:</strong> ${escapeHtml(end.name)}`)
        .addTo(this.layers.endpoints);
    }
  }

  drawBaseRoute(route) {
    this.layers.baseRoute.clearLayers();
    if (!route?.coords?.length) return;
    const latlngs = route.coords.map(c => [c[0], c[1]]);
    L.polyline(latlngs, { color: '#94a3b8', weight: 3, dashArray: '7 7', opacity: 0.7 }).addTo(this.layers.baseRoute);
  }

  clearBaseRoute() {
    this.layers.baseRoute.clearLayers();
  }

  drawFinalRoute(route, colorMode = 'solid', fitBounds = true) {
    this.layers.finalRoute.clearLayers();
    if (!route?.coords?.length) return;
    const latlngs = route.coords.map(c => [c[0], c[1]]);
    L.polyline(latlngs, { color: '#0f172a', weight: 7.5, opacity: 0.5 }).addTo(this.layers.finalRoute);

    if (colorMode === 'gradient' && route.profile?.length > 2) {
      const step = Math.max(1, Math.floor(route.profile.length / 280));
      for (let i = 0; i < route.profile.length - 1; i += step) {
        const nextIdx = Math.min(route.profile.length - 1, i + step);
        const segCoords = route.profile.slice(i, nextIdx + 1).map(p => [p.lat, p.lon]);
        const avgGrade = (route.profile[i].grade + route.profile[nextIdx].grade) / 2;
        L.polyline(segCoords, { color: gradeColor(avgGrade), weight: 4.5, opacity: 0.95 }).addTo(this.layers.finalRoute);
      }
    } else if (colorMode === 'surface' && route.surfaceBreakdown?.segmentSurfaces?.length > 1) {
      const segs = route.surfaceBreakdown.segmentSurfaces;
      let cursor = 0;
      for (let s = 0; s < segs.length; s++) {
        const target = segs[s];
        let best = cursor;
        let bestD = Infinity;
        for (let k = cursor; k < Math.min(latlngs.length, cursor + 120); k++) {
          const d = (latlngs[k][0] - target.lat) ** 2 + (latlngs[k][1] - target.lon) ** 2;
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        if (best > cursor) {
          L.polyline(latlngs.slice(cursor, best + 1), {
            color: SURFACE_COLORS[target.surface] || '#10b981',
            weight: 4.5,
            opacity: 0.95
          }).addTo(this.layers.finalRoute);
          cursor = best;
        }
      }
      if (cursor < latlngs.length - 1) {
        L.polyline(latlngs.slice(cursor), { color: '#10b981', weight: 4.5, opacity: 0.95 }).addTo(this.layers.finalRoute);
      }
    } else {
      L.polyline(latlngs, { color: '#10b981', weight: 4.5, opacity: 0.95 }).addTo(this.layers.finalRoute);
    }

    if (fitBounds) {
      const boundsLine = L.polyline(latlngs);
      this.map.fitBounds(boundsLine.getBounds(), { padding: [45, 45] });
    }
  }

  drawApproaches(selectedSpots, unit = 'metric') {
    this.layers.approaches.clearLayers();
    for (const s of selectedSpots) {
      if (!s.approach || !s.approach.needsHike) continue;
      L.polyline(
        [
          [s.approach.nearestLat, s.approach.nearestLon],
          [s.lat, s.lon]
        ],
        { color: '#f59e0b', weight: 2.5, dashArray: '4 5', opacity: 0.9 }
      )
        .bindTooltip(`🥾 Approach: ${formatDistance(s.approach.distKm, unit)} (+${formatElevation(s.approach.elevGainM, unit)})`)
        .addTo(this.layers.approaches);
    }
  }

  drawStageMarkers(stages, unit = 'metric') {
    this.layers.stages.clearLayers();
    for (const st of stages || []) {
      if (!st.endPoint) continue;
      const [lat, lon, ele, km] = st.endPoint;
      L.marker([lat, lon], {
        zIndexOffset: 450,
        icon: L.divIcon({
          className: '',
          html: `<div class="stage-pin">D${st.day}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        })
      })
        .bindPopup(
          `<strong>Overnight Camp · End of Day ${st.day}</strong><br>` +
          `At ${formatDistance(km, unit)} · Elev ${formatElevation(ele, unit)}<br>` +
          `Day ${st.day}: ${formatDistance(st.distKm, unit)} · ↗ ${formatElevation(st.ascentM, unit)}`
        )
        .addTo(this.layers.stages);
    }
  }

  renderSpots(allSpots, { selectedIds, pinnedIds, weather, unit = 'metric' }) {
    this.layers.spots.clearLayers();
    this.spotMarkers.clear();

    for (const spot of allSpots) {
      const meta = CAT_META[spot.cat];
      const isSel = selectedIds.has(spot.id);
      const isPinned = pinnedIds.has(spot.id);
      const size = isSel ? 30 : 24;

      const marker = L.marker([spot.lat, spot.lon], {
        zIndexOffset: isSel ? 600 : 100,
        icon: L.divIcon({
          className: '',
          html: `<div class="custom-pin ${isSel ? 'selected-pin' : ''}" style="width:${size}px;height:${size}px;background:${meta.color};">${meta.icon}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        })
      });

      const linksHtml = getExternalLinks(spot)
        .map(l => `<a class="mini-btn" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`)
        .join('');

      const windInfo = spot.cat === 'pg' ? evaluateParaglidingWind(spot, weather) : null;
      const windHtml = windInfo && windInfo.status !== 'unknown'
        ? `<div class="popup-badge ${windInfo.status}">${escapeHtml(windInfo.label)}</div>`
        : '';

      const hikeHtml = isSel && spot.approach?.needsHike
        ? `<div class="popup-badge caution">🥾 Approach ${formatDistance(spot.approach.distKm, unit)} (+${formatElevation(spot.approach.elevGainM, unit)}) · Bring bike lock</div>`
        : '';

      const popupHtml = `
        <div class="popup-card">
          <div class="popup-title">${meta.icon} ${escapeHtml(spot.name)}</div>
          <div class="popup-sub">
            ${escapeHtml(spot.diffLabel)}
            ${spot.ele != null ? ` · ${formatElevation(spot.ele, unit)}` : ''}
            · ~${formatDistance(spot.distFromBase || 0, unit)} off route
          </div>
          ${windHtml}
          ${hikeHtml}
          ${spot.description ? `<div class="popup-desc">${escapeHtml(spot.description.slice(0, 140))}</div>` : ''}
          <div class="popup-btn-row">
            <button class="mini-btn ${isSel ? 'route-rem' : 'route-add'}" data-spot-action="toggle" data-spot-id="${escapeHtml(spot.id)}">
              ${isSel ? '✓ On Route (Remove)' : '+ Add to Route'}
            </button>
            <button class="mini-btn ${isPinned ? 'pin-active' : ''}" data-spot-action="pin" data-spot-id="${escapeHtml(spot.id)}">
              ${isPinned ? '📌 Pinned' : '📌 Pin'}
            </button>
          </div>
          <div class="popup-links">${linksHtml}</div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      this.layers.spots.addLayer(marker);
      this.spotMarkers.set(spot.id, marker);
    }
  }

  renderSupportPOIs(pois) {
    this.layers.support.clearLayers();
    for (const poi of pois || []) {
      const m = L.marker([poi.lat, poi.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div class="custom-pin" style="width:22px;height:22px;background:${poi.color};font-size:11px;">${poi.icon}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).bindPopup(`<strong>${escapeHtml(poi.label)}</strong>`);
      this.layers.support.addLayer(m);
    }
  }

  fitSpotsBounds(spots) {
    if (!spots?.length) return;
    const latlngs = spots.map(s => [s.lat, s.lon]);
    this.map.fitBounds(L.latLngBounds(latlngs), { padding: [45, 45] });
  }
}
