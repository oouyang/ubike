'use strict';

/**
 * Taiwan Bus - Nearby Stops & Arrivals
 * JavaScript module for bus.html
 */

// ===========================================
// TDX API Configuration
// ===========================================
//
// Using Cloudflare Worker Proxy (handles TDX authentication)
const TDX_PROXY_URL = 'https://tdx-proxy.owen-ouyang.workers.dev';
//
// Direct API credentials (not used when proxy is configured)
const TDX_CONFIG = {
    clientId: '',
    clientSecret: '',
    authUrl: 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
    apiUrl: 'https://tdx.transportdata.tw/api/basic'
};
// ===========================================

// ===========================================
// Rate Limiting & Caching Configuration
// ===========================================
const ROUTE_CACHE_KEY = 'bus-routes-cache';
const ROUTE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEBOUNCE_DELAY = 300; // 300ms debounce for city changes
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

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
    let lastError;
    let lastResponse;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                // Rate limited - wait and retry with exponential backoff
                lastResponse = response;
                const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
                console.warn(`[Bus] Rate limited (429), retrying in ${delay}ms... (attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            return response;
        } catch (error) {
            lastError = error;
            if (i < retries - 1) {
                const delay = INITIAL_RETRY_DELAY * Math.pow(2, i);
                console.warn(`[Bus] Request failed, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    // If we exhausted all retries due to 429, return the last 429 response
    // so the caller can handle it gracefully
    if (lastResponse) {
        console.warn('[Bus] All retries exhausted for 429 rate limiting');
        return lastResponse;
    }
    throw lastError || new Error('Max retries exceeded');
}

// Load routes from localStorage cache
function loadRoutesFromCache(city) {
    try {
        const cacheStr = localStorage.getItem(ROUTE_CACHE_KEY);
        if (!cacheStr) return null;

        const cache = JSON.parse(cacheStr);
        const cityCache = cache[city];

        if (!cityCache) return null;

        // Check if cache is expired
        if (Date.now() - cityCache.timestamp > ROUTE_CACHE_TTL) {
            console.log(`[Bus] Cache expired for ${city}`);
            return null;
        }

        console.log(`[Bus] Loaded ${cityCache.routes.length} routes from cache for ${city}`);
        return cityCache.routes;
    } catch (error) {
        console.warn('[Bus] Error loading routes from cache:', error);
        return null;
    }
}

// Save routes to localStorage cache
function saveRoutesToCache(city, routes) {
    try {
        const cacheStr = localStorage.getItem(ROUTE_CACHE_KEY);
        const cache = cacheStr ? JSON.parse(cacheStr) : {};

        cache[city] = {
            routes: routes,
            timestamp: Date.now()
        };

        localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(cache));
        console.log(`[Bus] Cached ${routes.length} routes for ${city}`);
    } catch (error) {
        console.warn('[Bus] Error saving routes to cache:', error);
    }
}
// ===========================================

// City configurations
const BUS_CITIES = {
    Taipei: { name: { en: 'Taipei', zh: '台北市' }, center: [25.0330, 121.5654] },
    NewTaipei: { name: { en: 'New Taipei', zh: '新北市' }, center: [25.0119, 121.4650] },
    Taoyuan: { name: { en: 'Taoyuan', zh: '桃園市' }, center: [24.9936, 121.3010] },
    Taichung: { name: { en: 'Taichung', zh: '台中市' }, center: [24.1477, 120.6736] },
    Tainan: { name: { en: 'Tainan', zh: '台南市' }, center: [22.9998, 120.2270] },
    Kaohsiung: { name: { en: 'Kaohsiung', zh: '高雄市' }, center: [22.6273, 120.3014] },
    Keelung: { name: { en: 'Keelung', zh: '基隆市' }, center: [25.1276, 121.7392] },
    Hsinchu: { name: { en: 'Hsinchu', zh: '新竹市' }, center: [24.8138, 120.9675] },
    HsinchuCounty: { name: { en: 'Hsinchu County', zh: '新竹縣' }, center: [24.8387, 121.0178] },
    MiaoliCounty: { name: { en: 'Miaoli', zh: '苗栗縣' }, center: [24.5602, 120.8214] },
    ChanghuaCounty: { name: { en: 'Changhua', zh: '彰化縣' }, center: [24.0518, 120.5161] },
    NantouCounty: { name: { en: 'Nantou', zh: '南投縣' }, center: [23.9158, 120.6839] },
    YunlinCounty: { name: { en: 'Yunlin', zh: '雲林縣' }, center: [23.7092, 120.4313] },
    ChiayiCounty: { name: { en: 'Chiayi County', zh: '嘉義縣' }, center: [23.4518, 120.2555] },
    Chiayi: { name: { en: 'Chiayi City', zh: '嘉義市' }, center: [23.4800, 120.4491] },
    PingtungCounty: { name: { en: 'Pingtung', zh: '屏東縣' }, center: [22.6762, 120.4929] },
    YilanCounty: { name: { en: 'Yilan', zh: '宜蘭縣' }, center: [24.7517, 121.7583] },
    HualienCounty: { name: { en: 'Hualien', zh: '花蓮縣' }, center: [23.9917, 121.6011] },
    TaitungCounty: { name: { en: 'Taitung', zh: '台東縣' }, center: [22.7583, 121.1444] },
    KinmenCounty: { name: { en: 'Kinmen', zh: '金門縣' }, center: [24.4493, 118.3767] },
    PenghuCounty: { name: { en: 'Penghu', zh: '澎湖縣' }, center: [23.5711, 119.5793] }
};

// State
let map = null;
let markers = {};
let userMarker = null;
let userLocation = null;
let currentCity = 'Taipei';
let busStops = [];
let arrivalData = {};
let selectedStop = null;
let searchQuery = '';
let accessToken = null;
let tokenExpiry = 0;
let isZh = (typeof detectLanguage === 'function') ? detectLanguage() === 'zh' : (navigator.language || navigator.userLanguage).startsWith('zh');
let refreshTimer = null;
let scheduleTimer = null;

// Route schedule state
let currentRouteCity = 'Taipei';
let currentRoute = '';
let routeDirection = 'go';
let routeSearchQuery = '';
let selectedOriginStop = null;
let selectedDestStop = null;
let fetchedRoutes = {}; // Cache for fetched routes by city
let fetchedRouteStops = {}; // Cache for fetched route stops
let isLoadingRoutes = false;
let isLoadingStops = false;

// Use shared utilities from common.js: deg2rad, getDistanceInMeters, formatDistance, formatTime, getCurrentMinutes, getCountdown

function toggleLang() {
    isZh = !isZh;
    if (typeof saveLanguage === 'function') {
        saveLanguage(isZh ? 'zh' : 'en');
    } else {
        localStorage.setItem('ubike-lang', isZh ? 'zh' : 'en');
    }
    updateUI();
}

function updateUI() {
    document.title = isZh ? '台灣公車' : 'Taiwan Bus';
    document.getElementById('page-title').textContent = isZh ? '台灣公車' : 'Taiwan Bus';
    document.getElementById('search-input').placeholder = isZh ? '搜尋站牌或路線...' : 'Search stops or routes...';
    const routeSearchInput = document.getElementById('route-search-input');
    if (routeSearchInput) {
        routeSearchInput.placeholder = isZh ? '搜尋路線...' : 'Search route...';
    }

    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const text = isZh ? btn.dataset.zh : btn.dataset.en;
        if (text) btn.textContent = text;
    });

    // Update tab buttons (Schedule/Nearby)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const text = isZh ? btn.dataset.zh : btn.dataset.en;
        if (text) btn.textContent = text;
    });

    // Update all elements with data-en/data-zh (direction tabs, labels, etc.)
    document.querySelectorAll('[data-en][data-zh]').forEach(el => {
        // Skip elements already handled above
        if (el.classList.contains('nav-btn') || el.classList.contains('tab-btn')) return;
        const text = isZh ? el.dataset.zh : el.dataset.en;
        if (text) el.textContent = text;
    });

    // Update city selector
    const select = document.getElementById('city-select');
    Array.from(select.options).forEach(opt => {
        const city = BUS_CITIES[opt.value];
        if (city) {
            opt.textContent = isZh ? city.name.zh : city.name.en;
        }
    });

    renderStopList();
    updatePopups();

    // Update route schedule UI
    updateRouteSelector();
    renderRouteSchedule();

    // Update locate button title
    const locateBtn = document.querySelector('.locate-btn');
    if (locateBtn) {
        locateBtn.title = isZh ? '定位我的位置' : 'Center to my location';
    }

    // Update language button text
    const langBtn = document.getElementById('lang-btn');
    if (langBtn) {
        langBtn.textContent = isZh ? '中' : 'EN';
    }
}

// ===== Tab Management =====

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

            // Update map markers based on active tab
            if (btn.dataset.tab === 'schedule') {
                // Remove user marker when on schedule tab
                if (userMarker) {
                    map.removeLayer(userMarker);
                    userMarker = null;
                }
                updateRouteMapMarkers();
            } else if (btn.dataset.tab === 'nearby') {
                // Load nearby stops if not loaded yet
                if (busStops.length === 0) {
                    await loadNearbyStops();
                } else {
                    updateMarkers();
                }
                // Add user marker if we have location
                if (userLocation && !userMarker) {
                    userMarker = L.marker([userLocation.lat, userLocation.lng], {
                        icon: createMarkerIcon(true)
                    }).addTo(map);
                    userMarker.bindPopup(isZh ? '您的位置' : 'Your Location');
                }
                // Center on user location or city
                if (userLocation) {
                    map.setView([userLocation.lat, userLocation.lng], 16);
                } else {
                    const cityData = BUS_CITIES[currentCity];
                    if (cityData) map.setView(cityData.center, 14);
                }
            }
        });
    });
}

// ===== Route Schedule Functions =====

function updateRouteCitySelector() {
    const select = document.getElementById('route-city-select');
    if (!select) return;

    Array.from(select.options).forEach(opt => {
        const city = BUS_CITIES[opt.value];
        if (city) {
            opt.textContent = isZh ? city.name.zh : city.name.en;
        }
    });
}

async function updateRouteSelector() {
    const select = document.getElementById('route-select');
    if (!select) return;

    // Show loading state
    if (isLoadingRoutes) {
        select.innerHTML = `<option value="">${isZh ? '載入路線中...' : 'Loading routes...'}</option>`;
        return;
    }

    // Fetch routes from TDX (or use cache)
    let routes = fetchedRoutes[currentRouteCity];
    if (!routes) {
        isLoadingRoutes = true;
        select.innerHTML = `<option value="">${isZh ? '載入路線中...' : 'Loading routes...'}</option>`;
        routes = await fetchRoutes(currentRouteCity);
        isLoadingRoutes = false;
    }

    const currentValue = select.value;

    // Filter by search query
    let filteredRoutes = routes;
    if (routeSearchQuery) {
        const q = routeSearchQuery.toLowerCase();
        filteredRoutes = routes.filter(route =>
            route.id.toLowerCase().includes(q) ||
            route.name.en.toLowerCase().includes(q) ||
            route.name.zh.includes(q) ||
            route.terminals.en.toLowerCase().includes(q) ||
            route.terminals.zh.includes(q)
        );
    }

    // Show count
    const countLabel = filteredRoutes.length > 0 ? ` (${filteredRoutes.length})` : '';

    if (routes.length === 0) {
        select.innerHTML = `<option value="">${isZh ? '無法載入路線' : 'Could not load routes'}</option>`;
    } else if (filteredRoutes.length === 0) {
        select.innerHTML = `<option value="">${isZh ? '找不到路線' : 'No routes found'}</option>`;
    } else {
        select.innerHTML = `<option value="">${isZh ? '-- 選擇路線 --' : '-- Select Route --'}${countLabel}</option>`;
        filteredRoutes.forEach(route => {
            const name = isZh ? route.name.zh : route.name.en;
            const terminals = isZh ? route.terminals.zh : route.terminals.en;
            select.innerHTML += `<option value="${route.id}">${name} (${terminals})</option>`;
        });
    }

    // Restore selection if still valid
    if (filteredRoutes.some(r => r.id === currentValue)) {
        select.value = currentValue;
    }

    // Update city selector text
    updateRouteCitySelector();
}

async function onRouteSearch() {
    const input = document.getElementById('route-search-input');
    routeSearchQuery = input ? input.value.trim() : '';
    await updateRouteSelector();
}

async function _onRouteCityChangeImpl() {
    const select = document.getElementById('route-city-select');
    currentRouteCity = select.value;
    currentRoute = '';
    selectedOriginStop = null;
    selectedDestStop = null;
    routeSearchQuery = ''; // Clear search

    // Clear search input
    const searchInput = document.getElementById('route-search-input');
    if (searchInput) searchInput.value = '';

    // Clear route stops cache for this city to force fresh fetch
    Object.keys(fetchedRouteStops).forEach(key => {
        if (key.startsWith(currentRouteCity + '_')) {
            delete fetchedRouteStops[key];
        }
    });

    // Clear map markers
    updateRouteMapMarkers();

    await updateRouteSelector();
    renderRouteSchedule();
}

// Debounced version to prevent rapid API calls
const onRouteCityChange = debounce(_onRouteCityChangeImpl, DEBOUNCE_DELAY);

async function onRouteChange() {
    const select = document.getElementById('route-select');
    currentRoute = select.value;
    selectedOriginStop = null;
    selectedDestStop = null;

    if (currentRoute) {
        // Show loading state
        isLoadingStops = true;
        renderRouteSchedule(); // Show loading indicator

        // Fetch stops for both directions
        await Promise.all([
            fetchRouteStopsFromTDX(currentRouteCity, currentRoute, 'go'),
            fetchRouteStopsFromTDX(currentRouteCity, currentRoute, 'back')
        ]);

        isLoadingStops = false;
    }

    updateStopSelectors();
    renderRouteSchedule();
    updateRouteMapMarkers();
}

function updateStopSelectors() {
    const container = document.getElementById('stop-selectors');
    const originSelect = document.getElementById('origin-stop-select');
    const destSelect = document.getElementById('dest-stop-select');

    if (!container || !originSelect || !destSelect) return;

    if (!currentRoute) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    const stops = getRouteStops(currentRoute, routeDirection);

    // Populate origin selector
    originSelect.innerHTML = `<option value="">${isZh ? '-- 起站 --' : '-- Origin --'}</option>`;
    stops.forEach((stop, idx) => {
        const name = isZh ? stop.name.zh : stop.name.en;
        originSelect.innerHTML += `<option value="${idx}">${idx + 1}. ${name}</option>`;
    });

    // Populate destination selector
    destSelect.innerHTML = `<option value="">${isZh ? '-- 迄站 --' : '-- Destination --'}</option>`;
    stops.forEach((stop, idx) => {
        const name = isZh ? stop.name.zh : stop.name.en;
        destSelect.innerHTML += `<option value="${idx}">${idx + 1}. ${name}</option>`;
    });

    // Restore selections
    if (selectedOriginStop !== null) {
        originSelect.value = selectedOriginStop;
    }
    if (selectedDestStop !== null) {
        destSelect.value = selectedDestStop;
    }

    // Update destination options based on origin
    updateDestStopOptions();
}

function updateDestStopOptions() {
    const destSelect = document.getElementById('dest-stop-select');
    if (!destSelect) return;

    const originIdx = selectedOriginStop !== null ? parseInt(selectedOriginStop) : -1;

    // Disable stops before origin (can only travel forward on a route)
    Array.from(destSelect.options).forEach((opt, idx) => {
        if (idx === 0) return; // Skip placeholder
        const stopIdx = parseInt(opt.value);
        opt.disabled = stopIdx <= originIdx;
    });
}

function onStopSelectorChange() {
    const originSelect = document.getElementById('origin-stop-select');
    const destSelect = document.getElementById('dest-stop-select');

    selectedOriginStop = originSelect.value !== '' ? originSelect.value : null;
    selectedDestStop = destSelect.value !== '' ? destSelect.value : null;

    updateDestStopOptions();

    // Clear invalid destination selection
    if (selectedDestStop !== null && selectedOriginStop !== null) {
        if (parseInt(selectedDestStop) <= parseInt(selectedOriginStop)) {
            destSelect.value = '';
            selectedDestStop = null;
        }
    }

    renderRouteSchedule();
    updateRouteMapMarkers(); // Update map to highlight selected stops
}

async function setRouteDirection(dir) {
    routeDirection = dir;
    document.querySelectorAll('.direction-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.dir === dir);
    });
    // Reset stop selections when direction changes
    selectedOriginStop = null;
    selectedDestStop = null;

    // Fetch stops for new direction if not cached
    if (currentRoute) {
        const cacheKey = `${currentRouteCity}_${currentRoute}_${dir}`;
        if (!fetchedRouteStops[cacheKey]) {
            isLoadingStops = true;
            renderRouteSchedule();
            await fetchRouteStopsFromTDX(currentRouteCity, currentRoute, dir);
            isLoadingStops = false;
        }
    }

    updateStopSelectors();
    renderRouteSchedule();
    updateRouteMapMarkers();
}

function getRouteStops(routeId, direction) {
    // Get fetched TDX data from cache
    const cacheKey = `${currentRouteCity}_${routeId}_${direction}`;
    return fetchedRouteStops[cacheKey] || [];
}

function getRouteScheduleInfo(routeId) {
    // Default schedule info (TDX doesn't provide detailed schedule intervals)
    return { firstBus: '06:00', lastBus: '22:00', peakInterval: 10, offPeakInterval: 15 };
}

function getRouteFareInfo(routeId) {
    // Default fare info (TDX provides fare info separately if needed)
    return { baseFare: 15, sections: 1, totalFare: 15, transferDiscount: true };
}

function calculateTotalJourneyTime(stops) {
    if (!stops || stops.length < 2) return 0;
    const firstTime = stops[0].time.split(':').map(Number);
    const lastTime = stops[stops.length - 1].time.split(':').map(Number);
    const firstMinutes = firstTime[0] * 60 + firstTime[1];
    const lastMinutes = lastTime[0] * 60 + lastTime[1];
    return lastMinutes - firstMinutes;
}

function getNextBusTime(scheduleInfo) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse first and last bus times
    const [firstH, firstM] = scheduleInfo.firstBus.split(':').map(Number);
    const [lastH, lastM] = scheduleInfo.lastBus.split(':').map(Number);
    const firstBusMinutes = firstH * 60 + firstM;
    const lastBusMinutes = lastH * 60 + lastM;

    // Check if within service hours
    if (currentMinutes < firstBusMinutes) {
        return { time: scheduleInfo.firstBus, waitMinutes: firstBusMinutes - currentMinutes };
    }
    if (currentMinutes > lastBusMinutes) {
        return { time: null, waitMinutes: null, ended: true };
    }

    // Determine interval (peak hours: 7-9, 17-19)
    const hour = now.getHours();
    const isPeak = (hour >= 7 && hour < 9) || (hour >= 17 && hour < 19);
    const interval = isPeak ? scheduleInfo.peakInterval : scheduleInfo.offPeakInterval;

    // Calculate next bus
    const minutesSinceFirst = currentMinutes - firstBusMinutes;
    const bussesPassed = Math.floor(minutesSinceFirst / interval);
    const nextBusMinutes = firstBusMinutes + (bussesPassed + 1) * interval;

    if (nextBusMinutes > lastBusMinutes) {
        return { time: null, waitMinutes: null, ended: true };
    }

    const nextH = Math.floor(nextBusMinutes / 60);
    const nextM = nextBusMinutes % 60;
    const timeStr = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`;

    return { time: timeStr, waitMinutes: nextBusMinutes - currentMinutes };
}

function renderRouteSchedule() {
    const listEl = document.getElementById('route-stop-list');
    const timeEl = document.getElementById('schedule-time');
    if (!listEl) return;

    // Update current time
    const now = new Date();
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString(isZh ? 'zh-TW' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    }

    // Update data-en/data-zh elements
    document.querySelectorAll('#tab-schedule [data-en]').forEach(el => {
        const text = isZh ? el.dataset.zh : el.dataset.en;
        if (text) el.textContent = text;
    });

    if (!currentRoute) {
        listEl.innerHTML = `<li class="no-schedule">${isZh ? '請選擇路線查看站點' : 'Select a route to view stops'}</li>`;
        return;
    }

    if (isLoadingStops) {
        listEl.innerHTML = `<li class="no-schedule"><div class="loading-spinner"></div>${isZh ? '載入站點資料...' : 'Loading stops...'}</li>`;
        return;
    }

    const stops = getRouteStops(currentRoute, routeDirection);
    const scheduleInfo = getRouteScheduleInfo(currentRoute);
    const fareInfo = getRouteFareInfo(currentRoute);
    const nextBus = getNextBusTime(scheduleInfo);
    const totalJourneyTime = calculateTotalJourneyTime(stops);

    // Route summary card (fare, total time, etc.)
    const routes = fetchedRoutes[currentRouteCity] || [];
    const routeData = routes.find(r => r.id === currentRoute);
    const routeTerminals = routeData ? (isZh ? routeData.terminals.zh : routeData.terminals.en) : '';

    // Calculate trip-specific info if origin and destination are selected
    let tripDuration = totalJourneyTime;
    let tripStops = stops.length;
    let tripFare = fareInfo.totalFare;
    let arrivalAtDest = null;

    if (selectedOriginStop !== null && selectedDestStop !== null) {
        const originIdx = parseInt(selectedOriginStop);
        const destIdx = parseInt(selectedDestStop);
        const originTime = stops[originIdx].time.split(':').map(Number);
        const destTime = stops[destIdx].time.split(':').map(Number);
        tripDuration = (destTime[0] * 60 + destTime[1]) - (originTime[0] * 60 + originTime[1]);
        tripStops = destIdx - originIdx + 1;
        // Calculate fare based on sections traveled (approximate)
        const totalStops = stops.length;
        const stopsPerSection = totalStops / fareInfo.sections;
        const sectionsTraveled = Math.max(1, Math.ceil(tripStops / stopsPerSection));
        tripFare = fareInfo.baseFare * sectionsTraveled;

        // Calculate arrival time at destination based on next bus
        if (nextBus.time && !nextBus.ended) {
            const [busH, busM] = nextBus.time.split(':').map(Number);
            const busDepartMinutes = busH * 60 + busM;
            const firstStopTime = stops[0].time.split(':').map(Number);
            const firstStopMinutes = firstStopTime[0] * 60 + firstStopTime[1];
            const destStopMinutes = destTime[0] * 60 + destTime[1];
            const elapsedToDest = destStopMinutes - firstStopMinutes;
            const arrivalMinutes = busDepartMinutes + elapsedToDest;
            const arrH = Math.floor(arrivalMinutes / 60) % 24;
            const arrM = arrivalMinutes % 60;
            arrivalAtDest = `${arrH.toString().padStart(2, '0')}:${arrM.toString().padStart(2, '0')}`;
        }
    }

    const hasTripSelection = selectedOriginStop !== null && selectedDestStop !== null;

    let summaryHtml = `<li class="route-summary-card">
        ${hasTripSelection ? `<div style="text-align:center;font-size:0.85em;color:#1565C0;margin-bottom:8px;font-weight:500;">📍 ${isZh ? '您的行程' : 'Your Trip'}${arrivalAtDest ? ` → ${isZh ? '預計' : 'Arrive'} <strong>${arrivalAtDest}</strong>` : ''}</div>` : ''}
        <div class="summary-row">
            <div class="summary-item">
                <span class="summary-label">${isZh ? '票價' : 'Fare'}</span>
                <span class="summary-value fare-value">NT$${tripFare}</span>
                ${!hasTripSelection && fareInfo.sections > 1 ? `<span class="summary-note">${fareInfo.sections} ${isZh ? '段票' : 'sections'}</span>` : ''}
            </div>
            <div class="summary-item">
                <span class="summary-label">${isZh ? (hasTripSelection ? '行程' : '全程') : (hasTripSelection ? 'Trip' : 'Total')}</span>
                <span class="summary-value">${tripDuration} ${isZh ? '分鐘' : 'min'}</span>
                <span class="summary-note">${tripStops} ${isZh ? '站' : 'stops'}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">${hasTripSelection && arrivalAtDest ? (isZh ? '抵達' : 'Arrive') : (isZh ? '班距' : 'Interval')}</span>
                <span class="summary-value">${hasTripSelection && arrivalAtDest ? arrivalAtDest : `${scheduleInfo.peakInterval}-${scheduleInfo.offPeakInterval}`}</span>
                <span class="summary-note">${hasTripSelection && arrivalAtDest ? (isZh ? '預計時間' : 'ETA') : (isZh ? '分鐘' : 'min')}</span>
            </div>
        </div>
        ${fareInfo.transferDiscount ? `<div class="transfer-note">🎫 ${isZh ? '可享捷運/公車轉乘優惠' : 'MRT/Bus transfer discount available'}</div>` : ''}
    </li>`;

    // Next bus info header
    let headerHtml = '';
    if (nextBus.ended) {
        headerHtml = `<li class="route-stop-item service-ended">
            <div class="stop-sequence" style="background:#E65100;">!</div>
            <div class="route-stop-info">
                <div class="route-stop-name" style="color:#E65100;">${isZh ? '今日營運已結束' : 'Service ended for today'}</div>
                <div class="route-stop-time">${isZh ? '首班車' : 'First bus'}: ${scheduleInfo.firstBus} | ${isZh ? '末班車' : 'Last bus'}: ${scheduleInfo.lastBus}</div>
            </div>
        </li>`;
    } else if (nextBus.waitMinutes !== null) {
        const waitText = nextBus.waitMinutes <= 1
            ? (isZh ? '即將發車' : 'Departing')
            : `${nextBus.waitMinutes} ${isZh ? '分鐘' : 'min'}`;
        const isArriving = nextBus.waitMinutes <= 5;
        headerHtml = `<li class="route-stop-item next-bus-item ${isArriving ? 'arriving-soon' : ''}">
            <div class="stop-sequence" style="background:${isArriving ? '#E65100' : '#2E7D32'};">🚌</div>
            <div class="route-stop-info">
                <div class="next-bus-header">
                    <span class="next-bus-label">${isZh ? '下一班車' : 'Next Bus'}</span>
                    ${isArriving ? `<span class="next-badge">${isZh ? '即將到站' : 'NEXT'}</span>` : ''}
                </div>
                <div class="next-bus-time">${nextBus.time}</div>
                <div class="route-stop-time">${isZh ? '營運時間' : 'Service'}: ${scheduleInfo.firstBus} - ${scheduleInfo.lastBus}</div>
            </div>
            <div class="bus-eta ${isArriving ? 'arriving' : 'scheduled'}">${waitText}</div>
        </li>`;
    }

    const originIdx = selectedOriginStop !== null ? parseInt(selectedOriginStop) : -1;
    const destIdx = selectedDestStop !== null ? parseInt(selectedDestStop) : -1;

    // Calculate next bus departure time in minutes for arrival time calculation
    let nextBusDepartureMinutes = null;
    if (nextBus.time && !nextBus.ended) {
        const [h, m] = nextBus.time.split(':').map(Number);
        nextBusDepartureMinutes = h * 60 + m;
    }

    // Get first stop base time for elapsed calculation
    const firstStopTime = stops[0].time.split(':').map(Number);
    const firstStopMinutes = firstStopTime[0] * 60 + firstStopTime[1];

    const stopsHtml = stops.map((stop, index) => {
        const isFirst = index === 0;
        const isLast = index === stops.length - 1;
        const stopName = isZh ? stop.name.zh : stop.name.en;

        // Check if this stop is selected origin/destination
        const isOrigin = index === originIdx;
        const isDestination = index === destIdx;
        const isInTrip = originIdx >= 0 && destIdx >= 0 && index >= originIdx && index <= destIdx;

        // Calculate elapsed time from first stop
        const stopTime = stop.time.split(':').map(Number);
        const stopMinutes = stopTime[0] * 60 + stopTime[1];
        const elapsedFromFirst = stopMinutes - firstStopMinutes;

        // Calculate elapsed time from origin (for display)
        const baseIdx = originIdx >= 0 ? originIdx : 0;
        const baseTime = stops[baseIdx].time.split(':').map(Number);
        const baseMinutes = baseTime[0] * 60 + baseTime[1];
        const elapsedFromOrigin = stopMinutes - baseMinutes;

        // Calculate estimated arrival time at this stop based on next bus
        let arrivalTimeStr = '';
        if (nextBusDepartureMinutes !== null) {
            const arrivalMinutes = nextBusDepartureMinutes + elapsedFromFirst;
            const arrH = Math.floor(arrivalMinutes / 60) % 24;
            const arrM = arrivalMinutes % 60;
            arrivalTimeStr = `${arrH.toString().padStart(2, '0')}:${arrM.toString().padStart(2, '0')}`;
        }

        // Build class list
        let classList = ['route-stop-item'];
        if (isFirst) classList.push('first-stop');
        if (isLast) classList.push('last-stop');
        if (isOrigin) classList.push('selected-origin');
        if (isDestination) classList.push('selected-dest');
        if (isInTrip && !isOrigin && !isDestination) classList.push('in-trip');

        return `
            <li class="${classList.join(' ')}">
                <div class="stop-sequence ${isFirst || isLast ? 'terminal' : ''} ${isOrigin ? 'origin-marker' : ''} ${isDestination ? 'dest-marker' : ''}">${index + 1}</div>
                <div class="route-stop-info">
                    <div class="route-stop-name">${stopName}${isOrigin ? ` <span style="color:#2E7D32;font-size:0.8em;">(${isZh ? '上車' : 'Board'})</span>` : ''}${isDestination ? ` <span style="color:#c62828;font-size:0.8em;">(${isZh ? '下車' : 'Alight'})</span>` : ''}</div>
                    <div class="route-stop-details">
                        ${arrivalTimeStr ? `<span class="arrival-time-est">${isZh ? '預計' : 'ETA'} ${arrivalTimeStr}</span>` : ''}
                        ${index > baseIdx ? `<span class="elapsed-time">+${elapsedFromOrigin} ${isZh ? '分' : 'min'}</span>` : ''}
                        ${isFirst && !isOrigin ? `<span class="terminal-label">${isZh ? '起站' : 'Start'}</span>` : ''}
                        ${isLast && !isDestination ? `<span class="terminal-label">${isZh ? '終點' : 'End'}</span>` : ''}
                    </div>
                </div>
            </li>
        `;
    }).join('');

    listEl.innerHTML = summaryHtml + headerHtml + stopsHtml;
}

// Check if proxy is configured
function useProxy() {
    return TDX_PROXY_URL && TDX_PROXY_URL.length > 0;
}

// Check if direct API is configured
function useDirectApi() {
    return TDX_CONFIG.clientId && TDX_CONFIG.clientSecret;
}

// TDX API Authentication (only needed for direct API, not proxy)
async function getAccessToken() {
    // If using proxy, no token needed (proxy handles auth)
    if (useProxy()) {
        console.log('[Bus] Using proxy - no token needed');
        return 'PROXY';
    }

    if (!useDirectApi()) {
        console.warn('[Bus] TDX not configured - please configure TDX_PROXY_URL or TDX credentials');
        return null;
    }

    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    try {
        const response = await fetch(TDX_CONFIG.authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=client_credentials&client_id=${TDX_CONFIG.clientId}&client_secret=${TDX_CONFIG.clientSecret}`
        });

        if (!response.ok) throw new Error('Auth failed');

        const data = await response.json();
        accessToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        console.log('[Bus] TDX token obtained');
        return accessToken;
    } catch (error) {
        console.error('[Bus] TDX auth error:', error);
        return null;
    }
}

// Fetch bus stops near location
async function fetchNearbyStops(lat, lng, radius = 500) {
    const token = await getAccessToken();

    if (!token) {
        console.warn('[Bus] No TDX token available for nearby stops');
        return [];
    }

    try {
        const apiPath = `/v2/Bus/Stop/City/${currentCity}?$spatialFilter=nearby(${lat},${lng},${radius})&$top=30&$format=JSON`;

        let response;
        if (useProxy()) {
            // Use proxy - no auth header needed
            response = await fetchWithRetry(TDX_PROXY_URL + apiPath);
        } else {
            // Direct API call
            response = await fetchWithRetry(TDX_CONFIG.apiUrl + apiPath, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log(`[Bus] Fetched ${data.length} nearby stops from TDX`);
        return data.map(stop => ({
            id: stop.StopUID,
            name: { en: stop.StopName.En || stop.StopName.Zh_tw, zh: stop.StopName.Zh_tw },
            lat: stop.StopPosition.PositionLat,
            lng: stop.StopPosition.PositionLon,
            address: stop.StopAddress || '',
            city: currentCity
        }));
    } catch (error) {
        console.error('[Bus] Error fetching nearby stops from TDX:', error);
        return [];
    }
}

// Fetch arrival times for stops
async function fetchArrivals(stopIds) {
    const token = await getAccessToken();

    if (!token || stopIds.length === 0) {
        return {};
    }

    try {
        const filter = stopIds.map(id => `StopUID eq '${id}'`).join(' or ');
        const apiPath = `/v2/Bus/EstimatedTimeOfArrival/City/${currentCity}?$filter=${encodeURIComponent(filter)}&$top=200&$format=JSON`;

        let response;
        if (useProxy()) {
            // Use proxy - no auth header needed
            response = await fetchWithRetry(TDX_PROXY_URL + apiPath);
        } else {
            // Direct API call
            response = await fetchWithRetry(TDX_CONFIG.apiUrl + apiPath, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const arrivals = {};

        data.forEach(item => {
            const stopId = item.StopUID;
            if (!arrivals[stopId]) arrivals[stopId] = [];

            arrivals[stopId].push({
                route: item.RouteName.Zh_tw,
                routeEn: item.RouteName.En || item.RouteName.Zh_tw,
                estimateTime: item.EstimateTime, // seconds
                stopStatus: item.StopStatus,
                direction: item.Direction
            });
        });

        console.log(`[Bus] Fetched arrivals for ${Object.keys(arrivals).length} stops from TDX`);
        return arrivals;
    } catch (error) {
        console.error('[Bus] Error fetching arrivals from TDX:', error);
        return {};
    }
}

// Fetch bus routes for a city from TDX
async function fetchRoutes(city) {
    // Return memory-cached routes if available
    if (fetchedRoutes[city] && fetchedRoutes[city].length > 0) {
        return fetchedRoutes[city];
    }

    // Check localStorage cache first
    const cachedRoutes = loadRoutesFromCache(city);
    if (cachedRoutes) {
        fetchedRoutes[city] = cachedRoutes;
        return cachedRoutes;
    }

    const token = await getAccessToken();
    if (!token) {
        console.warn('[Bus] No TDX token available');
        return [];
    }

    try {
        const apiPath = `/v2/Bus/Route/City/${city}?$top=500&$format=JSON`;

        let response;
        if (useProxy()) {
            response = await fetchWithRetry(TDX_PROXY_URL + apiPath);
        } else {
            response = await fetchWithRetry(TDX_CONFIG.apiUrl + apiPath, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const routes = data.map(route => ({
            id: route.RouteName.Zh_tw,
            name: {
                en: route.RouteName.En || route.RouteName.Zh_tw,
                zh: route.RouteName.Zh_tw
            },
            terminals: {
                en: `${route.DepartureStopNameEn || route.DepartureStopNameZh || ''} - ${route.DestinationStopNameEn || route.DestinationStopNameZh || ''}`,
                zh: `${route.DepartureStopNameZh || ''} - ${route.DestinationStopNameZh || ''}`
            },
            subRouteId: route.SubRoutes?.[0]?.SubRouteUID || route.RouteUID,
            routeUID: route.RouteUID
        }));

        // Sort routes: numbers first, then by name
        routes.sort((a, b) => {
            const aNum = parseInt(a.id);
            const bNum = parseInt(b.id);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            if (!isNaN(aNum)) return -1;
            if (!isNaN(bNum)) return 1;
            return a.id.localeCompare(b.id, 'zh-TW');
        });

        // Save to both memory and localStorage cache
        fetchedRoutes[city] = routes;
        saveRoutesToCache(city, routes);

        console.log(`[Bus] Fetched ${routes.length} routes for ${city} from TDX`);
        return routes;
    } catch (error) {
        console.error('[Bus] Error fetching routes from TDX:', error);
        return [];
    }
}

// Fetch stops for a specific route from TDX
async function fetchRouteStopsFromTDX(city, routeName, direction) {
    const cacheKey = `${city}_${routeName}_${direction}`;
    if (fetchedRouteStops[cacheKey]) {
        return fetchedRouteStops[cacheKey];
    }

    const token = await getAccessToken();
    if (!token) {
        return null;
    }

    try {
        const encodedRouteName = encodeURIComponent(routeName);
        // Use DisplayStopOfRoute which includes more reliable position data
        const apiPath = `/v2/Bus/DisplayStopOfRoute/City/${city}/${encodedRouteName}?$format=JSON`;

        let response;
        if (useProxy()) {
            response = await fetchWithRetry(TDX_PROXY_URL + apiPath);
        } else {
            response = await fetchWithRetry(TDX_CONFIG.apiUrl + apiPath, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        if (!response.ok) {
            // Fallback to regular StopOfRoute API
            console.log('[Bus] DisplayStopOfRoute failed, trying StopOfRoute');
            const fallbackPath = `/v2/Bus/StopOfRoute/City/${city}/${encodedRouteName}?$format=JSON`;
            if (useProxy()) {
                response = await fetchWithRetry(TDX_PROXY_URL + fallbackPath);
            } else {
                response = await fetchWithRetry(TDX_CONFIG.apiUrl + fallbackPath, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Find the correct direction (0 = outbound/go, 1 = return/back)
        const dirCode = direction === 'go' ? 0 : 1;
        const routeData = data.find(r => r.Direction === dirCode) || data[0];

        if (!routeData || !routeData.Stops) {
            return null;
        }

        const stops = routeData.Stops.map((stop, idx) => ({
            name: {
                en: stop.StopName?.En || stop.StopName?.Zh_tw || `Stop ${idx + 1}`,
                zh: stop.StopName?.Zh_tw || `站點 ${idx + 1}`
            },
            stopUID: stop.StopUID,
            sequence: stop.StopSequence || idx + 1,
            // Include position data for map markers
            lat: stop.StopPosition?.PositionLat || null,
            lng: stop.StopPosition?.PositionLon || null,
            // Estimate time based on sequence (3 min per stop as rough estimate)
            time: calculateEstimatedTime(idx)
        }));

        // Log how many stops have coordinates
        const stopsWithCoords = stops.filter(s => s.lat && s.lng).length;
        console.log(`[Bus] Fetched ${stops.length} stops for ${routeName} (${direction}), ${stopsWithCoords} with coordinates`);

        fetchedRouteStops[cacheKey] = stops;
        return stops;
    } catch (error) {
        console.error('[Bus] Error fetching route stops:', error);
        return null;
    }
}

// Calculate estimated time for a stop based on its sequence
function calculateEstimatedTime(index) {
    const baseHour = 6;
    const minutesPerStop = 3;
    const totalMinutes = baseHour * 60 + index * minutesPerStop;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function getStopName(stop) {
    return isZh ? stop.name.zh : stop.name.en;
}

function formatArrivalTime(seconds, status) {
    if (status === 1) return isZh ? '進站中' : 'Arriving';
    if (status === 2) return isZh ? '未發車' : 'Not started';
    if (status === 3) return isZh ? '末班駛離' : 'Last bus left';
    if (status === 4) return isZh ? '今日停駛' : 'No service';
    if (seconds === undefined || seconds === null) return isZh ? '未知' : 'Unknown';
    if (seconds <= 60) return isZh ? '即將到站' : 'Arriving';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} ${isZh ? '分' : 'min'}`;
    return isZh ? '超過1小時' : '>1 hour';
}

function getArrivalClass(seconds, status) {
    if (status === 1 || (seconds !== undefined && seconds <= 120)) return 'arriving';
    if (status >= 2) return 'waiting';
    return '';
}

function renderStopList() {
    const listEl = document.getElementById('stop-list');

    let filteredStops = busStops;
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filteredStops = busStops.filter(stop =>
            stop.name.en.toLowerCase().includes(q) ||
            stop.name.zh.includes(q) ||
            (arrivalData[stop.id] || []).some(a =>
                a.route.includes(q) || a.routeEn.toLowerCase().includes(q)
            )
        );
    }

    // Sort by distance
    if (userLocation) {
        filteredStops = filteredStops.map(stop => ({
            ...stop,
            distance: getDistanceInMeters(userLocation.lat, userLocation.lng, stop.lat, stop.lng)
        })).sort((a, b) => a.distance - b.distance);
    }

    if (filteredStops.length === 0) {
        const msg = busStops.length === 0
            ? (isZh ? '無法載入附近站牌' : 'Could not load nearby stops')
            : (isZh ? '找不到站牌' : 'No stops found');
        listEl.innerHTML = `<li class="loading">${msg}</li>`;
        document.getElementById('info-bar').innerHTML = msg;
        return;
    }

    // Update info bar
    const infoText = isZh
        ? `顯示 ${filteredStops.length} 個站牌 (TDX 即時資料)`
        : `Showing ${filteredStops.length} stops (TDX real-time)`;
    document.getElementById('info-bar').innerHTML = infoText;

    listEl.innerHTML = filteredStops.map(stop => {
        const arrivals = arrivalData[stop.id] || [];
        const distanceStr = stop.distance ? formatDistance(stop.distance) : '';

        let arrivalsHtml = '';
        if (arrivals.length > 0) {
            arrivalsHtml = `<div class="arrivals">
                ${arrivals.slice(0, 6).map(a => {
                    const timeStr = formatArrivalTime(a.estimateTime, a.stopStatus);
                    const arrClass = getArrivalClass(a.estimateTime, a.stopStatus);
                    return `<span class="arrival-badge ${arrClass}">
                        <span class="route-name">${isZh ? a.route : a.routeEn}</span>
                        <span class="arrival-time">${timeStr}</span>
                    </span>`;
                }).join('')}
            </div>`;
        } else {
            arrivalsHtml = `<div class="no-arrivals">${isZh ? '暫無到站資訊' : 'No arrival info'}</div>`;
        }

        return `
            <li class="stop-item${selectedStop === stop.id ? ' selected' : ''}" data-id="${stop.id}">
                <div class="stop-header">
                    <span class="stop-name">${getStopName(stop)}</span>
                    ${distanceStr ? `<span class="stop-distance">${distanceStr}</span>` : ''}
                </div>
                ${stop.address ? `<div class="stop-address">${stop.address}</div>` : ''}
                ${arrivalsHtml}
            </li>
        `;
    }).join('');

    listEl.querySelectorAll('.stop-item').forEach(item => {
        item.addEventListener('click', () => selectStop(item.dataset.id));
    });
}

function selectStop(id) {
    selectedStop = id;
    const stop = busStops.find(s => s.id === id);
    if (stop && markers[id]) {
        map.setView([stop.lat, stop.lng], 17);
        markers[id].openPopup();
    }
    renderStopList();
    document.querySelector(`.stop-item[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function getPopupContent(stop) {
    const arrivals = arrivalData[stop.id] || [];
    let arrivalsHtml = arrivals.length > 0
        ? arrivals.slice(0, 4).map(a => {
            const timeStr = formatArrivalTime(a.estimateTime, a.stopStatus);
            return `<div><strong>${isZh ? a.route : a.routeEn}</strong>: ${timeStr}</div>`;
        }).join('')
        : `<div style="color:#999;">${isZh ? '暫無到站資訊' : 'No arrival info'}</div>`;

    // Navigation links
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;

    return `<div style="min-width:180px;">
        <strong>${getStopName(stop)}</strong><br>
        ${stop.address ? `<small style="color:#666;">${stop.address}</small><br>` : ''}
        <hr style="margin:6px 0;border:none;border-top:1px solid #ddd;">
        ${arrivalsHtml}
        <div style="margin-top:8px;">
            <a href="${googleMapsUrl}" target="_blank" style="display:inline-block;padding:4px 8px;background:#1976D2;color:white;text-decoration:none;border-radius:4px;font-size:11px;">${isZh ? '導航' : 'Navigate'}</a>
        </div>
    </div>`;
}

function updatePopups() {
    busStops.forEach(stop => {
        if (markers[stop.id]) {
            markers[stop.id].setPopupContent(getPopupContent(stop));
        }
    });
}

function createMarkerIcon(isUser = false) {
    return L.divIcon({
        className: '',
        html: `<div class="marker-icon ${isUser ? 'user-marker' : ''}" style="width:28px;height:28px;">${isUser ? '📍' : '🚏'}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    });
}

function clearMarkers() {
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};
}

function updateMarkers() {
    clearMarkers();

    busStops.forEach(stop => {
        const marker = L.marker([stop.lat, stop.lng], {
            icon: createMarkerIcon()
        });
        marker.bindPopup(getPopupContent(stop));
        marker.on('click', () => {
            selectedStop = stop.id;
            renderStopList();
        });
        marker.addTo(map);
        markers[stop.id] = marker;
    });
}

// Route line for showing bus route on map
let routeLine = null;

function updateRouteMapMarkers() {
    clearMarkers();
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    if (!currentRoute) return;

    const stops = getRouteStops(currentRoute, routeDirection);
    if (!stops || stops.length === 0) return;

    // Get selected indices
    const originIdx = selectedOriginStop !== null ? parseInt(selectedOriginStop) : -1;
    const destIdx = selectedDestStop !== null ? parseInt(selectedDestStop) : -1;

    // Filter stops with valid coordinates, but keep track of original index
    const stopsWithCoords = stops.map((s, idx) => ({ ...s, originalIndex: idx }))
        .filter(s => s.lat && s.lng);

    if (stopsWithCoords.length === 0) {
        console.warn('[Bus] No stops with coordinates for route', currentRoute);
        // Center map on city if no stop coordinates
        const cityData = BUS_CITIES[currentRouteCity];
        if (cityData) {
            map.setView(cityData.center, 14);
        }
        return;
    }

    // Create markers for each stop
    stopsWithCoords.forEach((stop) => {
        const idx = stop.originalIndex;
        const isFirst = idx === 0;
        const isLast = idx === stops.length - 1;
        const isOrigin = idx === originIdx;
        const isDestination = idx === destIdx;
        const isInTrip = originIdx >= 0 && destIdx >= 0 && idx >= originIdx && idx <= destIdx;
        const stopName = isZh ? stop.name.zh : stop.name.en;

        // Determine marker color based on selection state
        let markerColor = '#1565C0'; // Default blue
        if (isOrigin) {
            markerColor = '#2E7D32'; // Green for origin
        } else if (isDestination) {
            markerColor = '#c62828'; // Red for destination
        } else if (isInTrip) {
            markerColor = '#FFC107'; // Yellow for in-trip
        } else if (isFirst) {
            markerColor = '#2E7D32'; // Green for first stop
        } else if (isLast) {
            markerColor = '#c62828'; // Red for last stop
        }

        const marker = L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
                className: '',
                html: `<div class="marker-icon" style="width:24px;height:24px;font-size:10px;background:${markerColor};">${idx + 1}</div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            })
        });

        let labelText = '';
        if (isOrigin) labelText = `<br><span style="color:#2E7D32;">${isZh ? '上車站' : 'Board here'}</span>`;
        else if (isDestination) labelText = `<br><span style="color:#c62828;">${isZh ? '下車站' : 'Alight here'}</span>`;
        else if (isFirst) labelText = `<br><span style="color:#2E7D32;">${isZh ? '起站' : 'First Stop'}</span>`;
        else if (isLast) labelText = `<br><span style="color:#c62828;">${isZh ? '終點' : 'Last Stop'}</span>`;

        marker.bindPopup(`
            <div style="text-align:center;">
                <strong>${stopName}</strong><br>
                <small>${isZh ? '站序' : 'Stop'} ${idx + 1}</small>
                ${labelText}
            </div>
        `);
        marker.addTo(map);
        markers[stop.stopUID || `route_${idx}`] = marker;
    });

    // Draw route line
    const lineCoords = stopsWithCoords.map(s => [s.lat, s.lng]);
    if (lineCoords.length >= 2) {
        routeLine = L.polyline(lineCoords, {
            color: '#1565C0',
            weight: 4,
            opacity: 0.7
        }).addTo(map);
    }

    // Fit map to show all stops, or just origin/dest if selected
    if (originIdx >= 0 && destIdx >= 0) {
        // Zoom to show trip segment
        const tripStops = stopsWithCoords.filter(s => s.originalIndex >= originIdx && s.originalIndex <= destIdx);
        if (tripStops.length > 0) {
            const bounds = L.latLngBounds(tripStops.map(s => [s.lat, s.lng]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    } else if (stopsWithCoords.length > 0) {
        const bounds = L.latLngBounds(stopsWithCoords.map(s => [s.lat, s.lng]));
        map.fitBounds(bounds, { padding: [30, 30] });
    }

    console.log('[Bus] Updated map with', stopsWithCoords.length, 'stops for route', currentRoute);
}

async function loadNearbyStops() {
    const listEl = document.getElementById('stop-list');
    listEl.innerHTML = `<li class="loading">
        <div class="loading-spinner"></div>
        <div>${isZh ? '搜尋附近站牌...' : 'Finding nearby stops...'}</div>
    </li>`;

    const center = userLocation || BUS_CITIES[currentCity].center;
    busStops = await fetchNearbyStops(center[0] || center.lat, center[1] || center.lng, 500);

    // Add distance info
    if (userLocation) {
        busStops = busStops.map(stop => ({
            ...stop,
            distance: getDistanceInMeters(userLocation.lat, userLocation.lng, stop.lat, stop.lng)
        }));
    }

    updateMarkers();

    // Add user marker if we have location and it doesn't exist
    if (userLocation && !userMarker && map) {
        userMarker = L.marker([userLocation.lat, userLocation.lng], {
            icon: createMarkerIcon(true)
        }).addTo(map);
        userMarker.bindPopup(isZh ? '您的位置' : 'Your Location');
    }

    // Fetch arrival times
    if (busStops.length > 0) {
        const stopIds = busStops.map(s => s.id);
        arrivalData = await fetchArrivals(stopIds);
        updatePopups();
    }

    renderStopList();
}

async function changeCity() {
    currentCity = document.getElementById('city-select').value;
    localStorage.setItem('bus-city', currentCity);

    const cityData = BUS_CITIES[currentCity];
    if (cityData) {
        map.setView(cityData.center, 14);
    }

    await loadNearbyStops();
}

function handleSearch(e) {
    searchQuery = e.target.value.trim();
    renderStopList();
}

async function centerToUserLocation() {
    const btn = document.querySelector('.locate-btn');
    if (btn) btn.classList.add('locating');

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            });
        });

        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };

        if (map) {
            map.setView([userLocation.lat, userLocation.lng], 16);
        }

        // Reload nearby stops for new location
        await loadNearbyStops();

        console.log('[Bus] Centered to user location:', userLocation);
    } catch (error) {
        console.warn('[Bus] Could not get location:', error.code, error.message);
        let msg;
        if (error.code === 1) {
            msg = isZh ? '請允許位置權限' : 'Please allow location permission';
        } else if (error.code === 2) {
            msg = isZh ? '無法取得位置資訊' : 'Location unavailable';
        } else if (error.code === 3) {
            msg = isZh ? '定位逾時，請重試' : 'Location timeout, please retry';
        } else {
            msg = isZh ? '無法取得您的位置' : 'Could not get your location';
        }
        alert(msg);
    } finally {
        if (btn) btn.classList.remove('locating');
    }
}

async function init() {
    console.log('[Bus] Initializing...');

    // Restore preferences
    const savedLang = localStorage.getItem('ubike-lang');
    if (savedLang) isZh = savedLang === 'zh';

    const savedCity = localStorage.getItem('bus-city');
    if (savedCity && BUS_CITIES[savedCity]) {
        currentCity = savedCity;
        document.getElementById('city-select').value = currentCity;
    }

    // Setup tabs
    setupTabs();

    updateUI();

    // Initialize route schedule (async - will update when ready)
    updateRouteSelector().then(() => {
        console.log('[Bus] Routes loaded for', currentRouteCity);
    });
    renderRouteSchedule();

    // Initialize map
    const cityData = BUS_CITIES[currentCity];
    map = L.map('map-canvas').setView(cityData.center, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Get user location (but don't add marker yet - will be added when nearby tab is active)
    if ('geolocation' in navigator) {
        try {
            const loadingText = document.getElementById('loading-text');
            if (loadingText) {
                loadingText.textContent = isZh ? '取得您的位置...' : 'Getting your location...';
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });

            userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            console.log('[Bus] User location:', userLocation);
        } catch (error) {
            console.warn('[Bus] Could not get location:', error.message);
        }
    }

    // Check which tab is active - only load nearby stops if nearby tab is active
    const scheduleTabActive = document.querySelector('.tab-btn[data-tab="schedule"]')?.classList.contains('active');
    if (!scheduleTabActive) {
        // Load nearby stops only if nearby tab is active
        await loadNearbyStops();
    } else {
        // Clear the stop list loading indicator for schedule tab (it's not visible anyway)
        const stopList = document.getElementById('stop-list');
        if (stopList) stopList.innerHTML = '';
    }

    // Setup search
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // Auto-refresh arrivals every 30 seconds (only when nearby tab has stops)
    refreshTimer = setInterval(async () => {
        const nearbyTabActive = document.querySelector('.tab-btn[data-tab="nearby"]')?.classList.contains('active');
        if (nearbyTabActive && busStops.length > 0) {
            const stopIds = busStops.map(s => s.id);
            arrivalData = await fetchArrivals(stopIds);
            renderStopList();
            updatePopups();
            console.log('[Bus] Arrival data refreshed');
        }
    }, 30000);

    // Update schedule time every minute
    scheduleTimer = setInterval(() => {
        if (currentRoute) {
            renderRouteSchedule();
        }
    }, 60000);

    console.log('[Bus] Initialization complete');
}

// Make functions available globally
window.toggleLang = toggleLang;
window.changeCity = changeCity;
window.onRouteCityChange = onRouteCityChange;
window.onRouteChange = onRouteChange;
window.setRouteDirection = setRouteDirection;
window.onRouteSearch = onRouteSearch;
window.onStopSelectorChange = onStopSelectorChange;
window.centerToUserLocation = centerToUserLocation;

// Initialize on DOM ready (wait for Leaflet)
document.addEventListener('DOMContentLoaded', () => {
  if (typeof L !== 'undefined') {
    init();
  } else {
    const checkLeaflet = setInterval(() => {
      if (typeof L !== 'undefined') {
        clearInterval(checkLeaflet);
        init();
      }
    }, 100);
    setTimeout(() => clearInterval(checkLeaflet), 10000);
  }
});
