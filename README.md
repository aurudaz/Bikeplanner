# VeloVertical — Global Bikepacking & Mountain Sports Planner

**VeloVertical** is a zero-build, open-data HTML + ES6 JavaScript Progressive Web App (PWA) for planning multi-sport bikepacking adventures worldwide—combining bicycle routing with **Via Ferratas**, **Paragliding sites**, **Outdoor Climbing Crags**, **Canyoning & Waterfalls**, **Mountain Passes & Summits**, and **Wild Swims / Hot Springs**.

## Key Features

- **Worldwide Coverage**: Search any town, valley, or mountain range globally (via Photon & Nominatim), use GPS location, click the map, or launch any of **20 curated presets** across the Alps, Iberia & Pyrenees, Europe, and Worldwide.
- **Three Planning Modes**:
  - **A → B Bikepacking**: Computes a direct baseline bike route, searches a configurable corridor, and optimizes detours within your extra km/mi budget.
  - **Hub Loop**: Generates a circular loop from a base town hitting your chosen sports.
  - **Explore Area**: Pan/zoom anywhere on Earth, scan the visible map view, filter/select spots, and build a custom route.
- **6 Bicycle Routing Profiles** (BRouter / Bikerouter OSM + OSRM fallback): Trekking, Gravel/All-Road, MTB/Alpine Trails, Road Low-Traffic, Cycleways/EuroVelo Priority, and Scenic River Paths.
- **Road Type, Surface & Elevation Telemetry**:
  - Interactive elevation profile canvas with grade colors, spot markers, and multi-day overnight camp markers.
  - Normalized surface breakdown (Asphalt, Gravel, Trail) + road class breakdown (Cycleway / signed networks, Quiet Road, Track, Main Road), max grade %, steep km (>8%), route coloring modes (Solid / Gradient / Surface), and tire width recommendations.
- **Smart Mountain & Bikepacking Logistics**:
  - **Approach Hike & Lock Detector**: Calculates horizontal distance and elevation climb from the nearest bike-accessible point to cliff/launch spots and draws dashed connectors.
  - **Live Paragliding Wind Scorer**: Compares OSM launch orientations (`N/NE/S/SW...`) against live Open-Meteo wind speed, gusts, and direction.
  - **3-Day Forecast, Summit Temperature & Daylight**: Estimates summit air temperature via standard lapse rate (`-6.5°C / 1000m`) and calculates daylight hours.
  - **Multi-Day Stage Splitter**: Splits multi-day trips into daily riding & activity stages.
  - **Dynamic Gear Checklist & Weight Impact**: Auto-tailored packing checklist that updates climb time, water, and calorie estimates.
  - **Support Layers & Official Bike Networks**: Toggleable Waymarked Trails Cycling overlay plus live OSM Drinking Water, Camps/Alpine Huts/Shelters, Bike Shops/Repair, Rail/Cable Cars, and Groceries.
  - **Local Mountain Rescue & Airspace Links**: Region-aware emergency numbers + OpenAIP airspace viewer + region-specific external topo links (DeAndar, Klettersteig.de, Bergsteigen, ViaFerrata-FR, Ferrate365, Camptocamp, ParaglidingEarth, Burnair, SpotAir, TheCrag, Mountain Project, etc.).
- **Offline-Friendly & Exportable**: Save trips locally, share compact `#trip=...` URLs, and export **GPX 1.1**, **GeoJSON**, or a printable **Markdown Trip Sheet**.

## Open-Data Sources

- Routing & Surfaces: [BRouter](https://brouter.de/) & [Bikerouter](https://bikerouter.de/) (fallback: [OSRM](https://project-osrm.org/))
- Outdoor Spots & POIs: [OpenStreetMap](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/)
- Geocoding: [Photon](https://photon.komoot.io/) & [Nominatim](https://nominatim.openstreetmap.org/)
- Weather & Elevation Fallback: [Open-Meteo](https://open-meteo.com/)
- Map Tiles & Overlays: CyclOSM, OpenTopoMap, OpenStreetMap, Esri World Imagery, Waymarked Trails Cycling

## Local Development & Tests

Requires **Node.js 20+** (no `npm install` or build step required):

```bash
# Run unit & contract test suite
npm test

# Start local static server at http://127.0.0.1:4173/
npm start
```

## Deploy to GitHub Pages

Because VeloVertical uses pure static HTML/CSS/ES6 modules with relative (`./`) paths and a `.nojekyll` file, deployment to GitHub Pages works cleanly under any `https://<username>.github.io/<repo-name>/` URL:

### Option A: GitHub Actions (Included)
1. Create a new GitHub repository and push the contents of `bikepacking-webapp/` to the `main` branch.
2. In your GitHub repository, open **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The included `.github/workflows/deploy.yml` workflow will automatically publish your site on every push to `main`.

### Option B: Direct Branch Deploy
1. Push the contents of `bikepacking-webapp/` to your repository's `main` branch root (or `/docs` folder).
2. In **Settings → Pages**, select **Deploy from a branch** → `main` → `/ (root)` and click **Save**.
