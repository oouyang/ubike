# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taiwan Transport PWA - a comprehensive public transportation app displaying:
- **YouBike** bike-sharing stations (13 cities, 2000+ stations)
- **MRT** metro systems (Taipei, Kaohsiung, Taoyuan, Taichung - including light rails)
- **TRA** Taiwan Rail stations (13 lines, 200+ stations)
- **THSR** High Speed Rail (12 stations with schedules)
- **City Bus** nearby stops with real-time arrivals
- **Oil Prices** CPC gasoline & diesel prices with nearby gas stations
- **Weather** current conditions & 7-day forecast
- **Earthquake** real-time seismic activity map

All displayed on interactive Leaflet/OpenStreetMap maps with bilingual support (EN/中文).

**Hosted on:** GitHub Pages (gh-pages branch)
**Live URL:** https://oouyang.github.io/ubike/

## Tech Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | - | Semantic markup, PWA meta tags |
| CSS3 | - | Flexbox/Grid layouts, responsive design, animations |
| JavaScript | ES6+ | async/await, arrow functions, template literals, modules |

### External Libraries (CDN)
| Library | Version | CDN | Purpose |
|---------|---------|-----|---------|
| Leaflet | 1.9.4 | unpkg.com | Interactive maps, markers, popups, polylines |
| OpenStreetMap | - | tile.openstreetmap.org | Free map tiles (no API key required) |

### Browser APIs Used
| API | Purpose |
|-----|---------|
| Geolocation | User location for distance calculations, map centering |
| localStorage | Persist preferences (language, city, view mode) |
| Service Worker | Offline caching, PWA installation |
| Fetch | API requests with async/await |

### PWA Features
- **Service Worker** (`sw.js`) - Multi-strategy caching (cache-first, network-first, stale-while-revalidate)
- **Web App Manifest** (`manifest.webapp`) - Install prompt, icons, theme colors
- **Offline Support** - Static assets cached, API responses cached with TTL

### External APIs
| API | Endpoint | Auth | Purpose |
|-----|----------|------|---------|
| YouBike Official | `apis.youbike.com.tw/json/station-yb2.json` | None | Real-time bike station data |
| TDX (optional) | `tdx.transportdata.tw/api/...` | OAuth 2.0 | Real-time train/bus arrivals |
| CPC Oil (via Worker) | `www.cpc.com.tw/GetOilPriceJson.aspx` | None | Weekly oil prices |
| Overpass API | `overpass-api.de/api/interpreter` | None | Nearby gas stations (OSM) |
| Open-Meteo | `api.open-meteo.com/v1/forecast` | None | Weather data & geocoding |
| USGS Earthquake | `earthquake.usgs.gov/fdsnws/event/1/query` | None | Seismic activity data |

## Development

This is a static web application with **no build system**. To develop:

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx serve .

# Option 3: PHP
php -S localhost:8000
```

Open `http://localhost:8000` in a browser. No npm install, no build commands.

## File Structure

```
ubike/
├── index.html          # Main dashboard with service overview
├── ubike.html          # YouBike - Map/List toggle, search, city selector
├── mrt.html            # MRT - System/line filters, all metro stations
├── rail.html           # TRA - Train schedules, line/class filters
├── thsr.html           # THSR - Train schedules, station info
├── bus.html            # Bus - Route schedules, nearby stops, arrivals
├── oil.html            # Oil Prices - CPC prices, predictions, nearby stations
├── weather.html        # Weather - Current & 7-day forecast
├── earthquake.html     # Earthquake - Real-time seismic activity map
├── js/
│   ├── common.js       # Shared utilities (CITIES, distance, language)
│   ├── ubike.js        # YouBike page logic
│   ├── bus.js          # Bus page logic
│   ├── bottom-sheet.js # Mobile bottom sheet component
│   └── util.js         # Legacy utilities
├── css/
│   └── bottom-sheet.css # Bottom sheet styles (mobile-only)
├── tdx/
│   ├── index.html      # TDX static data hub
│   ├── thsr.html       # THSR stations (static)
│   ├── air.html        # Airports (static)
│   └── bus.html        # Intercity bus terminals (static)
├── workers/
│   ├── tdx-proxy.js    # Cloudflare Worker for TDX API proxy
│   ├── oil-price-proxy.js # Cloudflare Worker for CPC oil prices
│   └── earthquake-notify.js # Cloudflare Worker for earthquake notifications
├── sw.js               # Service worker
├── manifest.webapp     # PWA manifest
└── img/                # Icons (180px, etc.)
```

## Page Features

### YouBike (`ubike.html`)
- **Map View**: Leaflet map with color-coded markers, search panel, auto-refresh (5 min)
- **List View**: Sortable table (click header: desc → asc → reset), responsive columns
- **City Selector**: 13 Taiwan cities with YouBike
- **Locate Button**: Center map to user location (📍)
- **Route Tracking**: Blue polyline showing user's travel path

### MRT (`mrt.html`)
- **System Filter**: Taipei (TRTC), Kaohsiung (KRTC), Taoyuan (TYMC), Taichung (TMRT)
- **Line Filter**: All lines including Ankeng LRT (LG) and Kaohsiung Circular LRT (KC)
- **Station Data**: 200+ stations with coordinates, embedded as static JSON
- **Locate Button**: Center map to user location

### Taiwan Rail (`rail.html`)
- **Train Schedule Tab**: Origin/destination selectors, departure times, fare, duration
- **Stations Tab**: Browse all stations with line/class filters
- **Direction Tabs**: Northbound/Southbound toggle
- **Train Types**: Express, Limited Express, Local, Fast Local
- **Locate Button**: Center map to user location

### THSR (`thsr.html`)
- **Train Schedule**: Origin/destination selectors, departure times
- **Station Info**: 12 stations from Nangang to Zuoying
- **Real-time Display**: Current time, next train countdown
- **Timetable Popup**: Full route with arrival times at each stop

### Bus (`bus.html`)
- **Route Schedule Tab**:
  - City and route selectors with search
  - Origin/destination stop selectors
  - Trip-specific fare and duration calculation
  - ETA at each stop based on next bus departure
  - Stop highlighting (green=board, red=alight, yellow=in-trip)
- **Nearby Stops Tab**:
  - Real-time arrivals from TDX API (or demo mode)
  - Distance-sorted stop list
  - Arrival badges with countdown
- **Locate Button**: Center map to user location

### Oil Prices (`oil.html`)
- **Price Info Tab** (default):
  - Current week prices: 92/95/98 unleaded + diesel (NT$/L)
  - Next week predicted prices with ▲/▼ change indicators (red up, green down)
  - Share button: FB share + copy to clipboard
  - Price history mini-chart (last 8 weeks, CSS bar chart)
  - Demo data by default; live data via Cloudflare Worker proxy
- **Nearby Stations Tab**:
  - Leaflet map centered on user location
  - Gas station markers from Overpass API (CPC=green, Formosa=blue, other=gray)
  - Popup with station name, brand, navigation links
  - Locate button (📍)
- **Not in nav header**: Oil link only appears as card in `index.html`, not in other pages' nav headers

### Weather (`weather.html`)
- **Current Weather**: Temperature, feels-like, wind, humidity, pressure, precipitation
- **7-Day Forecast**: Scrollable cards with hi/lo temps, weather icons, precipitation
- **Location**: Auto-detect GPS, Taiwan city selector (13 cities), world cities (20), search
- **Caching**: localStorage with 30-min TTL, auto-refresh every 30 min
- **Data Source**: Open-Meteo API (free, no auth)

### Earthquake (`earthquake.html`)
- **Map**: Leaflet with magnitude-scaled circle markers (color-coded)
- **List**: Sortable by time, unread (NEW) badges, FB share per event
- **Filters**: Magnitude slider (2-7), time range buttons (1d/7d/30d/90d)
- **Notifications**: Browser push + email subscription modal
- **Data Source**: USGS Earthquake API

### Common UI Features (All Pages)
- **Navigation Bar**: Links to all transport pages
- **Language Toggle**: EN/中文 button
- **Locate Button**: 📍 button at bottom-right of all maps
- **Responsive Design**: Mobile-friendly layouts
- **Mobile Bottom Sheet**: Draggable panel with snap points (collapsed/half/full)

### Mobile UI (≤768px)
- **Bottom Sheet**: Panel slides up from bottom with drag handle
- **Snap Points**: Collapsed (56px), Half (50vh), Full (90vh)
- **Summary Line**: Shows context when collapsed (e.g., "🚲 Taipei • 400 stations")
- **Header Height**: 74px (wraps to 2 rows on mobile)
- **Map Position**: Fixed, top: 74px to avoid header overlap

## MRT Systems & Lines

| System | Code | Lines |
|--------|------|-------|
| Taipei Metro | TRTC | BR (文湖), R (淡水信義), G (松山新店), O (中和新蘆), BL (板南), Y (環狀), **LG (安坑輕軌)** |
| Kaohsiung Metro | KRTC | KR (紅線), KO (橘線), **KC (環狀輕軌 - 37 stations)** |
| Taoyuan Metro | TYMC | A (機場線) |
| Taichung Metro | TMRT | TG (綠線) |

## Taiwan Rail Lines

| Code | Name | Description |
|------|------|-------------|
| WL | Western Line (North) | Keelung to Zhunan |
| ML | Mountain Line | Zhunan to Changhua (inland) |
| CL | Coast Line | Zhunan to Changhua (coastal) |
| SL | Western Line (South) | Changhua to Kaohsiung |
| YL | Yilan Line | Badu to Su'aoxin |
| NL | North-Link Line | Su'aoxin to Hualien |
| TL | Taitung Line | Hualien to Taitung |
| SLL | South-Link Line | Fangliao to Taitung |
| PX, NW, JJ, SH, LJ | Branch Lines | Various branch lines |

## Key JavaScript Modules

### `js/common.js` - Shared Utilities
```javascript
// Constants
YOUBIKE_API              // Official YouBike API endpoint
CITIES                   // 13 city configs with area codes
STORAGE_KEYS             // localStorage key constants

// Language
detectLanguage()         // From localStorage or navigator.language
saveLanguage(lang)       // Save to localStorage

// Distance (Haversine)
getDistanceInMeters(lat1, lon1, lat2, lon2)
formatDistance(meters, isZh)

// YouBike
normalizeStation(s)      // API → common schema
getMarkerType(station)   // 'ok' | 'empty' | 'full'

// Geolocation
getUserLocation(options) // Promise-based wrapper

// UI Helpers
getNavigationHtml(lat, lng, isZh)  // Google/Apple Maps links
updateNavButtons(lang)              // Update nav text by language
```

### `js/ubike.js` - YouBike Controller
```javascript
setView(view)            // Toggle 'map' | 'list'
loadStations()           // Fetch and render
filterStations(query)    // Search
selectStation(sno)       // Zoom and highlight
sortByColumn(colIndex)   // Table sorting
centerToUserLocation()   // Locate button handler
startAutoRefresh()       // 5-min refresh timer
```

### `js/bus.js` - Bus Controller
```javascript
// Route Schedule
onRouteSearch()          // Filter routes by search
onStopSelectorChange()   // Origin/destination selection
renderRouteSchedule()    // Render stops with ETA
getNextBusTime()         // Calculate next departure

// Nearby Stops
loadNearbyStops()        // Fetch from TDX or demo
fetchArrivals(stopIds)   // Real-time arrival data
centerToUserLocation()   // Locate button handler
```

### `js/bottom-sheet.js` - Mobile Bottom Sheet
Draggable bottom sheet component for mobile (≤768px). Google Maps-style UI with three snap points.

```javascript
// Constructor
new BottomSheet(element, {
  initialSnap: 'collapsed',  // 'collapsed' | 'half' | 'full'
  onSnapChange: (snap) => {} // Callback when snap changes
})

// Snap Points
collapsed  // 56px - Handle + summary only
half       // 50vh - Handle + filters + partial list
full       // 90vh - Handle + filters + full scrollable list

// Methods
snapTo(snap, animate)    // Programmatic snap
destroy()                // Remove event listeners

// CSS Classes (auto-managed)
snap-collapsed           // translateY(calc(100% - 56px))
snap-half                // translateY(50%)
snap-full                // translateY(10%)
dragging                 // Disables transition during drag
```

**Required HTML structure:**
```html
<div id="panel">
  <div class="sheet-handle">
    <div class="sheet-pill"></div>
    <div class="sheet-summary" id="sheet-summary">Summary text</div>
  </div>
  <div class="sheet-content">
    <!-- filters and list content -->
  </div>
</div>
```

## Service Worker Caching Strategies

| Resource | Strategy | TTL |
|----------|----------|-----|
| Static assets (HTML, JS, CSS) | Cache-first | 24 hours |
| Map tiles (OSM) | Cache-first | 7 days |
| YouBike API | Stale-while-revalidate | 5 minutes |
| TDX API | Network-first | 30 seconds |
| USGS Earthquake API | Stale-while-revalidate | 10 minutes |
| Open-Meteo API | Stale-while-revalidate | 30 minutes |
| Overpass API (gas stations) | Cache-first | 24 hours |

## localStorage Keys

| Key | Purpose | Values |
|-----|---------|--------|
| `ubike-lang` | Language | `'en'` \| `'zh'` |
| `ubike-city` | YouBike city | City key |
| `ubike-view` | YouBike view | `'map'` \| `'list'` |
| `mrt-system` | MRT system | System code |
| `rail-line` | TRA line | Line code |
| `bus-city` | Bus city | City code |
| `weather-cache` | Weather cache | JSON (location + data + timestamp) |
| `earthquake-last-seen` | Last viewed time | Timestamp (ms) |
| `earthquake-notify-settings` | Notification prefs | JSON |

## Data Schemas

### YouBike Station (Normalized)
```javascript
{
  sno: string,                    // Station ID
  sna: string,                    // Name (Chinese)
  snaen: string,                  // Name (English)
  latitude: number,
  longitude: number,
  available_rent_bikes: number,   // Bikes available
  available_return_bikes: number, // Empty slots
  city: string,                   // City key
  areaCode: string                // API area code
}
```

### Marker Colors
| Color | Hex | Condition |
|-------|-----|-----------|
| Green | #80FF00 | Bikes > 0 AND Slots > 0 |
| Orange | #FF9E21 | Bikes = 0 |
| Red | #FF4D00 | Slots = 0 |

## Localization

- Auto-detect from `navigator.language` (zh-TW/zh-CN → Chinese, else English)
- Manual toggle via language button
- `data-en` / `data-zh` attributes on HTML elements
- `LABELS` objects for programmatic text

## Code Style

- `'use strict'` in all JS files
- ES6+: const/let, async/await, arrow functions, template literals
- Console prefixes: `[UBike]`, `[MRT]`, `[Rail]`, `[Bus]`
- CSS: Mobile-first, flexbox/grid, CSS custom properties
- No external CSS frameworks (pure CSS)
