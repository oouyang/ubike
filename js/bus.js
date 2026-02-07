'use strict';

/**
 * Taiwan Bus - Nearby Stops & Arrivals
 * JavaScript module for bus.html
 */

// ===========================================
// TDX API Configuration
// ===========================================
//
// OPTION 1: Use Cloudflare Worker Proxy (RECOMMENDED - Secure)
// Deploy the worker from /workers/tdx-proxy.js, then set the URL below:
const TDX_PROXY_URL = ''; // Disabled - deploy proxy or get TDX credentials first // https://tdx-proxy.owen-ouyang.workers.dev
//
// OPTION 2: Direct API (credentials exposed in browser - NOT recommended for production)
// Register FREE at https://tdx.transportdata.tw/ to get Client ID and Secret
const TDX_CONFIG = {
    clientId: '', // Your TDX Client ID (free registration)
    clientSecret: '', // Your TDX Client Secret
    authUrl: 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
    apiUrl: 'https://tdx.transportdata.tw/api/basic'
};
//
// If neither is configured, demo mode will be used
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
let isZh = (navigator.language || navigator.userLanguage).startsWith('zh');
let refreshTimer = null;

// Use common.js utilities if available, otherwise define locally
const deg2rad = (typeof window.deg2rad === 'function') ? window.deg2rad : (deg) => deg * (Math.PI / 180);

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    if (typeof window.getDistanceInMeters === 'function') {
        return window.getDistanceInMeters(lat1, lon1, lat2, lon2);
    }
    const R = 6371000;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

function toggleLang() {
    isZh = !isZh;
    localStorage.setItem('ubike-lang', isZh ? 'zh' : 'en');
    updateUI();
}

function updateUI() {
    document.getElementById('page-title').textContent = isZh ? '台灣公車' : 'Taiwan Bus';
    document.getElementById('search-input').placeholder = isZh ? '搜尋站牌或路線...' : 'Search stops or routes...';

    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const text = isZh ? btn.dataset.zh : btn.dataset.en;
        if (text) btn.textContent = text;
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
        console.warn('[Bus] TDX not configured, using demo mode');
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
        // Demo mode - generate sample stops
        return generateDemoStops(lat, lng);
    }

    try {
        const apiPath = `/v2/Bus/Stop/City/${currentCity}?$spatialFilter=nearby(${lat},${lng},${radius})&$top=30&$format=JSON`;

        let response;
        if (useProxy()) {
            // Use proxy - no auth header needed
            response = await fetch(TDX_PROXY_URL + apiPath);
        } else {
            // Direct API call
            response = await fetch(TDX_CONFIG.apiUrl + apiPath, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        return data.map(stop => ({
            id: stop.StopUID,
            name: { en: stop.StopName.En || stop.StopName.Zh_tw, zh: stop.StopName.Zh_tw },
            lat: stop.StopPosition.PositionLat,
            lng: stop.StopPosition.PositionLon,
            address: stop.StopAddress || '',
            city: currentCity
        }));
    } catch (error) {
        console.error('[Bus] Error fetching stops:', error);
        return generateDemoStops(lat, lng);
    }
}

// Fetch arrival times for stops
async function fetchArrivals(stopIds) {
    const token = await getAccessToken();

    if (!token) {
        return generateDemoArrivals(stopIds);
    }

    try {
        const filter = stopIds.map(id => `StopUID eq '${id}'`).join(' or ');
        const apiPath = `/v2/Bus/EstimatedTimeOfArrival/City/${currentCity}?$filter=${encodeURIComponent(filter)}&$top=200&$format=JSON`;

        let response;
        if (useProxy()) {
            // Use proxy - no auth header needed
            response = await fetch(TDX_PROXY_URL + apiPath);
        } else {
            // Direct API call
            response = await fetch(TDX_CONFIG.apiUrl + apiPath, {
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

        return arrivals;
    } catch (error) {
        console.error('[Bus] Error fetching arrivals:', error);
        return generateDemoArrivals(stopIds);
    }
}

// Generate demo data when API is not available
function generateDemoStops(lat, lng) {
    const demoStops = [
        { offset: [0.001, 0.001], name: { en: 'City Hall', zh: '市政府站' } },
        { offset: [-0.001, 0.002], name: { en: 'Main Station', zh: '火車站' } },
        { offset: [0.002, -0.001], name: { en: 'Park Entrance', zh: '公園入口' } },
        { offset: [-0.002, -0.002], name: { en: 'Hospital', zh: '醫院站' } },
        { offset: [0.0015, 0.0015], name: { en: 'School', zh: '學校站' } },
        { offset: [-0.0015, 0.001], name: { en: 'Market', zh: '市場站' } },
        { offset: [0.001, -0.002], name: { en: 'Library', zh: '圖書館' } },
        { offset: [-0.001, -0.001], name: { en: 'Sports Center', zh: '運動中心' } }
    ];

    return demoStops.map((stop, i) => ({
        id: `DEMO_${i}`,
        name: stop.name,
        lat: lat + stop.offset[0],
        lng: lng + stop.offset[1],
        address: isZh ? '示範地址' : 'Demo Address',
        city: currentCity,
        isDemo: true
    }));
}

function generateDemoArrivals(stopIds) {
    const routes = ['307', '299', '信義幹線', '藍27', '紅5', '綠1', '棕9', '橘12'];
    const arrivals = {};

    stopIds.forEach(id => {
        const numRoutes = Math.floor(Math.random() * 4) + 1;
        arrivals[id] = [];

        for (let i = 0; i < numRoutes; i++) {
            const route = routes[Math.floor(Math.random() * routes.length)];
            const time = Math.floor(Math.random() * 20) * 60; // 0-20 minutes

            arrivals[id].push({
                route: route,
                routeEn: route,
                estimateTime: time,
                stopStatus: time === 0 ? 1 : 0,
                direction: Math.floor(Math.random() * 2)
            });
        }
    });

    return arrivals;
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
        listEl.innerHTML = `<li class="loading">${isZh ? '找不到站牌' : 'No stops found'}</li>`;
        return;
    }

    // Update info bar
    const demoMode = busStops.some(s => s.isDemo);
    let infoText;
    if (demoMode) {
        infoText = isZh
            ? '示範模式 - 部署 <a href="workers/DEPLOY.md" style="color:#1565C0;">Cloudflare Worker</a> 或 <a href="https://tdx.transportdata.tw/" target="_blank" style="color:#1565C0;">免費註冊 TDX</a> 以獲取即時資料'
            : 'Demo mode - Deploy <a href="workers/DEPLOY.md" style="color:#1565C0;">Cloudflare Worker</a> or <a href="https://tdx.transportdata.tw/" target="_blank" style="color:#1565C0;">register TDX FREE</a> for real-time data';
    } else if (useProxy()) {
        infoText = isZh
            ? `顯示 ${filteredStops.length} 個站牌 (即時資料 via Proxy)`
            : `Showing ${filteredStops.length} stops (real-time via Proxy)`;
    } else {
        infoText = isZh
            ? `顯示 ${filteredStops.length} 個站牌 (即時資料)`
            : `Showing ${filteredStops.length} stops (real-time)`;
    }
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

    updateUI();

    // Initialize map
    const cityData = BUS_CITIES[currentCity];
    map = L.map('map-canvas').setView(cityData.center, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Get user location
    if ('geolocation' in navigator) {
        try {
            document.getElementById('loading-text').textContent = isZh ? '取得您的位置...' : 'Getting your location...';

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });

            userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            console.log('[Bus] User location:', userLocation);

            // Add user marker
            userMarker = L.marker([userLocation.lat, userLocation.lng], {
                icon: createMarkerIcon(true)
            }).addTo(map);
            userMarker.bindPopup(isZh ? '您的位置' : 'Your Location');

            map.setView([userLocation.lat, userLocation.lng], 16);
        } catch (error) {
            console.warn('[Bus] Could not get location:', error.message);
        }
    }

    // Load nearby stops
    await loadNearbyStops();

    // Setup search
    document.getElementById('search-input').addEventListener('input', handleSearch);

    // Auto-refresh every 30 seconds
    refreshTimer = setInterval(async () => {
        if (busStops.length > 0) {
            const stopIds = busStops.map(s => s.id);
            arrivalData = await fetchArrivals(stopIds);
            renderStopList();
            updatePopups();
            console.log('[Bus] Arrival data refreshed');
        }
    }, 30000);

    console.log('[Bus] Initialization complete');
}

// Make functions available globally
window.toggleLang = toggleLang;
window.changeCity = changeCity;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
