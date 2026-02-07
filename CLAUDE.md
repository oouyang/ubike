# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UBike is a Progressive Web App (PWA) that displays YouBike bike-sharing stations on an interactive map using Leaflet/OpenStreetMap. It supports multiple cities (Taipei, New Taipei) and shows real-time availability of bikes and parking slots at each station with color-coded markers.

**Hosted on:** GitHub Pages (gh-pages branch)
**Live URL:** https://oouyang.github.io/ubike/

## Development

This is a static web application with no build system. To develop:

1. Serve files locally with any static HTTP server
2. Open the HTML files directly in a browser for testing

There are no npm dependencies, build commands, or test frameworks.

## Architecture

### Entry Points
- **map.html** - Main map view with real-time station markers and auto-refresh (primary)
- **list.html** - Sortable table view with distance column and language toggle (EN/中文)
- **ubike.html** - Map with search panel, station list, and city selector

### Multi-City Support
City selector dropdown allows switching between:
- **Taipei City (台北市)** - Default
- **New Taipei City (新北市)**
- **All Cities (全部)** - Combined view

City preference is saved in localStorage (`ubike-city`).

### Data Flow
Station data fetched from city Open Data APIs:
- **Taipei:** `https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json`
- **New Taipei:** `https://data.ntpc.gov.tw/api/datasets/010e5b15-3823-4b20-b401-b1cf000550c5/json?size=2000`

Map auto-refreshes every 5 minutes. Data is normalized to common schema via city-specific `normalize()` functions.

### Station Data Schema (Normalized)
All city data is normalized to this common schema:
```javascript
{
  sno: string,                  // station ID
  sna: string,                  // station name (Chinese)
  snaen: string,                // station name (English)
  sarea: string,                // area name (Chinese)
  sareaen: string,              // area name (English)
  ar: string,                   // address (Chinese)
  aren: string,                 // address (English)
  latitude: number,             // latitude
  longitude: number,            // longitude
  available_rent_bikes: number, // available bikes
  available_return_bikes: number, // empty parking slots
  city: string                  // city key ('taipei', 'newtaipei')
}
```

**Note:** Raw API field names differ between cities:
- Taipei: `latitude`, `longitude`, `available_rent_bikes`, `available_return_bikes`
- New Taipei: `lat`, `lng`, `sbi_quantity`, `bemp`

### Marker Color Coding
- **Green (80FF00)** - `available_rent_bikes > 0` and `available_return_bikes > 0`
- **Orange (FF9E21)** - `available_rent_bikes == 0` (no bikes)
- **Red (FF4D00)** - `available_return_bikes == 0` (no parking slots)

### Key Files
- `js/util.js` - Utility functions:
  - `fetchJSON(url)` - Async fetch with Promise
  - `getDistanceFromLatLonInM()` - Haversine distance calculation
- `ubike.js` - Station locator with Leaflet:
  - `CITIES` config object with API URLs and normalize functions
  - `fetchStations(cityKey)` - Load data from specific city API
  - `fetchAllStations()` - Load from all cities (Promise.allSettled)
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
