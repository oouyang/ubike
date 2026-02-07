# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UBike is a Progressive Web App (PWA) that displays Taipei YouBike bike-sharing stations on an interactive Google Map. It shows real-time availability of bikes and parking slots at each station with color-coded markers.

**Hosted on:** GitHub Pages (gh-pages branch)
**Live URL:** https://oouyang.github.io/ubike/

## Development

This is a static web application with no build system. To develop:

1. Serve files locally with any static HTTP server
2. Open the HTML files directly in a browser for testing

There are no npm dependencies, build commands, or test frameworks.

## Architecture

### Entry Points
- **map.html** - Main map view with real-time station markers and auto-refresh (primary entry point per manifest)
- **list.html** - Tabular list view of all stations
- **ubike.html** - Alternative map view using store-locator library with side panel

### Data Flow
1. Station data fetched from Taipei Open Data API: `https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json`
2. Map auto-refreshes every 5 minutes

### Station Data Schema (Taipei Open Data v2)
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
  Quantity: number,             // total parking spaces
  available_rent_bikes: number, // available bikes
  available_return_bikes: number, // empty parking slots
  mday: string,                 // last update timestamp
  act: string                   // active status ("1" = active)
}
```

### Marker Color Coding
- **Green (80FF00)** - `available_rent_bikes > 0` and `available_return_bikes > 0`
- **Orange (FF9E21)** - `available_rent_bikes == 0` (no bikes)
- **Red (FF4D00)** - `available_return_bikes == 0` (no parking slots)

### Key Files
- `js/util.js` - Utility functions:
  - `fetchJSON(url)` - Async fetch with Promise (modern)
  - `httpGet(url)` - Synchronous XHR (legacy, used by map.html/list.html)
  - `getDistanceFromLatLonInM()` - Haversine distance calculation
- `js/store-locator.min.js` - Google Maps store locator library
- `manifest.webapp` - Firefox OS / PWA manifest with i18n support

### Localization
Automatic language detection via `navigator.language`:
- `zh-TW`, `zh-CN` → Chinese content
- All others → English content (default)

## External Dependencies

- Google Maps JavaScript API v3
- jQuery 1.6 (only in ubike.html)
- Flurry Analytics
- Google Analytics
