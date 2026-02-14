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
    PenghuCounty: { name: { en: 'Penghu', zh: '澎湖縣' }, center: [23.5711, 119.5793] },
    LianjiangCounty: { name: { en: 'Lianjiang', zh: '連江縣' }, center: [26.1505, 119.9499] }
};

// Adjacency map: cities that share bus routes across administrative boundaries
const ADJACENT_CITIES = {
    Taipei:         ['NewTaipei', 'Keelung'],
    NewTaipei:      ['Taipei', 'Keelung', 'Taoyuan', 'YilanCounty'],
    Keelung:        ['Taipei', 'NewTaipei'],
    Taoyuan:        ['NewTaipei', 'Hsinchu', 'HsinchuCounty'],
    Hsinchu:        ['HsinchuCounty', 'Taoyuan', 'MiaoliCounty'],
    HsinchuCounty:  ['Hsinchu', 'Taoyuan', 'MiaoliCounty'],
    MiaoliCounty:   ['Hsinchu', 'HsinchuCounty', 'Taichung'],
    Taichung:       ['MiaoliCounty', 'ChanghuaCounty', 'NantouCounty'],
    ChanghuaCounty: ['Taichung', 'NantouCounty', 'YunlinCounty'],
    NantouCounty:   ['Taichung', 'ChanghuaCounty'],
    YunlinCounty:   ['ChanghuaCounty', 'ChiayiCounty', 'Chiayi'],
    Chiayi:         ['ChiayiCounty', 'YunlinCounty'],
    ChiayiCounty:   ['Chiayi', 'YunlinCounty', 'Tainan'],
    Tainan:         ['ChiayiCounty', 'Kaohsiung'],
    Kaohsiung:      ['Tainan', 'PingtungCounty'],
    PingtungCounty: ['Kaohsiung'],
    YilanCounty:    ['NewTaipei'],
    HualienCounty:  [],
    TaitungCounty:  [],
    KinmenCounty:   [],
    PenghuCounty:   [],
    LianjiangCounty:[]
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

// Route schedule state
let currentRouteCity = 'Taipei';
let currentRoute = '';
let routeDirection = 'go';
let routeSearchQuery = '';
let selectedOriginStop = null;
let selectedDestStop = null;
let fetchedRoutes = {}; // Cache for fetched routes by city
let fetchedRouteStops = {}; // Cache for fetched route stops
let routeArrivalData = {}; // Real-time arrival data keyed by "direction_StopUID"
let routeArrivalTimer = null; // 30s auto-refresh timer for route arrivals
let routeBusData = { nearStop: {}, busPositions: [] }; // Real-time bus plate & GPS data
let busMarkers = []; // Live bus markers on map (separate from stop markers)
let mergedRoutesCache = {};       // Merged routes (primary + adjacent) per city
let activeRouteSourceCity = null;  // Actual TDX city for the selected route
let isLoadingRoutes = false;
let isLoadingStops = false;
let bottomSheet = null;

// ============================================================
// BOTTOM SHEET SUMMARY
// ============================================================

function updateSheetSummary() {
    const summaryEl = document.getElementById('sheet-summary');
    if (!summaryEl) return;

    const activeTab = document.querySelector('.tab-btn.active');
    const tabName = activeTab?.dataset.tab || 'schedule';

    if (tabName === 'schedule') {
        // Route schedule tab: "🚌 Route 307 • 25 stops"
        if (currentRoute) {
            const stopCount = document.querySelectorAll('.route-stop-item').length;
            const directionText = routeDirection === 'go'
                ? (isZh ? '去程' : 'Outbound')
                : (isZh ? '返程' : 'Return');
            summaryEl.textContent = `🚌 ${currentRoute} · ${directionText} · ${stopCount} ${isZh ? '站' : 'stops'}`;
        } else {
            summaryEl.textContent = isZh ? '🚌 選擇路線' : '🚌 Select route';
        }
    } else {
        // Nearby stops tab: "🚌 Nearby • 8 stops"
        const stopCount = busStops.length;
        summaryEl.textContent = `🚌 ${isZh ? '附近' : 'Nearby'} · ${stopCount} ${isZh ? '站' : 'stops'}`;
    }
}

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
                // Clear bus markers when leaving schedule tab
                clearBusMarkers();
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

            // Update sheet summary when tab changes
            updateSheetSummary();
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

    // Fetch merged routes (primary + adjacent cities)
    let routes = mergedRoutesCache[currentRouteCity];
    if (!routes) {
        isLoadingRoutes = true;
        select.innerHTML = `<option value="">${isZh ? '載入路線中...' : 'Loading routes...'}</option>`;
        routes = await fetchMergedRoutes(currentRouteCity);
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
            // Show city badge for adjacent city routes
            const cityBadge = route.isAdjacentCity
                ? ` [${isZh ? BUS_CITIES[route.sourceCity].name.zh : BUS_CITIES[route.sourceCity].name.en}]`
                : '';
            select.innerHTML += `<option value="${route.id}" data-source-city="${route.sourceCity}">${name} (${terminals})${cityBadge}</option>`;
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
    const oldCity = currentRouteCity;
    currentRouteCity = select.value;
    currentRoute = '';
    selectedOriginStop = null;
    selectedDestStop = null;
    activeRouteSourceCity = null;
    routeSearchQuery = ''; // Clear search
    routeArrivalData = {};
    routeBusData = { nearStop: {}, busPositions: [] };

    // Clear merged routes cache for old city
    delete mergedRoutesCache[oldCity];

    // Clear arrival timer
    if (routeArrivalTimer) {
        clearInterval(routeArrivalTimer);
        routeArrivalTimer = null;
    }

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

    // Read source city from selected option's data attribute
    const selectedOption = select.options[select.selectedIndex];
    activeRouteSourceCity = (selectedOption && selectedOption.dataset.sourceCity) || currentRouteCity;

    // Clear old arrival timer
    if (routeArrivalTimer) {
        clearInterval(routeArrivalTimer);
        routeArrivalTimer = null;
    }
    routeArrivalData = {};
    routeBusData = { nearStop: {}, busPositions: [] };

    if (currentRoute) {
        // Show loading state
        isLoadingStops = true;
        renderRouteSchedule(); // Show loading indicator

        // Fetch stops, real-time arrivals, and bus positions using the actual source city
        await Promise.all([
            fetchRouteStopsFromTDX(activeRouteSourceCity, currentRoute, 'go'),
            fetchRouteStopsFromTDX(activeRouteSourceCity, currentRoute, 'back'),
            fetchRouteArrivals(activeRouteSourceCity, currentRoute).then(data => {
                routeArrivalData = data;
            }),
            fetchRouteBusPositions(activeRouteSourceCity, currentRoute).then(data => {
                routeBusData = data;
            })
        ]);

        isLoadingStops = false;

        // Start 30s auto-refresh for route arrivals
        routeArrivalTimer = setInterval(refreshRouteArrivals, 30000);
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
        const city = activeRouteSourceCity || currentRouteCity;
        const cacheKey = `${city}_${currentRoute}_${dir}`;
        if (!fetchedRouteStops[cacheKey]) {
            isLoadingStops = true;
            renderRouteSchedule();
            await fetchRouteStopsFromTDX(city, currentRoute, dir);
            isLoadingStops = false;
        }
    }

    updateStopSelectors();
    renderRouteSchedule();
    updateRouteMapMarkers();

    // Refresh arrivals after direction change
    if (currentRoute) {
        refreshRouteArrivals();
    }
}

function getRouteStops(routeId, direction) {
    // Get fetched TDX data from cache using actual source city
    const city = activeRouteSourceCity || currentRouteCity;
    const cacheKey = `${city}_${routeId}_${direction}`;
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
    const firstMinutes = timeToMinutes(stops[0]?.time);
    const lastMinutes = timeToMinutes(stops[stops.length - 1]?.time);
    return Math.max(0, lastMinutes - firstMinutes);
}

function getNextBusTime(scheduleInfo) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse first and last bus times
    if (!scheduleInfo?.firstBus || !scheduleInfo?.lastBus) {
        return { time: null, waitMinutes: null, ended: true };
    }
    const firstBusMinutes = timeToMinutes(scheduleInfo.firstBus);
    const lastBusMinutes = timeToMinutes(scheduleInfo.lastBus);

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

// Render stop items HTML for a given direction — reusable for single and dual-column layouts
function renderStopItems(stops, direction, arrivalMap, opts = {}) {
    const { originIdx = -1, destIdx = -1, nextBusDepartureMinutes = null, firstStopMinutes = 0 } = opts;

    return stops.map((stop, index) => {
        const isFirst = index === 0;
        const isLast = index === stops.length - 1;
        const stopName = isZh ? stop.name.zh : stop.name.en;

        const isOrigin = index === originIdx;
        const isDestination = index === destIdx;
        const isInTrip = originIdx >= 0 && destIdx >= 0 && index >= originIdx && index <= destIdx;

        // Calculate elapsed time from first stop
        const stopMinutes = timeToMinutes(stop.time);
        const elapsedFromFirst = stopMinutes - firstStopMinutes;

        // Calculate elapsed time from origin (for display)
        const baseIdx = originIdx >= 0 ? originIdx : 0;
        const baseMinutes = timeToMinutes(stops[baseIdx]?.time);
        const elapsedFromOrigin = stopMinutes - baseMinutes;

        // Calculate distance-based ETA
        let arrivalTimeStr = '';
        if (nextBusDepartureMinutes !== null) {
            const arrivalMinutes = nextBusDepartureMinutes + elapsedFromFirst;
            const arrH = Math.floor(arrivalMinutes / 60) % 24;
            const arrM = arrivalMinutes % 60;
            arrivalTimeStr = `${arrH.toString().padStart(2, '0')}:${arrM.toString().padStart(2, '0')}`;
        }

        // Look up real-time arrival data
        const arrivalKey = `${direction}_${stop.stopUID}`;
        const realTime = arrivalMap[arrivalKey];
        const nearStopInfo = routeBusData.nearStop[arrivalKey];
        let realTimeBadge = '';
        if (realTime) {
            const rtText = formatArrivalTime(realTime.estimateTime, realTime.stopStatus);
            const rtClass = getArrivalClass(realTime.estimateTime, realTime.stopStatus);
            const plateTag = nearStopInfo && nearStopInfo.plate ? `<span class="plate-tag">${nearStopInfo.plate}</span>` : '';
            realTimeBadge = `<span class="arrival-badge ${rtClass}" style="margin-left:4px;">${rtText}${plateTag}</span>`;
        } else if (nearStopInfo && nearStopInfo.plate) {
            const eventText = nearStopInfo.a2event === 1 ? (isZh ? '進站中' : 'Arriving') : (isZh ? '離站中' : 'Departing');
            realTimeBadge = `<span class="arrival-badge arriving" style="margin-left:4px;">${eventText}<span class="plate-tag">${nearStopInfo.plate}</span></span>`;
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
                        ${realTimeBadge || (arrivalTimeStr ? `<span class="arrival-time-est" style="${realTimeBadge ? '' : 'opacity:0.6;'}">${isZh ? '預計' : 'ETA'} ${arrivalTimeStr}</span>` : '')}
                        ${index > baseIdx ? `<span class="elapsed-time">+${elapsedFromOrigin} ${isZh ? '分' : 'min'}</span>` : ''}
                        ${isFirst && !isOrigin ? `<span class="terminal-label">${isZh ? '起站' : 'Start'}</span>` : ''}
                        ${isLast && !isDestination ? `<span class="terminal-label">${isZh ? '終點' : 'End'}</span>` : ''}
                    </div>
                </div>
            </li>
        `;
    }).join('');
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
    const routes = mergedRoutesCache[currentRouteCity] || fetchedRoutes[activeRouteSourceCity || currentRouteCity] || [];
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

        if (stops[originIdx] && stops[destIdx]) {
            const originMinutes = timeToMinutes(stops[originIdx].time);
            const destMinutes = timeToMinutes(stops[destIdx].time);
            tripDuration = Math.max(0, destMinutes - originMinutes);
            tripStops = destIdx - originIdx + 1;
            // Calculate fare based on sections traveled (approximate)
            const totalStops = stops.length;
            const stopsPerSection = totalStops / fareInfo.sections;
            const sectionsTraveled = Math.max(1, Math.ceil(tripStops / stopsPerSection));
            tripFare = fareInfo.baseFare * sectionsTraveled;

            // Calculate arrival time at destination based on next bus
            if (nextBus.time && !nextBus.ended) {
                const busDepartMinutes = timeToMinutes(nextBus.time);
                const firstStopMinutes = timeToMinutes(stops[0]?.time);
                const elapsedToDest = destMinutes - firstStopMinutes;
                const arrivalMinutes = busDepartMinutes + elapsedToDest;
                const arrH = Math.floor(arrivalMinutes / 60) % 24;
                const arrM = arrivalMinutes % 60;
                arrivalAtDest = `${arrH.toString().padStart(2, '0')}:${arrM.toString().padStart(2, '0')}`;
            }
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

    // Cross-city route search info bar
    let crossCityHtml = '';
    if (currentRoute) {
        const otherCities = findRouteInOtherCities(currentRoute);
        if (otherCities.length > 0) {
            const cityLinks = otherCities.map(c =>
                `<a href="#" onclick="event.preventDefault();switchToRouteCity('${c.city}')" style="color:#795548;font-weight:bold;text-decoration:underline;">${c.cityName}</a>`
            ).join(', ');
            crossCityHtml = `<li style="padding:8px 15px;background:#FFF8E1;border-bottom:1px solid #FFE082;font-size:0.85em;color:#795548;">
                📌 ${currentRoute} ${isZh ? '也在' : 'also in'}: ${cityLinks}
            </li>`;
        }
    }

    // Check if we have real-time arrival data for the first stop
    const hasRealTimeData = Object.keys(routeArrivalData).length > 0;
    const firstStopKey = stops.length > 0 ? `${routeDirection}_${stops[0].stopUID}` : null;
    const firstStopArrival = firstStopKey ? routeArrivalData[firstStopKey] : null;

    // Next bus info header — use real-time data when available
    let headerHtml = '';
    if (hasRealTimeData && firstStopArrival) {
        const timeStr = formatArrivalTime(firstStopArrival.estimateTime, firstStopArrival.stopStatus);
        const arrClass = getArrivalClass(firstStopArrival.estimateTime, firstStopArrival.stopStatus);
        const isArriving = arrClass === 'arriving';
        const isEnded = firstStopArrival.stopStatus === 3 || firstStopArrival.stopStatus === 4;

        if (isEnded) {
            headerHtml = `<li class="route-stop-item service-ended">
                <div class="stop-sequence" style="background:#E65100;">!</div>
                <div class="route-stop-info">
                    <div class="route-stop-name" style="color:#E65100;">${timeStr}</div>
                    <div class="route-stop-time">${isZh ? '首班車' : 'First bus'}: ${scheduleInfo.firstBus} | ${isZh ? '末班車' : 'Last bus'}: ${scheduleInfo.lastBus}</div>
                </div>
            </li>`;
        } else {
            headerHtml = `<li class="route-stop-item next-bus-item ${isArriving ? 'arriving-soon' : ''}">
                <div class="stop-sequence" style="background:${isArriving ? '#E65100' : '#2E7D32'};">🚌</div>
                <div class="route-stop-info">
                    <div class="next-bus-header">
                        <span class="next-bus-label">${isZh ? '起站即時' : 'First Stop Live'}</span>
                        ${isArriving ? `<span class="next-badge">${isZh ? '即將到站' : 'NEXT'}</span>` : ''}
                    </div>
                    <div class="next-bus-time">${timeStr}</div>
                    <div class="route-stop-time">${isZh ? '即時資料' : 'Real-time data'} · ${isZh ? '每30秒更新' : 'Updates every 30s'}</div>
                </div>
                <div class="bus-eta ${arrClass}">${timeStr}</div>
            </li>`;
        }
    } else if (nextBus.ended) {
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
        nextBusDepartureMinutes = timeToMinutes(nextBus.time);
    }

    // Get first stop base time for elapsed calculation
    const firstStopMinutes = timeToMinutes(stops[0]?.time);

    // PC dual-direction layout (>=1024px and not mobile bottom sheet)
    const isDualMode = window.innerWidth >= 1024;
    const tabSchedule = document.getElementById('tab-schedule');

    if (isDualMode && currentRoute) {
        // Add/remove dual mode class for CSS
        tabSchedule?.classList.add('pc-dual-mode');

        const goStops = getRouteStops(currentRoute, 'go');
        const backStops = getRouteStops(currentRoute, 'back');
        const goFirstMinutes = timeToMinutes(goStops[0]?.time);
        const backFirstMinutes = timeToMinutes(backStops[0]?.time);

        const goStopsHtml = renderStopItems(goStops, 'go', routeArrivalData, {
            originIdx: routeDirection === 'go' ? originIdx : -1,
            destIdx: routeDirection === 'go' ? destIdx : -1,
            nextBusDepartureMinutes,
            firstStopMinutes: goFirstMinutes
        });
        const backStopsHtml = renderStopItems(backStops, 'back', routeArrivalData, {
            originIdx: routeDirection === 'back' ? originIdx : -1,
            destIdx: routeDirection === 'back' ? destIdx : -1,
            nextBusDepartureMinutes: null,
            firstStopMinutes: backFirstMinutes
        });

        const dualHtml = `<li class="dual-direction-container">
            <div class="dual-direction-column">
                <div class="dual-column-header">→ ${isZh ? '去程' : 'Outbound'} (${goStops.length} ${isZh ? '站' : 'stops'})</div>
                <ul class="route-stop-list">${goStopsHtml}</ul>
            </div>
            <div class="dual-direction-column">
                <div class="dual-column-header">← ${isZh ? '返程' : 'Return'} (${backStops.length} ${isZh ? '站' : 'stops'})</div>
                <ul class="route-stop-list">${backStopsHtml}</ul>
            </div>
        </li>`;

        listEl.innerHTML = summaryHtml + crossCityHtml + headerHtml + dualHtml;
    } else {
        tabSchedule?.classList.remove('pc-dual-mode');

        const stopsHtml = renderStopItems(stops, routeDirection, routeArrivalData, {
            originIdx, destIdx, nextBusDepartureMinutes, firstStopMinutes
        });

        listEl.innerHTML = summaryHtml + crossCityHtml + headerHtml + stopsHtml;
    }

    // Update sheet summary
    updateSheetSummary();
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

// Get adjacent cities for a given city
function getAdjacentCities(city) {
    return ADJACENT_CITIES[city] || [];
}

// Fetch and merge routes from primary city + adjacent cities
async function fetchMergedRoutes(city) {
    if (mergedRoutesCache[city]) {
        return mergedRoutesCache[city];
    }

    const adjacentCities = getAdjacentCities(city);

    // Fetch primary + all adjacent cities in parallel
    const allCities = [city, ...adjacentCities];
    const results = await Promise.all(
        allCities.map(c => fetchRoutes(c).catch(() => []))
    );

    // Build merged list: primary city first, then adjacent
    const seenIds = new Set();
    const merged = [];

    // Primary city routes (no badge needed)
    const primaryRoutes = results[0] || [];
    primaryRoutes.forEach(route => {
        seenIds.add(route.id);
        merged.push({ ...route, sourceCity: city, isAdjacentCity: false });
    });

    // Adjacent city routes (deduplicate — primary wins)
    for (let i = 1; i < allCities.length; i++) {
        const adjCity = allCities[i];
        const adjRoutes = results[i] || [];
        adjRoutes.forEach(route => {
            if (!seenIds.has(route.id)) {
                seenIds.add(route.id);
                merged.push({ ...route, sourceCity: adjCity, isAdjacentCity: true });
            }
        });
    }

    // Sort: numbers first, then alphabetical
    merged.sort((a, b) => {
        const aNum = parseInt(a.id);
        const bNum = parseInt(b.id);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        if (!isNaN(aNum)) return -1;
        if (!isNaN(bNum)) return 1;
        return a.id.localeCompare(b.id, 'zh-TW');
    });

    mergedRoutesCache[city] = merged;
    console.log(`[Bus] Merged routes for ${city}: ${primaryRoutes.length} primary + ${merged.length - primaryRoutes.length} adjacent = ${merged.length} total`);
    return merged;
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

        // First pass: build stops with coordinates
        const rawStops = routeData.Stops.map((stop, idx) => ({
            name: {
                en: stop.StopName?.En || stop.StopName?.Zh_tw || `Stop ${idx + 1}`,
                zh: stop.StopName?.Zh_tw || `站點 ${idx + 1}`
            },
            stopUID: stop.StopUID,
            sequence: stop.StopSequence || idx + 1,
            lat: stop.StopPosition?.PositionLat || null,
            lng: stop.StopPosition?.PositionLon || null,
            time: null // will be filled in below
        }));

        // Second pass: calculate distance-based estimated times
        const estimatedTimes = calculateEstimatedTimes(rawStops);
        const stops = rawStops.map((stop, idx) => ({
            ...stop,
            time: estimatedTimes[idx] || calculateEstimatedTime(idx)
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

// Fetch real-time arrival data for a specific route from TDX
async function fetchRouteArrivals(city, routeName) {
    const token = await getAccessToken();
    if (!token) {
        console.warn('[Bus] No TDX token for route arrivals');
        return {};
    }

    try {
        const encodedRouteName = encodeURIComponent(routeName);
        const apiPath = `/v2/Bus/EstimatedTimeOfArrival/City/${city}/${encodedRouteName}?$format=JSON`;

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
        const result = {};

        data.forEach(item => {
            const dir = item.Direction === 0 ? 'go' : 'back';
            const key = `${dir}_${item.StopUID}`;
            result[key] = {
                estimateTime: item.EstimateTime,
                stopStatus: item.StopStatus,
                direction: item.Direction
            };
        });

        console.log(`[Bus] Fetched route arrivals for ${routeName}: ${Object.keys(result).length} entries`);
        return result;
    } catch (error) {
        console.error('[Bus] Error fetching route arrivals:', error);
        return {};
    }
}

// Fetch real-time bus positions and near-stop data for a route
async function fetchRouteBusPositions(city, routeName) {
    const token = await getAccessToken();
    if (!token) {
        return { nearStop: {}, busPositions: [] };
    }

    const encodedRouteName = encodeURIComponent(routeName);
    const nearStopPath = `/v2/Bus/RealTimeNearStop/City/${city}/${encodedRouteName}?$format=JSON`;
    const frequencyPath = `/v2/Bus/RealTimeByFrequency/City/${city}/${encodedRouteName}?$format=JSON`;

    const buildUrl = (path) => useProxy() ? TDX_PROXY_URL + path : TDX_CONFIG.apiUrl + path;
    const fetchOpts = useProxy() ? {} : { headers: { 'Authorization': `Bearer ${token}` } };

    try {
        const [nearStopRes, frequencyRes] = await Promise.all([
            fetchWithRetry(buildUrl(nearStopPath), fetchOpts).catch(() => null),
            fetchWithRetry(buildUrl(frequencyPath), fetchOpts).catch(() => null)
        ]);

        const nearStop = {};
        if (nearStopRes && nearStopRes.ok) {
            const nearStopData = await nearStopRes.json();
            nearStopData.forEach(item => {
                if (item.BusStatus !== undefined && item.BusStatus !== 0) return; // skip non-normal buses
                const dir = item.Direction === 0 ? 'go' : 'back';
                const key = `${dir}_${item.StopUID}`;
                nearStop[key] = {
                    plate: item.PlateNumb,
                    a2event: item.A2EventType // 0=departing, 1=arriving
                };
            });
        }

        const busPositions = [];
        if (frequencyRes && frequencyRes.ok) {
            const freqData = await frequencyRes.json();
            freqData.forEach(item => {
                if (item.BusStatus !== undefined && item.BusStatus !== 0) return;
                const lat = item.BusPosition?.PositionLat;
                const lng = item.BusPosition?.PositionLon;
                if (lat && lng) {
                    busPositions.push({
                        plate: item.PlateNumb,
                        lat,
                        lng,
                        speed: item.Speed || 0,
                        direction: item.Direction === 0 ? 'go' : 'back'
                    });
                }
            });
        }

        console.log(`[Bus] Fetched bus positions for ${routeName}: ${Object.keys(nearStop).length} near-stop, ${busPositions.length} GPS`);
        return { nearStop, busPositions };
    } catch (error) {
        console.error('[Bus] Error fetching bus positions:', error);
        return { nearStop: {}, busPositions: [] };
    }
}

// Find same route name in other cities using memory/localStorage cache
// Skips adjacent cities since they are already merged into the dropdown
function findRouteInOtherCities(routeId) {
    if (!routeId) return [];
    const results = [];
    const routeNameLower = routeId.toLowerCase();
    const adjacentSet = new Set(getAdjacentCities(currentRouteCity));
    adjacentSet.add(currentRouteCity);

    Object.keys(fetchedRoutes).forEach(city => {
        if (adjacentSet.has(city)) return; // Skip primary + adjacent cities
        const routes = fetchedRoutes[city];
        if (!routes) return;
        const match = routes.find(r =>
            r.id.toLowerCase() === routeNameLower ||
            r.name.zh === routeId ||
            r.name.en.toLowerCase() === routeNameLower
        );
        if (match) {
            const cityInfo = BUS_CITIES[city];
            results.push({
                city,
                cityName: isZh ? cityInfo.name.zh : cityInfo.name.en,
                routeId: match.id
            });
        }
    });

    return results;
}

// Switch to a route in another city (from cross-city note)
async function switchToRouteCity(cityKey) {
    const routeName = currentRoute; // Remember current route name
    const select = document.getElementById('route-city-select');
    if (select) select.value = cityKey;

    delete mergedRoutesCache[currentRouteCity];
    currentRouteCity = cityKey;
    activeRouteSourceCity = null;
    routeSearchQuery = '';
    selectedOriginStop = null;
    selectedDestStop = null;
    routeArrivalData = {};
    routeBusData = { nearStop: {}, busPositions: [] };

    if (routeArrivalTimer) {
        clearInterval(routeArrivalTimer);
        routeArrivalTimer = null;
    }

    const searchInput = document.getElementById('route-search-input');
    if (searchInput) searchInput.value = '';

    await updateRouteSelector();

    // Auto-select the same route name
    const routeSelect = document.getElementById('route-select');
    if (routeSelect) {
        const matchOption = Array.from(routeSelect.options).find(opt => opt.value === routeName);
        if (matchOption) {
            routeSelect.value = routeName;
            currentRoute = routeName;
            await onRouteChange();
            return;
        }
    }

    currentRoute = '';
    renderRouteSchedule();
    updateRouteMapMarkers();
}

// Refresh route arrivals and re-render (called by auto-refresh timer)
async function refreshRouteArrivals() {
    if (!currentRoute) return;

    const scheduleTabActive = document.querySelector('.tab-btn[data-tab="schedule"]')?.classList.contains('active');
    if (!scheduleTabActive) return;

    const city = activeRouteSourceCity || currentRouteCity;
    const [arrivals, busData] = await Promise.all([
        fetchRouteArrivals(city, currentRoute),
        fetchRouteBusPositions(city, currentRoute)
    ]);
    routeArrivalData = arrivals;
    routeBusData = busData;
    renderRouteSchedule();
    updateRouteMapMarkers();
    console.log('[Bus] Route arrivals & bus positions refreshed');
}

// Calculate estimated times for all stops based on distances between them
// Returns array of "HH:MM" strings. Uses coordinates when available,
// falls back to even spacing for stops without coordinates.
function calculateEstimatedTimes(stops) {
    const BASE_MINUTES = 360; // 06:00 start
    const AVG_SPEED_KMH = 20; // average city bus speed including traffic
    const ROAD_FACTOR = 1.3;  // straight-line to road distance multiplier
    const DWELL_SECONDS = 30; // dwell time per stop
    const MIN_MINUTES = 1;    // minimum 1 min between stops
    const FALLBACK_MINUTES = 2; // fallback when no coordinates

    if (!stops || stops.length === 0) return [];

    const times = [BASE_MINUTES]; // first stop at base time

    for (let i = 1; i < stops.length; i++) {
        const prev = stops[i - 1];
        const curr = stops[i];
        let segmentMinutes = FALLBACK_MINUTES;

        if (prev.lat && prev.lng && curr.lat && curr.lng) {
            const distMeters = getDistanceInMeters(prev.lat, prev.lng, curr.lat, curr.lng);
            const roadMeters = distMeters * ROAD_FACTOR;
            const travelSeconds = (roadMeters / 1000) / AVG_SPEED_KMH * 3600;
            segmentMinutes = Math.max(MIN_MINUTES, Math.round((travelSeconds + DWELL_SECONDS) / 60));
        }

        times.push(times[i - 1] + segmentMinutes);
    }

    return times.map(totalMin => {
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    });
}

// Legacy single-stop fallback (used when stops array not available)
function calculateEstimatedTime(index) {
    const totalMinutes = 360 + index * 2;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// Safely parse a "HH:MM" time string into [hours, minutes].
// Returns [0, 0] if the input is invalid.
function safeParseTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) return [0, 0];
    const parts = timeStr.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return [0, 0];
    return parts;
}

// Convert "HH:MM" to total minutes, safely.
function timeToMinutes(timeStr) {
    const [h, m] = safeParseTime(timeStr);
    return h * 60 + m;
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

    // Update sheet summary
    updateSheetSummary();
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

function clearBusMarkers() {
    busMarkers.forEach(m => map.removeLayer(m));
    busMarkers = [];
}

function updateRouteMapMarkers() {
    clearMarkers();
    clearBusMarkers();
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

        // Bus near-stop and arrival info for popup
        const popupArrivalKey = `${routeDirection}_${stop.stopUID}`;
        const popupNearStop = routeBusData.nearStop[popupArrivalKey];
        const popupArrival = routeArrivalData[popupArrivalKey];
        let busInfoHtml = '';
        if (popupNearStop && popupNearStop.plate) {
            const eventText = popupNearStop.a2event === 1 ? (isZh ? '進站中' : 'Arriving') : (isZh ? '離站中' : 'Departing');
            busInfoHtml = `<br><span style="color:#E65100;">🚌 ${popupNearStop.plate} ${eventText}</span>`;
        } else if (popupArrival) {
            const timeStr = formatArrivalTime(popupArrival.estimateTime, popupArrival.stopStatus);
            busInfoHtml = `<br><span style="color:#1565C0;">${timeStr}</span>`;
        }

        marker.bindPopup(`
            <div style="text-align:center;">
                <strong>${stopName}</strong><br>
                <small>${isZh ? '站序' : 'Stop'} ${idx + 1}</small>
                ${labelText}${busInfoHtml}
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

    // Plot live bus markers from GPS positions
    const dirFilter = routeDirection;
    routeBusData.busPositions.forEach(bus => {
        if (bus.direction !== dirFilter) return;
        const busIcon = L.divIcon({
            className: '',
            html: `<div class="bus-live-marker" style="width:30px;height:30px;">🚌</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15]
        });
        const busM = L.marker([bus.lat, bus.lng], { icon: busIcon, zIndexOffset: 1000 });
        const speedText = bus.speed > 0 ? `${bus.speed} km/h` : (isZh ? '停靠中' : 'Stopped');
        const dirText = bus.direction === 'go' ? (isZh ? '去程' : 'Outbound') : (isZh ? '返程' : 'Return');
        busM.bindPopup(`
            <div style="text-align:center;">
                <strong>🚌 ${bus.plate || '---'}</strong><br>
                <small>${dirText} · ${speedText}</small>
            </div>
        `);
        busM.addTo(map);
        busMarkers.push(busM);
    });

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

    // Pre-load localStorage-cached routes for cross-city search (no API calls)
    Object.keys(BUS_CITIES).forEach(city => {
        if (!fetchedRoutes[city]) {
            const cached = loadRoutesFromCache(city);
            if (cached) fetchedRoutes[city] = cached;
        }
    });

    // Initialize route schedule (async - will update when ready)
    updateRouteSelector().then(() => {
        console.log('[Bus] Routes loaded for', currentRouteCity);
        // Pre-fetch adjacent cities in background to warm the cache
        getAdjacentCities(currentRouteCity).forEach(city => {
            if (!fetchedRoutes[city]) fetchRoutes(city).catch(() => {});
        });
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

    // Note: schedule time updates are handled by routeArrivalTimer (30s)
    // which calls refreshRouteArrivals() → renderRouteSchedule()

    // Initialize bottom sheet (mobile only)
    const panel = document.getElementById('panel');
    if (panel && typeof BottomSheet !== 'undefined') {
        bottomSheet = new BottomSheet(panel, {
            initialSnap: 'collapsed',
            onSnapChange: (snap) => {
                console.log('[Bus] Sheet snap:', snap);
            }
        });
    }

    // Update sheet summary
    updateSheetSummary();

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
window.switchToRouteCity = switchToRouteCity;
window.getAdjacentCities = getAdjacentCities;
window.fetchMergedRoutes = fetchMergedRoutes;

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
