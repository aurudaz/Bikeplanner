# VeloVertical — Global Bikepacking & Mountain Sports Planner

**VeloVertical** is a zero-build, open-data HTML + ES6 JavaScript Progressive Web App (PWA) for planning multi-sport bikepacking adventures worldwide—combining bicycle routing with **Via Ferratas**, **Paragliding sites**, **Outdoor Climbing Crags**, **Canyoning & Waterfalls**, **Mountain Passes**, and **Wild Swims / Hot Springs**.

## Key Features

- **Instant Prebuilt OSM Spatial Tiles + Live Overpass Fallback**: Pre-builds compact `4° × 4°` spatial tile JSON files (`data/index.json` + `data/tiles/*.json`) in GitHub Actions so adventure spots load in milliseconds as you pan/zoom—preventing Overpass `502` errors while automatically falling back to live Overpass outside covered regions (plus a manual `↻ Live OSM` button).
- **Visible Official Bike Paths by Default**: Starts with **CyclOSM** + **Waymarked Trails Cycling** overlay enabled so EuroVelo, national, regional, and local bike networks are immediately visible.
- **Worldwide Search & Three Planning Modes**:
  - **A → B**: Computes a direct baseline bike route, searches a configurable corridor, and optimizes detours within your extra km/mi budget.
  - **Loop**: Generates a circular loop from any start town hitting your chosen sports.
  - **Explore**: Pan/zoom anywhere on Earth, scan or browse nearby spots, pick favorites, and route between them.
- **5 Bicycle Routing Profiles** (CORS-friendly BRouter OSM + OSRM fallback): Bikepacking/Trekking, Gravel/MTB Trails, Road Low-Traffic, Official Cycleways/Safest, and Scenic River Paths.
- **Road Type, Surface & Elevation Telemetry**: Interactive elevation profile canvas, normalized surface/road-class percentages, max grade %, steep km (>8%), route coloring modes (Solid / Gradient % / Surface), and tire recommendations.
- **Smart Mountain & Bikepacking Logistics**: Approach hike & bike-lock detector, live paragliding wind orientation scoring, 3-day mountain forecast with summit lapse-rate temperature and daylight hours, multi-day stage splitter, dynamic gear packing checklist, support POI layers, local mountain rescue contacts, and GPX 1.1 / GeoJSON / Markdown / `#trip=` URL sharing.

## Open-Data Sources

- Routing & Surfaces: [BRouter](https://brouter.de/) (fallback: [OSRM](https://project-osrm.org/))
- Outdoor Spots & POIs: [OpenStreetMap](https://www.openstreetmap.org/) via Overpass (`overpass.private.coffee`, `overpass-api.de`, `lz4.overpass-api.de`)
- Geocoding: [Photon](https://photon.komoot.io/) & [Nominatim](https://nominatim.openstreetmap.org/)
- Weather & Elevation Fallback: [Open-Meteo](https://open-meteo.com/)
- Map Tiles & Overlays: CyclOSM, Waymarked Trails Cycling, OpenTopoMap, OpenStreetMap, Esri World Imagery

## Local Development, Dataset Build & Tests

Requires **Node.js 20+** (no `npm install` or build step required):

```bash
# Run unit & contract test suite
npm test

# Optional: build preloaded OSM spatial tiles locally (takes a few minutes)
npm run build:data

# Start local static server at http://127.0.0.1:4173/
npm start
```

## Deploy to GitHub Pages

1. Push the contents of `bikepacking-webapp/` to the `main` branch of your GitHub repository.
2. In your repository **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` workflow automatically runs `npm test`, builds and caches the global `4° × 4°` OSM spot tiles (`data/`), refreshes them every Sunday at 03:00 UTC (or manually via **Run workflow → Force rebuild OpenStreetMap spots dataset**), and deploys everything to GitHub Pages.
