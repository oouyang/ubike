# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taiwan Transport PWA that displays YouBike bike-sharing stations, MRT metro stations, Taiwan Rail (TRA) stations, and other transport data on interactive maps using Leaflet/OpenStreetMap. It supports all Taiwan cities with YouBike (13 cities/counties), all MRT systems (Taipei, Kaohsiung, Taoyuan, Taichung), TRA lines (13 lines with 200+ stations), THSR (12 stations), airports (17), and intercity bus terminals (26+).

**Hosted on:** GitHub Pages (gh-pages branch)
**Live URL:** https://oouyang.github.io/ubike/

## Tech Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | - | Page structure, semantic markup |
| CSS3 | - | Styling, flexbox/grid layouts, responsive design |
| JavaScript | ES6+ | Application logic, async/await, modules |

### External Libraries (CDN)
| Library | Version | CDN | Purpose |
|---------|---------|-----|---------|
| Leaflet | 1.9.4 | unpkg.com | Interactive maps, markers, popups |
| OpenStreetMap | - | tile.openstreetmap.org | Free map tiles (no API key) |

### PWA Features
- **Service Worker** (`sw.js`) - Offline caching, background sync
- **Web App Manifest** (`manifest.webapp`) - Install prompt, icons, theme colors
- **Geolocation API** - User location for distance calculations
- **localStorage** - Persist user preferences across sessions

### APIs
| API | Endpoint | Auth | Purpose |
|-----|----------|------|---------|
| YouBike Official | `apis.youbike.com.tw/json/station-yb2.json` | None | Real-time bike station data |
| TDX (optional) | `tdx.transportdata.tw/api/...` | OAuth 2.0 | Real-time train/bus arrivals |

## Development

This is a static web application with no build system. To develop:

1. Serve files locally with any static HTTP server:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```
2. Open `http://localhost:8000` in a browser

There are no npm dependencies, build commands, or test frameworks.

## File Structure

```
ubike/
├── index.html          # Main dashboard (primary entry point)
├── ubike.html          # YouBike unified page (Map/List toggle)
├── mrt.html            # MRT metro stations
├── rail.html           # Taiwan Rail (TRA) stations
├── thsr.html           # High Speed Rail with schedules
├── bus.html            # City bus nearby stops
├── js/
│   ├── common.js       # Shared utilities (CITIES, normalizeStation, etc.)
│   ├── ubike.js        # YouBike page controller
│   ├── bus.js          # City bus page controller
│   └── util.js         # Legacy utilities
├── tdx/
│   ├── index.html      # TDX data hub
│   ├── thsr.html       # THSR stations (static)
│   ├── air.html        # Airports (static)
│   └── bus.html        # Intercity bus terminals (static)
├── sw.js               # Service worker for PWA
├── manifest.webapp     # PWA manifest
└── img/                # Icons and images
```

## Architecture

### Entry Points
| Page | Description | Features |
|------|-------------|----------|
| `index.html` | Main dashboard | Service overview, cards with stats |
| `ubike.html` | YouBike stations | Map/List toggle, search, city selector, auto-refresh |
| `mrt.html` | MRT stations | System/line filters, color-coded markers |
| `rail.html` | TRA stations | Line/class filters, search |
| `thsr.html` | High Speed Rail | Train schedules, station info |
| `bus.html` | City bus | Nearby stops, real-time arrivals |
| `tdx/*.html` | Static data pages | No API auth required |

### YouBike Unified Page (`ubike.html`)
The YouBike page combines map and list views into a single page with toggle:

**Map View:**
- Full-screen Leaflet map with OpenStreetMap tiles
- Color-coded markers (green/orange/red by availability)
- Collapsible search panel with station list
- Auto-refresh every 5 minutes
- Route tracking (blue polyline) via geolocation

**List View:**
- Sortable table (click headers: desc → asc → reset)
- Color-coded availability cells
- Distance column (auto-populated via geolocation)
- Responsive (hides Lat/Lng on mobile, Location on small screens)

### Multi-City Support
City selector dropdown allows switching between all Taiwan cities with YouBike:

| City Key | Area Code | Chinese | English |
|----------|-----------|---------|---------|
| taipei | 00 | 台北市 | Taipei |
| newtaipei | 05 | 新北市 | New Taipei |
| taoyuan | 07 | 桃園市 | Taoyuan |
| hsinchu | 09 | 新竹市 | Hsinchu City |
| hsinchuCounty | 0B | 新竹縣 | Hsinchu County |
| miaoli | 0A | 苗栗縣 | Miaoli |
| taichung | 01 | 台中市 | Taichung |
| chiayi | 08 | 嘉義市 | Chiayi City |
| chiayiCounty | 11 | 嘉義縣 | Chiayi County |
| tainan | 13 | 台南市 | Tainan |
| kaohsiung | 12 | 高雄市 | Kaohsiung |
| pingtung | 14 | 屏東縣 | Pingtung |
| taitung | 15 | 台東縣 | Taitung |

### MRT Systems Support
MRT page (`mrt.html`) displays metro stations for all Taiwan MRT systems:

| System Code | Chinese | English | Lines |
|-------------|---------|---------|-------|
| TRTC | 台北捷運 | Taipei Metro | BR (文湖), R (淡水信義), G (松山新店), O (中和新蘆), BL (板南), Y (環狀), LG (安坑輕軌) |
| KRTC | 高雄捷運 | Kaohsiung Metro | KR (紅線), KO (橘線), KC (環狀輕軌) |
| TYMC | 桃園捷運 | Taoyuan Metro | A (機場線) |
| TMRT | 台中捷運 | Taichung Metro | TG (綠線) |

### Taiwan Rail (TRA) Lines Support

| Line Code | Chinese | English | Description |
|-----------|---------|---------|-------------|
| WL | 西部幹線(北段) | Western Line (North) | Keelung to Zhunan |
| ML | 山線 | Mountain Line | Zhunan to Changhua (inland) |
| CL | 海線 | Coast Line | Zhunan to Changhua (coastal) |
| SL | 西部幹線(南段) | Western Line (South) | Changhua to Kaohsiung |
| YL | 宜蘭線 | Yilan Line | Badu to Su'aoxin |
| NL | 北迴線 | North-Link Line | Su'aoxin to Hualien |
| TL | 臺東線 | Taitung Line | Hualien to Taitung |
| SLL | 南迴線 | South-Link Line | Fangliao to Taitung |
| PX | 平溪線 | Pingxi Line | Branch line |
| NW | 內灣線 | Neiwan Line | Branch line |
| JJ | 集集線 | Jiji Line | Branch line |
| SH | 沙崙線 | Shalun Line | Branch line |
| LJ | 六家線 | Liujia Line | Branch line |

Station classes: **1st Class** (major) → **2nd Class** (regional) → **3rd Class** (local) → **Simple** (minimal)

## Key Files

### `js/common.js` - Shared Utilities
```javascript
// Constants
YOUBIKE_API          // Official YouBike API endpoint
CITIES               // City configs with area codes and centers
STORAGE_KEYS         // localStorage key constants

// Language
detectLanguage()     // Detect from localStorage or navigator.language
isChineseLocale()    // Check if current language is Chinese
saveLanguage(lang)   // Save preference to localStorage

// Distance (Haversine)
getDistanceInMeters(lat1, lon1, lat2, lon2)
formatDistance(meters, isZh)

// YouBike Data
normalizeStation(s)  // Convert API data to common schema
getMarkerType(station) // 'ok' | 'empty' | 'full'

// UI Helpers
getNavigationHtml(lat, lng, isZh) // Google/Apple Maps links
createMarkerIcon(options)         // Leaflet divIcon factory
createMap(elementId, center, zoom) // Standard OSM map setup
updateNavButtons(lang)            // Update nav button text
```

### `js/ubike.js` - YouBike Page Controller
```javascript
// View Management
setView(view)        // Toggle 'map' or 'list' view
toggleSearchPanel()  // Collapse/expand search panel

// Data
loadStations()       // Fetch and display station data
filterStations(query) // Search by name/address

// Map Functions
initMap()            // Initialize Leaflet map
updateMarkers(stations) // Refresh map markers
selectStation(sno)   // Zoom to and highlight station

// Table Functions
renderTable(stations) // Build HTML table
sortByColumn(colIndex) // Sort: desc → asc → reset

// Auto-refresh
startAutoRefresh()   // Start 5-min refresh timer
stopAutoRefresh()    // Stop timer (when in list view)
```

### `sw.js` - Service Worker
Caching strategies:
- **Static assets**: Cache-first (HTML, JS, CSS)
- **Map tiles**: Cache-first with 7-day expiry
- **YouBike API**: Stale-while-revalidate (5-min cache)
- **TDX API**: Network-first with fallback

## localStorage Keys

| Key | Purpose | Values |
|-----|---------|--------|
| `ubike-lang` | Language preference | `'en'` \| `'zh'` |
| `ubike-city` | Selected city | City key (e.g., `'taipei'`) |
| `ubike-view` | YouBike view mode | `'map'` \| `'list'` |
| `mrt-system` | Selected MRT system | System code (e.g., `'TRTC'`) |
| `mrt-lang` | MRT page language | `'en'` \| `'zh'` |
| `rail-line` | Selected TRA line | Line code (e.g., `'WL'`) |
| `rail-lang` | Rail page language | `'en'` \| `'zh'` |
| `tdx-lang` | TDX pages language | `'en'` \| `'zh'` |
| `bus-city` | Bus page city | City code |

## Data Schema

### YouBike Station (Normalized)
```javascript
{
  sno: string,                    // Station ID
  sna: string,                    // Name (Chinese)
  snaen: string,                  // Name (English)
  sarea: string,                  // District (Chinese)
  sareaen: string,                // District (English)
  ar: string,                     // Address (Chinese)
  aren: string,                   // Address (English)
  latitude: number,               // Latitude
  longitude: number,              // Longitude
  available_rent_bikes: number,   // Bikes available
  available_return_bikes: number, // Empty slots
  city: string,                   // City key
  areaCode: string                // Area code from API
}
```

### Marker Color Coding
| Color | Hex | Condition |
|-------|-----|-----------|
| Green | #80FF00 | Bikes > 0 AND Slots > 0 |
| Orange | #FF9E21 | Bikes = 0 (no bikes) |
| Red | #FF4D00 | Slots = 0 (no parking) |

## Localization

Automatic language detection via `navigator.language`:
- `zh-TW`, `zh-CN`, `zh-*` → Chinese content
- All others → English content (default)

All pages support bilingual content via:
- `data-en` / `data-zh` attributes on elements
- `LABELS` object with translations
- Language toggle button in header

## Code Style

- ES6+ JavaScript (const/let, async/await, arrow functions, template literals)
- `'use strict'` mode in all JS files
- Console logging with prefixes: `[UBike]`, `[MRT]`, `[Rail]`, etc.
- Error handling with try/catch and user-visible error messages
- CSS: BEM-like naming, mobile-first responsive design
