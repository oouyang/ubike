# Taiwan Transport PWA - Detailed Design Document

> A comprehensive public transportation Progressive Web App for Taiwan

**Live URL**: https://oouyang.github.io/ubike/
**Repository**: GitHub Pages (`gh-pages` branch)
**Last Updated**: February 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Feature Specifications](#3-feature-specifications)
4. [API Integration](#4-api-integration)
5. [Technology Stack](#5-technology-stack)
6. [Data Structures](#6-data-structures)
7. [Caching & Offline Strategy](#7-caching--offline-strategy)
8. [State Management](#8-state-management)
9. [UI/UX Design System](#9-uiux-design-system)
10. [Performance Optimizations](#10-performance-optimizations)
11. [Localization](#11-localization)
12. [Error Handling](#12-error-handling)
13. [Security Considerations](#13-security-considerations)
14. [Design Philosophy](#14-design-philosophy)
15. [Future Roadmap](#15-future-roadmap)

---

## 1. Overview

### 1.1 Purpose

Taiwan Transport PWA consolidates real-time public transportation data from multiple systems into a unified, bilingual (English/中文), offline-capable mobile experience. It serves commuters, tourists, and residents needing quick access to:

- Bike-sharing availability (YouBike)
- Metro/MRT schedules and stations
- Taiwan Rail (TRA) information
- High Speed Rail (THSR) timetables
- City bus routes and real-time arrivals
- Airport locations

### 1.2 Key Metrics

| Metric | Value |
|--------|-------|
| Transport Systems | 6 types |
| Cities Covered | 22 cities/counties |
| YouBike Stations | 2,000+ |
| MRT Stations | 200+ (4 systems) |
| TRA Stations | 200+ (13 lines) |
| THSR Stations | 12 |
| Airports | 17 (4 intl, 13 domestic) |

### 1.3 Target Users

- **Commuters**: Daily route planning, real-time arrivals
- **Tourists**: Navigation, bilingual support
- **Cyclists**: YouBike availability, nearby stations
- **General Public**: Multi-modal trip planning

---

## 2. Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   HTML5     │  │   CSS3      │  │    JavaScript (ES6+)    │  │
│  │   Pages     │  │   Styles    │  │    Controllers          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                            │                                     │
│                   ┌────────▼────────┐                           │
│                   │  Service Worker │                           │
│                   │    (sw.js)      │                           │
│                   └────────┬────────┘                           │
│                            │                                     │
│         ┌──────────────────┼──────────────────┐                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │ Cache API   │  │ localStorage│  │   IndexedDB (future)│     │
│  └─────────────┘  └─────────────┘  └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
     │ YouBike API │  │  TDX Proxy  │  │ OpenStreet  │
     │  (Direct)   │  │ (Cloudflare)│  │    Map      │
     └─────────────┘  └──────┬──────┘  └─────────────┘
                             │
                      ┌──────▼──────┐
                      │   TDX API   │
                      │ (OAuth 2.0) │
                      └─────────────┘
```

### 2.2 File Structure

```
ubike/
├── index.html                 # Homepage - Transport hub
├── ubike.html                 # YouBike - Bike sharing
├── mrt.html                   # MRT - Metro systems
├── rail.html                  # TRA - Taiwan Rail
├── thsr.html                  # THSR - High Speed Rail
├── bus.html                   # City Bus - Routes & arrivals
│
├── js/
│   ├── common.js              # Shared utilities (417 lines)
│   │   ├── Constants          # API URLs, city configs
│   │   ├── Language utils     # Detection, persistence
│   │   ├── Distance calc      # Haversine formula
│   │   ├── Formatting         # Time, distance, numbers
│   │   └── UI helpers         # Navigation, markers
│   │
│   ├── ubike.js               # YouBike controller (816 lines)
│   │   ├── View management    # Map/List toggle
│   │   ├── Data fetching      # API calls, caching
│   │   ├── Marker rendering   # Color-coded icons
│   │   ├── Search/filter      # Station filtering
│   │   └── Auto-refresh       # 5-minute interval
│   │
│   ├── bus.js                 # Bus controller (1564 lines)
│   │   ├── TDX integration    # OAuth proxy calls
│   │   ├── Rate limiting      # Debounce, retry, cache
│   │   ├── Route schedule     # Trip planning
│   │   ├── Nearby stops       # Geolocation-based
│   │   └── Real-time arrivals # Live countdown
│   │
│   └── util.js                # Legacy utilities
│
├── tdx/
│   ├── index.html             # TDX data hub
│   ├── thsr.html              # Static THSR data
│   ├── air.html               # Airports (17 locations)
│   └── bus.html               # Intercity terminals (26+)
│
├── workers/
│   └── tdx-proxy.js           # Cloudflare Worker
│       ├── OAuth token mgmt   # Token caching
│       ├── Request proxying   # API forwarding
│       └── Error handling     # Retry logic
│
├── sw.js                      # Service Worker (291 lines)
│   ├── Install handler        # Cache static assets
│   ├── Activate handler       # Clean old caches
│   └── Fetch handler          # Multi-strategy routing
│
├── manifest.webapp            # PWA manifest
│   ├── App metadata           # Name, description
│   ├── Icons                  # Multiple sizes
│   └── Display config         # Standalone mode
│
├── img/                       # App icons
│   ├── icon-32.png
│   ├── icon-180.png
│   └── icon-512.png
│
├── favicon.ico
├── CLAUDE.md                  # AI assistant instructions
└── DESIGN.md                  # This document
```

### 2.3 Page Responsibilities

| Page | Primary Function | Data Source |
|------|------------------|-------------|
| `index.html` | Navigation hub | Static |
| `ubike.html` | Bike availability | YouBike API |
| `mrt.html` | Metro stations | Embedded JSON |
| `rail.html` | TRA stations | Embedded JSON |
| `thsr.html` | HSR schedules | Embedded JSON |
| `bus.html` | Bus routes/arrivals | TDX API |
| `tdx/*.html` | Static transport data | Embedded JSON |

---

## 3. Feature Specifications

### 3.1 YouBike Page (`ubike.html`)

#### 3.1.1 Dual View System

```
┌─────────────────────────────────────────────────────────┐
│  [Map View]  [List View]     City: [Taipei ▼]  [🔍]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  MAP VIEW:                    LIST VIEW:                │
│  ┌─────────────────────┐     ┌─────────────────────┐   │
│  │    Leaflet Map      │     │ Station | Bikes | ← │   │
│  │    with markers     │     │─────────┼───────┼───│   │
│  │                     │     │ Station1│  15   │2km│   │
│  │  [●] [●]    [●]     │     │ Station2│   8   │3km│   │
│  │      [●]            │     │ Station3│  22   │5km│   │
│  │           [●]       │     │   ...   │  ...  │...│   │
│  └─────────────────────┘     └─────────────────────┘   │
│                                                         │
│                              [EN] [📍]                  │
└─────────────────────────────────────────────────────────┘
```

#### 3.1.2 Marker Color Logic

```javascript
function getMarkerColor(station) {
  const bikes = station.available_rent_bikes;
  const slots = station.available_return_bikes;

  if (bikes === 0) return '#FF9E21';  // Orange: No bikes
  if (slots === 0) return '#FF4D00';  // Red: No slots
  return '#80FF00';                    // Green: Available
}
```

#### 3.1.3 Auto-Refresh Mechanism

```javascript
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function startAutoRefresh() {
  refreshTimer = setInterval(async () => {
    await loadStations();
    console.log('[UBike] Auto-refreshed');
  }, REFRESH_INTERVAL);
}
```

### 3.2 MRT Page (`mrt.html`)

#### 3.2.1 System Configuration

| System | Code | Lines | Stations |
|--------|------|-------|----------|
| Taipei Metro | TRTC | 7 | 131 |
| Kaohsiung Metro | KRTC | 3 | 61 |
| Taoyuan Metro | TYMC | 1 | 21 |
| Taichung Metro | TMRT | 1 | 18 |

#### 3.2.2 Line Definitions

```javascript
const MRT_SYSTEMS = {
  TRTC: {
    name: { en: 'Taipei Metro', zh: '台北捷運' },
    lines: {
      BR: { name: { en: 'Wenhu', zh: '文湖線' }, color: '#c48c31' },
      R:  { name: { en: 'Tamsui-Xinyi', zh: '淡水信義線' }, color: '#e3002c' },
      G:  { name: { en: 'Songshan-Xindian', zh: '松山新店線' }, color: '#008659' },
      O:  { name: { en: 'Zhonghe-Xinlu', zh: '中和新蘆線' }, color: '#f8b61c' },
      BL: { name: { en: 'Bannan', zh: '板南線' }, color: '#0070bd' },
      Y:  { name: { en: 'Circular', zh: '環狀線' }, color: '#fedb00' },
      LG: { name: { en: 'Ankeng LRT', zh: '安坑輕軌' }, color: '#64b32c' }
    }
  },
  // ... KRTC, TYMC, TMRT
};
```

#### 3.2.3 Dynamic Line Selector

```javascript
function updateLineSelect() {
  const lineEntries = Object.entries(system.lines);

  // Auto-hide if only one line option
  if (lineEntries.length === 1) {
    lineSelect.style.display = 'none';
    currentLine = lineEntries[0][0];
    return;
  }

  lineSelect.style.display = '';
  // Populate options...
}
```

### 3.3 Bus Page (`bus.html`)

#### 3.3.1 Tab Structure

```
┌─────────────────────────────────────────────────────────┐
│  [路線時刻]  [附近站牌]                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ROUTE SCHEDULE TAB:          NEARBY STOPS TAB:         │
│  ┌─────────────────────┐     ┌─────────────────────┐   │
│  │ City: [Taipei ▼]    │     │ Loading nearby...   │   │
│  │ Route: [307 ▼]      │     │                     │   │
│  │ From: [Stop A ▼]    │     │ ● Stop 1    300m    │   │
│  │ To:   [Stop B ▼]    │     │   307: 3 min        │   │
│  │                     │     │   205: 8 min        │   │
│  │ → 去程  ← 返程      │     │                     │   │
│  │                     │     │ ● Stop 2    450m    │   │
│  │ ┌─────────────────┐ │     │   307: 12 min       │   │
│  │ │ Fare: NT$15     │ │     │                     │   │
│  │ │ Duration: 25min │ │     └─────────────────────┘   │
│  │ └─────────────────┘ │                               │
│  │                     │                               │
│  │ 1. [●] First Stop   │                               │
│  │ 2. [●] Stop A ←Board│                               │
│  │ 3. [○] Mid Stop     │                               │
│  │ 4. [●] Stop B ←Exit │                               │
│  │ 5. [●] Last Stop    │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

#### 3.3.2 Rate Limiting Implementation

```javascript
// Configuration
const ROUTE_CACHE_KEY = 'bus-routes-cache';
const ROUTE_CACHE_TTL = 24 * 60 * 60 * 1000;  // 24 hours
const DEBOUNCE_DELAY = 300;                    // 300ms
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;              // 1 second

// Debounce utility
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// Fetch with retry and exponential backoff
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
  let lastError, lastResponse;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        lastResponse = response;
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
        console.warn(`[Bus] Rate limited, retry in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Max retries exceeded');
}

// localStorage cache functions
function loadRoutesFromCache(city) {
  const cache = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}');
  const cityCache = cache[city];

  if (!cityCache) return null;
  if (Date.now() - cityCache.timestamp > ROUTE_CACHE_TTL) return null;

  return cityCache.routes;
}

function saveRoutesToCache(city, routes) {
  const cache = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || '{}');
  cache[city] = { routes, timestamp: Date.now() };
  localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cache));
}
```

#### 3.3.3 Trip Calculation

```javascript
function calculateTripInfo(stops, originIdx, destIdx) {
  const originTime = parseTime(stops[originIdx].time);
  const destTime = parseTime(stops[destIdx].time);

  return {
    duration: destTime - originTime,           // minutes
    stopCount: destIdx - originIdx + 1,
    fare: calculateFare(stopCount),
    arrivalETA: calculateArrivalTime(nextBus, destTime)
  };
}
```

---

## 4. API Integration

### 4.1 YouBike API

| Property | Value |
|----------|-------|
| **Endpoint** | `https://apis.youbike.com.tw/json/station-yb2.json` |
| **Auth** | None (public) |
| **Format** | JSON |
| **Rate Limit** | None observed |
| **Update Frequency** | ~1 minute |

#### Response Schema

```json
{
  "sno": "500101001",
  "sna": "YouBike2.0_捷運市政府站(3號出口)",
  "snaen": "YouBike2.0_MRT Taipei City Hall Sta.(Exit 3)",
  "sarea": "信義區",
  "sareaen": "Xinyi Dist.",
  "ar": "忠孝東路/松仁路(東南側)",
  "aren": "Sec. 5, Zhongxiao E. Rd./Songren Rd.",
  "latitude": 25.0408578,
  "longitude": 121.5679244,
  "available_rent_bikes": 15,
  "available_return_bikes": 35,
  "total": 50,
  "updateTime": "2026-02-10 10:30:00",
  "srcUpdateTime": "2026-02-10 10:29:45"
}
```

### 4.2 TDX API

| Property | Value |
|----------|-------|
| **Base URL** | `https://tdx.transportdata.tw/api/basic` |
| **Auth** | OAuth 2.0 Client Credentials |
| **Proxy** | `https://tdx-proxy.owen-ouyang.workers.dev` |
| **Rate Limit** | 50 requests/minute (free tier) |

#### Endpoints Used

```
# Bus Routes
GET /v2/Bus/Route/City/{city}?$top=500&$format=JSON

# Bus Stops (Spatial Query)
GET /v2/Bus/Stop/City/{city}?$spatialFilter=nearby({lat},{lng},{radius})&$top=30&$format=JSON

# Route Stops (Display Order)
GET /v2/Bus/DisplayStopOfRoute/City/{city}/{routeName}?$format=JSON

# Real-time Arrivals
GET /v2/Bus/EstimatedTimeOfArrival/City/{city}?$filter={stopFilter}&$top=200&$format=JSON
```

#### OAuth Token Flow

```javascript
// Cloudflare Worker (tdx-proxy.js)
async function getAccessToken() {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  });

  const { access_token, expires_in } = await response.json();
  // Cache token for (expires_in - 60) seconds
  return access_token;
}
```

### 4.3 OpenStreetMap

| Property | Value |
|----------|-------|
| **Tile URL** | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| **Subdomains** | a, b, c |
| **Auth** | None |
| **Cache** | 7 days (Service Worker) |

```javascript
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);
```

---

## 5. Technology Stack

### 5.1 Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| HTML5 | - | Semantic structure, PWA meta tags |
| CSS3 | - | Flexbox, Grid, animations, media queries |
| JavaScript | ES6+ | async/await, modules, destructuring |

### 5.2 External Libraries

| Library | Version | CDN | Size | Purpose |
|---------|---------|-----|------|---------|
| Leaflet | 1.9.4 | unpkg.com | 144KB | Interactive maps |

### 5.3 Browser APIs

| API | Usage | Fallback |
|-----|-------|----------|
| Geolocation | User location | Show all stations |
| localStorage | Preferences, cache | Memory only |
| Service Worker | Offline, caching | Online only |
| Fetch | HTTP requests | N/A (required) |

### 5.4 Development Tools

```bash
# No build system required

# Local development
python -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000

# Testing
# Manual browser testing with Chrome DevTools
# Lighthouse PWA audit
```

---

## 6. Data Structures

### 6.1 YouBike Station (Normalized)

```typescript
interface YouBikeStation {
  sno: string;                    // Station ID
  sna: string;                    // Chinese name
  snaen: string;                  // English name
  latitude: number;
  longitude: number;
  available_rent_bikes: number;   // Bikes available
  available_return_bikes: number; // Empty slots
  total: number;                  // Total capacity
  city: string;                   // City key
  areaCode: string;               // API area code
  updateTime: string;             // Last update
}
```

### 6.2 MRT Station

```typescript
interface MRTStation {
  id: string;                     // e.g., "BR01"
  name: {
    en: string;
    zh: string;
  };
  line: string;                   // Line code
  system: string;                 // System code
  lat: number;
  lng: number;
  address?: string;
}
```

### 6.3 Bus Route

```typescript
interface BusRoute {
  id: string;                     // Route number
  name: {
    en: string;
    zh: string;
  };
  terminals: {
    en: string;                   // "Start - End"
    zh: string;
  };
  routeUID: string;               // TDX unique ID
  subRouteId?: string;
}
```

### 6.4 Bus Stop

```typescript
interface BusStop {
  id: string;                     // Stop UID
  name: {
    en: string;
    zh: string;
  };
  lat: number;
  lng: number;
  address?: string;
  sequence?: number;              // Order in route
  time?: string;                  // Estimated time
}
```

### 6.5 Arrival Info

```typescript
interface ArrivalInfo {
  route: string;                  // Route name (Chinese)
  routeEn: string;                // Route name (English)
  estimateTime: number;           // Seconds until arrival
  stopStatus: number;             // 0=normal, 1=arriving, 2+=special
  direction: number;              // 0=outbound, 1=inbound
}
```

---

## 7. Caching & Offline Strategy

### 7.1 Service Worker Cache Strategies

```javascript
// sw.js

const STATIC_CACHE = 'transport-static-v1';
const API_CACHE = 'transport-api-v1';
const TILE_CACHE = 'transport-tiles-v1';

// Strategy 1: Cache-First (Static assets)
async function cacheFirst(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached && !isExpired(cached, ttl)) {
    return cached;
  }

  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
}

// Strategy 2: Network-First (Real-time data)
async function networkFirst(request, cacheName, ttl) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

// Strategy 3: Stale-While-Revalidate (YouBike)
async function staleWhileRevalidate(request, cacheName, ttl) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    cache.put(request, response.clone());
    return response;
  });

  if (cached && !isExpired(cached, ttl)) {
    return cached;
  }

  return fetchPromise;
}
```

### 7.2 Cache TTL Configuration

| Resource | Strategy | TTL | Rationale |
|----------|----------|-----|-----------|
| HTML/JS/CSS | Cache-First | 24 hours | Rarely changes |
| Map Tiles | Cache-First | 7 days | Static imagery |
| YouBike API | Stale-While-Revalidate | 5 min | Semi-real-time |
| TDX API | Network-First | 30 sec | Real-time critical |
| Route Cache | localStorage | 24 hours | Rarely changes |

### 7.3 localStorage Schema

```javascript
// Preferences
{
  'ubike-lang': 'en' | 'zh',
  'ubike-city': 'Taipei',
  'ubike-view': 'map' | 'list',
  'bus-city': 'Taipei',
  'mrt-system': 'TRTC'
}

// Route Cache
{
  'bus-routes-cache': {
    'Taipei': {
      routes: [...],
      timestamp: 1707500000000
    },
    'Kaohsiung': {
      routes: [...],
      timestamp: 1707490000000
    }
  }
}
```

---

## 8. State Management

### 8.1 State Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Application State                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  UI State    │  │  Data State  │  │ User State   │  │
│  │  (Memory)    │  │  (Memory)    │  │ (localStorage)│ │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  │
│  │ currentView  │  │ stations[]   │  │ language     │  │
│  │ selectedItem │  │ routes[]     │  │ city         │  │
│  │ searchQuery  │  │ arrivals{}   │  │ viewMode     │  │
│  │ isLoading    │  │ markers{}    │  │ preferences  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 8.2 State Variables by Page

#### YouBike (`ubike.js`)
```javascript
let map = null;              // Leaflet instance
let markers = {};            // Marker collection
let stations = [];           // All stations
let currentCity = 'Taipei';  // Selected city
let currentView = 'map';     // 'map' | 'list'
let searchQuery = '';        // Filter string
let userLocation = null;     // { lat, lng }
let isZh = false;            // Language flag
let refreshTimer = null;     // Auto-refresh timer
```

#### Bus (`bus.js`)
```javascript
let map = null;
let markers = {};
let userMarker = null;
let userLocation = null;
let currentCity = 'Taipei';
let busStops = [];
let arrivalData = {};
let selectedStop = null;

// Route schedule state
let currentRouteCity = 'Taipei';
let currentRoute = '';
let routeDirection = 'go';    // 'go' | 'back'
let selectedOriginStop = null;
let selectedDestStop = null;
let fetchedRoutes = {};       // Memory cache
let fetchedRouteStops = {};   // Memory cache
let isLoadingRoutes = false;
let isLoadingStops = false;
```

### 8.3 State Persistence

```javascript
// Save state
function savePreferences() {
  localStorage.setItem('ubike-lang', isZh ? 'zh' : 'en');
  localStorage.setItem('ubike-city', currentCity);
  localStorage.setItem('ubike-view', currentView);
}

// Restore state
function restorePreferences() {
  const savedLang = localStorage.getItem('ubike-lang');
  if (savedLang) isZh = savedLang === 'zh';

  const savedCity = localStorage.getItem('ubike-city');
  if (savedCity && CITIES[savedCity]) currentCity = savedCity;

  const savedView = localStorage.getItem('ubike-view');
  if (savedView) currentView = savedView;
}
```

---

## 9. UI/UX Design System

### 9.1 Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#1976d2` | Headers, buttons, links |
| Primary Dark | `#0d47a1` | Gradients, hover states |
| Success | `#4CAF50` | Available, positive |
| Warning | `#FF9E21` | Low availability |
| Danger | `#FF4D00` | No availability |
| Accent Orange | `#FF9800` | Home button |
| Background | `#f5f5f5` | Page background |
| Surface | `#ffffff` | Cards, panels |
| Text Primary | `#333333` | Main text |
| Text Secondary | `#666666` | Descriptions |

### 9.2 MRT Line Colors

| Line | Code | Color |
|------|------|-------|
| Wenhu | BR | `#c48c31` |
| Tamsui-Xinyi | R | `#e3002c` |
| Songshan-Xindian | G | `#008659` |
| Zhonghe-Xinlu | O | `#f8b61c` |
| Bannan | BL | `#0070bd` |
| Circular | Y | `#fedb00` |
| Ankeng LRT | LG | `#64b32c` |
| Kaohsiung Red | KR | `#e3012c` |
| Kaohsiung Orange | KO | `#faa73f` |
| Kaohsiung Circular | KC | `#c1d72e` |
| Taoyuan Airport | A | `#6f4698` |
| Taichung Green | TG | `#9dd166` |

### 9.3 Typography

```css
/* Font Stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
             Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Scale */
--font-size-xs: 11px;   /* Labels */
--font-size-sm: 12px;   /* Secondary text */
--font-size-base: 14px; /* Body text */
--font-size-md: 16px;   /* Emphasized */
--font-size-lg: 1.2em;  /* Subheadings */
--font-size-xl: 1.5em;  /* Page titles */
```

### 9.4 Spacing

```css
/* Spacing Scale */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 20px;
--space-xxl: 24px;
```

### 9.5 Component Patterns

#### Header
```css
header {
  background: linear-gradient(135deg, #1976d2, #0d47a1);
  color: white;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

#### Float Buttons
```css
.float-btn-container {
  position: fixed;
  bottom: 20px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
}

.float-btn {
  width: 44px;
  height: 44px;
  background: white;
  border: 2px solid rgba(0,0,0,0.2);
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
```

#### Split Panel Layout
```css
.container {
  display: flex;
  height: calc(100vh - 52px);
}

#panel {
  width: 380px;
  overflow-y: auto;
  border-right: 1px solid #ccc;
}

#map-canvas {
  flex: 1;
}
```

### 9.6 Responsive Breakpoints

```css
/* Mobile First */
@media (max-width: 768px) {
  header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .container {
    flex-direction: column;
  }

  #panel {
    width: 100%;
    height: 45%;
  }

  #map-canvas {
    height: 55%;
  }
}

@media (max-width: 480px) {
  /* Extra small adjustments */
  .nav-btn {
    padding: 4px 6px;
    font-size: 10px;
  }
}
```

---

## 10. Performance Optimizations

### 10.1 Network Optimizations

| Technique | Implementation |
|-----------|----------------|
| **Request Deduplication** | Memory cache before API call |
| **Debouncing** | 300ms delay on city changes |
| **Retry with Backoff** | 1s → 2s → 4s on 429 errors |
| **Response Caching** | Service Worker + localStorage |
| **Conditional Requests** | ETag/Last-Modified headers |

### 10.2 Rendering Optimizations

| Technique | Implementation |
|-----------|----------------|
| **Lazy Marker Creation** | Create markers on demand |
| **Virtual Scrolling** | Future: For 2000+ stations |
| **CSS Containment** | `contain: layout` on cards |
| **GPU Acceleration** | `transform` for animations |

### 10.3 Bundle Size

| Resource | Size | Notes |
|----------|------|-------|
| Leaflet JS | 144KB | CDN cached |
| Leaflet CSS | 14KB | CDN cached |
| common.js | 15KB | Shared utilities |
| ubike.js | 28KB | YouBike controller |
| bus.js | 55KB | Bus controller |
| **Total JS** | ~100KB | Unminified |

### 10.4 Core Web Vitals Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | Preload critical CSS, defer JS |
| FID | < 100ms | No long tasks, debounced handlers |
| CLS | < 0.1 | Fixed dimensions, no layout shifts |

---

## 11. Localization

### 11.1 Supported Languages

| Language | Code | Coverage |
|----------|------|----------|
| English | `en` | 100% |
| Traditional Chinese | `zh` | 100% |

### 11.2 Implementation Approach

#### HTML Attributes
```html
<button data-en="Search" data-zh="搜尋">Search</button>
<span data-en="Available" data-zh="可借">Available</span>
```

#### JavaScript Labels
```javascript
const LABELS = {
  search: { en: 'Search', zh: '搜尋' },
  available: { en: 'Available', zh: '可借' },
  noData: { en: 'No data', zh: '無資料' }
};

function t(key) {
  return LABELS[key][isZh ? 'zh' : 'en'];
}
```

#### Language Detection
```javascript
function detectLanguage() {
  // 1. Check localStorage
  const saved = localStorage.getItem('ubike-lang');
  if (saved) return saved;

  // 2. Check browser language
  const browserLang = navigator.language || navigator.userLanguage;
  return browserLang.startsWith('zh') ? 'zh' : 'en';
}
```

### 11.3 Localized Content

| Content Type | Method |
|--------------|--------|
| UI Labels | `data-en`/`data-zh` attributes |
| Page Titles | JavaScript `document.title` |
| Error Messages | LABELS object |
| Station Names | API response (both languages) |
| Distance Units | Conditional formatting |
| Time Formats | `toLocaleTimeString()` |

---

## 12. Error Handling

### 12.1 Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| Network | Offline, timeout | Service Worker cache |
| API | 429, 500, auth fail | Retry, fallback, message |
| Geolocation | Denied, unavailable | Show all stations |
| Data | Missing fields | Default values |
| UI | Element not found | Graceful skip |

### 12.2 Error Handling Patterns

#### Network Errors
```javascript
async function fetchWithFallback(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[API] Error:', error);

    // Try cache
    const cached = await caches.match(url);
    if (cached) return cached.json();

    // Return empty/default
    return [];
  }
}
```

#### Geolocation Errors
```javascript
async function getUserLocation() {
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      });
    });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (error) {
    const messages = {
      1: isZh ? '請允許位置權限' : 'Please allow location permission',
      2: isZh ? '無法取得位置' : 'Location unavailable',
      3: isZh ? '定位逾時' : 'Location timeout'
    };
    alert(messages[error.code] || messages[2]);
    return null;
  }
}
```

### 12.3 User Feedback

| State | UI Feedback |
|-------|-------------|
| Loading | Spinner + "Loading..." text |
| Error | Error message + retry option |
| Empty | "No results" message |
| Offline | "Offline mode" indicator |

---

## 13. Security Considerations

### 13.1 API Security

| Concern | Mitigation |
|---------|------------|
| TDX Credentials | Stored in Cloudflare Worker (not client) |
| Token Exposure | Proxy handles all auth |
| Rate Limiting | Client-side throttling |
| CORS | Proxy adds appropriate headers |

### 13.2 Data Security

| Concern | Mitigation |
|---------|------------|
| XSS | No innerHTML with user input |
| Injection | Parameterized API queries |
| Storage | No sensitive data in localStorage |

### 13.3 Privacy

| Data | Handling |
|------|----------|
| Location | Requested only when needed |
| Preferences | Local only, not transmitted |
| Analytics | None currently implemented |

---

## 14. Design Philosophy

### 14.1 Core Principles

#### 1. Offline-First
> The app should work without network connectivity

- Service Worker caches all static assets
- Stale data served while fetching fresh
- Graceful degradation when offline

#### 2. Mobile-First Responsive
> Design for mobile, enhance for desktop

- Touch-friendly targets (44px minimum)
- Thumb-reachable UI elements
- Progressive enhancement for larger screens

#### 3. Zero Build Complexity
> No build tools, transpilers, or bundlers

- Direct ES6+ in browser
- CDN-hosted libraries
- Simple local development

#### 4. Data Locality
> Embed static data, fetch only real-time

- MRT/Rail/THSR stations embedded in HTML
- Reduces API calls for rarely-changing data
- Faster initial load

#### 5. Bilingual by Default
> Every user-facing string has EN/中文

- Auto-detect from browser
- Persistent preference
- Complete coverage

#### 6. Graceful Degradation
> Always show something useful

- No JS → Links still work
- No GPS → Show all stations
- No network → Show cached data
- API down → Demo mode

#### 7. Performance Budget
> Fast is a feature

- No heavy frameworks
- Minimal dependencies
- Efficient caching

#### 8. Single Responsibility
> Each module does one thing well

- `common.js` → Shared utilities only
- `ubike.js` → YouBike logic only
- `bus.js` → Bus logic only

### 14.2 Trade-offs

| Decision | Trade-off |
|----------|-----------|
| No framework | More boilerplate, but smaller bundle |
| Embedded data | Larger HTML, but fewer API calls |
| No build step | No minification, but simpler workflow |
| localStorage | Size limits, but no server needed |

---

## 15. Future Roadmap

### 15.1 Short-term Improvements

| Feature | Priority | Effort |
|---------|----------|--------|
| Virtual scrolling | High | Medium |
| Favorites system | High | Low |
| Route planning | Medium | High |
| Push notifications | Medium | Medium |
| Offline indicators | Low | Low |

### 15.2 Medium-term Features

| Feature | Description |
|---------|-------------|
| **Trip Planner** | Multi-modal journey planning |
| **Accessibility** | ARIA labels, keyboard nav, screen reader |
| **Analytics** | Usage tracking, error monitoring |
| **More Languages** | Japanese, Korean, English variants |

### 15.3 Long-term Vision

| Initiative | Description |
|------------|-------------|
| **Native Apps** | iOS/Android with shared core |
| **Real-time Updates** | WebSocket for live arrivals |
| **Community** | User-contributed data, corrections |
| **Monetization** | Premium features, ads (optional) |

### 15.4 Technical Debt

| Item | Priority |
|------|----------|
| Add unit tests | High |
| TypeScript migration | Medium |
| Code documentation | Medium |
| Refactor legacy util.js | Low |

---

## Appendix

### A. Browser Support Matrix

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 80+ | Full |
| Firefox | 75+ | Full |
| Safari | 13+ | Full |
| Edge | 80+ | Full |
| iOS Safari | 13+ | Full |
| Android Chrome | 80+ | Full |
| IE | Any | Not Supported |

### B. Performance Benchmarks

| Metric | Value | Measured On |
|--------|-------|-------------|
| First Paint | ~800ms | 4G, mid-range phone |
| TTI | ~1.5s | 4G, mid-range phone |
| Bundle Size | ~100KB JS | Uncompressed |
| Cache Size | ~5MB | Full app + tiles |

### C. API Rate Limits

| API | Limit | Handling |
|-----|-------|----------|
| YouBike | None observed | N/A |
| TDX (Free) | 50/min | Retry + cache |
| OSM Tiles | Fair use | Cache 7 days |

---

*Document Version: 1.0*
*Last Updated: February 2026*
