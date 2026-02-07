# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Taiwan Transport PWA that displays YouBike bike-sharing stations and MRT metro stations on interactive maps using Leaflet/OpenStreetMap. It supports all Taiwan cities with YouBike (13 cities/counties) and all MRT systems (Taipei, Kaohsiung, Taoyuan, Taichung).

**Hosted on:** GitHub Pages (gh-pages branch)
**Live URL:** https://oouyang.github.io/ubike/

## Development

This is a static web application with no build system. To develop:

1. Serve files locally with any static HTTP server
2. Open the HTML files directly in a browser for testing

There are no npm dependencies, build commands, or test frameworks.

## Architecture

### Entry Points
- **map.html** - YouBike map view with real-time station markers and auto-refresh (primary)
- **list.html** - YouBike sortable table view with distance column and language toggle (EN/中文)
- **ubike.html** - YouBike map with search panel, station list, and city selector
- **mrt.html** - MRT metro stations map with system/line filters and search

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

City preference is saved in localStorage (`ubike-city`).

### MRT Systems Support
MRT page (`mrt.html`) displays metro stations for all Taiwan MRT systems:

| System Code | Chinese | English | Lines |
|-------------|---------|---------|-------|
| TRTC | 台北捷運 | Taipei Metro | BR (文湖), R (淡水信義), G (松山新店), O (中和新蘆), BL (板南), Y (環狀), LG (安坑輕軌) |
| KRTC | 高雄捷運 | Kaohsiung Metro | KR (紅線), KO (橘線), KC (環狀輕軌) |
| TYMC | 桃園捷運 | Taoyuan Metro | A (機場線) |
| TMRT | 台中捷運 | Taichung Metro | TG (綠線) |

Station data is embedded as static JSON (MRT stations rarely change). System preference is saved in localStorage (`mrt-system`).

### Data Flow
Station data fetched from official YouBike API:
```
https://apis.youbike.com.tw/json/station-yb2.json
```

This single API provides all stations across Taiwan with consistent field naming. Data is filtered by `area_code` for city-specific views. Map auto-refreshes every 5 minutes with caching to reduce API calls.

### Station Data Schema (Normalized)
All city data is normalized to this common schema:
```javascript
{
  sno: string,                  // station ID (station_no from API)
  sna: string,                  // station name (Chinese - name_tw)
  snaen: string,                // station name (English - name_en)
  sarea: string,                // district name (Chinese - district_tw)
  sareaen: string,              // district name (English - district_en)
  ar: string,                   // address (Chinese - address_tw)
  aren: string,                 // address (English - address_en)
  latitude: number,             // latitude (parsed from lat)
  longitude: number,            // longitude (parsed from lng)
  available_rent_bikes: number, // available bikes (available_spaces)
  available_return_bikes: number, // empty parking slots (empty_spaces)
  city: string,                 // city key (derived from area_code)
  areaCode: string              // raw area code from API
}
```

**Official API field mapping:**
- `station_no` → `sno`
- `name_tw` / `name_en` → `sna` / `snaen`
- `district_tw` / `district_en` → `sarea` / `sareaen`
- `address_tw` / `address_en` → `ar` / `aren`
- `lat` / `lng` → `latitude` / `longitude` (parsed to float)
- `available_spaces` → `available_rent_bikes`
- `empty_spaces` → `available_return_bikes`

### Marker Color Coding
- **Green (80FF00)** - `available_rent_bikes > 0` and `available_return_bikes > 0`
- **Orange (FF9E21)** - `available_rent_bikes == 0` (no bikes)
- **Red (FF4D00)** - `available_return_bikes == 0` (no parking slots)

### Key Files
- `js/util.js` - Utility functions:
  - `fetchJSON(url)` - Async fetch with Promise
  - `getDistanceFromLatLonInM()` - Haversine distance calculation
- `ubike.js` - Station locator with Leaflet:
  - `YOUBIKE_API` - Official YouBike API endpoint
  - `CITIES` config object with area codes and center coordinates
  - `normalizeStation(s)` - Convert API data to common schema
  - `fetchAllStationsFromAPI()` - Fetch all stations from official API
  - `fetchStations(cityKey)` - Filter cached stations by city area code
  - `fetchAllStations()` - Return all cached stations
  - `filterStations(query)` - Search by name/address
  - `selectStation(sno, city)` - Highlight and zoom to station
  - `changeCity()` - Handle city selector change
- `sorttable.js` - Table sorting (add `class="sortable"` to tables)
- `js/sortable.min.js` - HubSpot Sortable v0.8.0 (use `data-sortable` attribute)
- `manifest.webapp` - Firefox OS / PWA manifest with i18n support

### Localization
Automatic language detection via `navigator.language`:
- `zh-TW`, `zh-CN` → Chinese content
- All others → English content (default)

## Code Style

- ES6+ JavaScript (const/let, async/await, arrow functions, template literals)
- `'use strict'` mode in all JS files
- Console logging with prefixes: `[UBike]`, `[SortTable]`
- Error handling with try/catch and user-visible error messages

## External Dependencies

- Leaflet 1.9.4 (via unpkg CDN)
- OpenStreetMap tiles (free, no API key required)
