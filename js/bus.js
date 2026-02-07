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

// Demo bus routes with stops and schedule (for Route Schedule tab)
const BUS_ROUTES = {
    Taipei: [
        { id: '307', name: { en: '307', zh: '307' }, terminals: { en: 'Banqiao - MRT Gongguan', zh: '板橋－捷運公館站' } },
        { id: '299', name: { en: '299', zh: '299' }, terminals: { en: 'Yonghe - MRT Taipei 101', zh: '永和－捷運台北101' } },
        { id: '信義幹線', name: { en: 'Xinyi', zh: '信義幹線' }, terminals: { en: 'Songshan Station - Yongchun', zh: '松山車站－永春' } },
        { id: '藍27', name: { en: 'Blue 27', zh: '藍27' }, terminals: { en: 'Neihu - Nangang', zh: '內湖－南港' } },
        { id: '紅5', name: { en: 'Red 5', zh: '紅5' }, terminals: { en: 'Taipei Main - Yangmingshan', zh: '台北車站－陽明山' } },
        { id: '綠1', name: { en: 'Green 1', zh: '綠1' }, terminals: { en: 'Xinyi - Taipei Zoo', zh: '信義－台北動物園' } },
    ],
    NewTaipei: [
        { id: '275', name: { en: '275', zh: '275' }, terminals: { en: 'Sanchong - Taipei', zh: '三重－台北' } },
        { id: '橘12', name: { en: 'Orange 12', zh: '橘12' }, terminals: { en: 'Zhonghe - Taipei', zh: '中和－台北' } },
        { id: '藍38', name: { en: 'Blue 38', zh: '藍38' }, terminals: { en: 'Tucheng - Banqiao', zh: '土城－板橋' } },
    ],
    Taoyuan: [
        { id: '206', name: { en: '206', zh: '206' }, terminals: { en: 'Taoyuan Station - Airport', zh: '桃園車站－機場' } },
        { id: '501', name: { en: '501', zh: '501' }, terminals: { en: 'Zhongli - HSR Station', zh: '中壢－高鐵站' } },
    ],
    Taichung: [
        { id: '300', name: { en: '300', zh: '300' }, terminals: { en: 'Taichung Station - HSR', zh: '台中車站－高鐵站' } },
        { id: '301', name: { en: '301', zh: '301' }, terminals: { en: 'Xinmin - Taichung Station', zh: '新民－台中車站' } },
        { id: '藍1', name: { en: 'Blue 1', zh: '藍1' }, terminals: { en: 'Taichung Port - Station', zh: '台中港－台中車站' } },
    ],
    Tainan: [
        { id: '2', name: { en: '2', zh: '2' }, terminals: { en: 'Tainan Station - Anping', zh: '台南車站－安平' } },
        { id: '紅幹線', name: { en: 'Red Line', zh: '紅幹線' }, terminals: { en: 'Tainan - Shanhua', zh: '台南－善化' } },
    ],
    Kaohsiung: [
        { id: '紅27', name: { en: 'Red 27', zh: '紅27' }, terminals: { en: 'HSR Zuoying - Siaogang', zh: '高鐵左營－小港' } },
        { id: '橘8', name: { en: 'Orange 8', zh: '橘8' }, terminals: { en: 'Zuoying - Fongshan', zh: '左營－鳳山' } },
        { id: '205', name: { en: '205', zh: '205' }, terminals: { en: 'Kaohsiung Station - MRT', zh: '高雄車站－捷運' } },
    ]
};

// Demo route stops data
const ROUTE_STOPS = {
    '307': {
        go: [
            { name: { en: 'Banqiao Station', zh: '板橋車站' }, time: '06:00' },
            { name: { en: 'Fuzhong', zh: '府中' }, time: '06:05' },
            { name: { en: 'Jiangzicui', zh: '江子翠' }, time: '06:10' },
            { name: { en: 'Longshan Temple', zh: '龍山寺' }, time: '06:18' },
            { name: { en: 'Ximen', zh: '西門' }, time: '06:23' },
            { name: { en: 'Taipei Main Station', zh: '台北車站' }, time: '06:30' },
            { name: { en: 'Zhongxiao Xinsheng', zh: '忠孝新生' }, time: '06:38' },
            { name: { en: 'Guting', zh: '古亭' }, time: '06:45' },
            { name: { en: 'Taipower Building', zh: '台電大樓' }, time: '06:50' },
            { name: { en: 'MRT Gongguan', zh: '捷運公館站' }, time: '06:55' },
        ],
        back: [
            { name: { en: 'MRT Gongguan', zh: '捷運公館站' }, time: '07:00' },
            { name: { en: 'Taipower Building', zh: '台電大樓' }, time: '07:05' },
            { name: { en: 'Guting', zh: '古亭' }, time: '07:10' },
            { name: { en: 'Zhongxiao Xinsheng', zh: '忠孝新生' }, time: '07:17' },
            { name: { en: 'Taipei Main Station', zh: '台北車站' }, time: '07:25' },
            { name: { en: 'Ximen', zh: '西門' }, time: '07:32' },
            { name: { en: 'Longshan Temple', zh: '龍山寺' }, time: '07:37' },
            { name: { en: 'Jiangzicui', zh: '江子翠' }, time: '07:45' },
            { name: { en: 'Fuzhong', zh: '府中' }, time: '07:50' },
            { name: { en: 'Banqiao Station', zh: '板橋車站' }, time: '07:55' },
        ]
    },
    '299': {
        go: [
            { name: { en: 'Yonghe', zh: '永和' }, time: '06:00' },
            { name: { en: 'Dingxi', zh: '頂溪' }, time: '06:06' },
            { name: { en: 'Guting', zh: '古亭' }, time: '06:14' },
            { name: { en: 'Dongmen', zh: '東門' }, time: '06:20' },
            { name: { en: 'Zhongxiao Fuxing', zh: '忠孝復興' }, time: '06:28' },
            { name: { en: 'Taipei City Hall', zh: '市政府' }, time: '06:38' },
            { name: { en: 'MRT Taipei 101', zh: '捷運台北101' }, time: '06:45' },
        ],
        back: [
            { name: { en: 'MRT Taipei 101', zh: '捷運台北101' }, time: '07:00' },
            { name: { en: 'Taipei City Hall', zh: '市政府' }, time: '07:07' },
            { name: { en: 'Zhongxiao Fuxing', zh: '忠孝復興' }, time: '07:17' },
            { name: { en: 'Dongmen', zh: '東門' }, time: '07:25' },
            { name: { en: 'Guting', zh: '古亭' }, time: '07:31' },
            { name: { en: 'Dingxi', zh: '頂溪' }, time: '07:39' },
            { name: { en: 'Yonghe', zh: '永和' }, time: '07:45' },
        ]
    },
    '信義幹線': {
        go: [
            { name: { en: 'Songshan Station', zh: '松山車站' }, time: '06:10' },
            { name: { en: 'Songshan', zh: '松山' }, time: '06:14' },
            { name: { en: 'Nanjing Sanmin', zh: '南京三民' }, time: '06:19' },
            { name: { en: 'Taipei Arena', zh: '小巨蛋' }, time: '06:25' },
            { name: { en: 'Zhongxiao Dunhua', zh: '忠孝敦化' }, time: '06:32' },
            { name: { en: 'Taipei City Hall', zh: '市政府' }, time: '06:40' },
            { name: { en: 'Yongchun', zh: '永春' }, time: '06:48' },
        ],
        back: [
            { name: { en: 'Yongchun', zh: '永春' }, time: '07:00' },
            { name: { en: 'Taipei City Hall', zh: '市政府' }, time: '07:08' },
            { name: { en: 'Zhongxiao Dunhua', zh: '忠孝敦化' }, time: '07:16' },
            { name: { en: 'Taipei Arena', zh: '小巨蛋' }, time: '07:23' },
            { name: { en: 'Nanjing Sanmin', zh: '南京三民' }, time: '07:29' },
            { name: { en: 'Songshan', zh: '松山' }, time: '07:34' },
            { name: { en: 'Songshan Station', zh: '松山車站' }, time: '07:38' },
        ]
    },
    // Default route data for routes without detailed stops
    _default: {
        go: [
            { name: { en: 'Terminal A', zh: '起點站' }, time: '06:00' },
            { name: { en: 'Stop 1', zh: '站點1' }, time: '06:08' },
            { name: { en: 'Stop 2', zh: '站點2' }, time: '06:16' },
            { name: { en: 'Stop 3', zh: '站點3' }, time: '06:24' },
            { name: { en: 'Stop 4', zh: '站點4' }, time: '06:32' },
            { name: { en: 'Terminal B', zh: '終點站' }, time: '06:40' },
        ],
        back: [
            { name: { en: 'Terminal B', zh: '終點站' }, time: '07:00' },
            { name: { en: 'Stop 4', zh: '站點4' }, time: '07:08' },
            { name: { en: 'Stop 3', zh: '站點3' }, time: '07:16' },
            { name: { en: 'Stop 2', zh: '站點2' }, time: '07:24' },
            { name: { en: 'Stop 1', zh: '站點1' }, time: '07:32' },
            { name: { en: 'Terminal A', zh: '起點站' }, time: '07:40' },
        ]
    }
};

// Schedule intervals (first/last bus times and frequency)
const ROUTE_SCHEDULE = {
    '307': { firstBus: '05:30', lastBus: '23:30', peakInterval: 8, offPeakInterval: 15 },
    '299': { firstBus: '05:40', lastBus: '23:00', peakInterval: 10, offPeakInterval: 20 },
    '信義幹線': { firstBus: '06:00', lastBus: '22:30', peakInterval: 10, offPeakInterval: 15 },
    _default: { firstBus: '06:00', lastBus: '22:00', peakInterval: 15, offPeakInterval: 20 }
};

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
let scheduleTimer = null;

// Route schedule state
let currentRouteCity = 'Taipei';
let currentRoute = '';
let routeDirection = 'go';

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

    // Update route schedule UI
    updateRouteSelector();
    renderRouteSchedule();
}

// ===== Tab Management =====

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
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

function updateRouteSelector() {
    const select = document.getElementById('route-select');
    if (!select) return;

    const routes = BUS_ROUTES[currentRouteCity] || [];
    const currentValue = select.value;

    select.innerHTML = `<option value="">${isZh ? '-- 選擇路線 --' : '-- Select Route --'}</option>`;
    routes.forEach(route => {
        const name = isZh ? route.name.zh : route.name.en;
        const terminals = isZh ? route.terminals.zh : route.terminals.en;
        select.innerHTML += `<option value="${route.id}">${name} (${terminals})</option>`;
    });

    // Restore selection if still valid
    if (routes.some(r => r.id === currentValue)) {
        select.value = currentValue;
    }

    // Update city selector text
    updateRouteCitySelector();
}

function onRouteCityChange() {
    const select = document.getElementById('route-city-select');
    currentRouteCity = select.value;
    currentRoute = '';
    updateRouteSelector();
    renderRouteSchedule();
}

function onRouteChange() {
    const select = document.getElementById('route-select');
    currentRoute = select.value;
    renderRouteSchedule();
}

function setRouteDirection(dir) {
    routeDirection = dir;
    document.querySelectorAll('.direction-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.dir === dir);
    });
    renderRouteSchedule();
}

function getRouteStops(routeId, direction) {
    const routeData = ROUTE_STOPS[routeId] || ROUTE_STOPS._default;
    return routeData[direction] || routeData.go;
}

function getRouteScheduleInfo(routeId) {
    return ROUTE_SCHEDULE[routeId] || ROUTE_SCHEDULE._default;
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

    const stops = getRouteStops(currentRoute, routeDirection);
    const scheduleInfo = getRouteScheduleInfo(currentRoute);
    const nextBus = getNextBusTime(scheduleInfo);

    // Route info header
    let headerHtml = '';
    if (nextBus.ended) {
        headerHtml = `<li class="route-stop-item" style="background:#FFF3E0;">
            <div class="route-stop-info">
                <div class="route-stop-name" style="color:#E65100;">${isZh ? '今日營運已結束' : 'Service ended for today'}</div>
                <div class="route-stop-time">${isZh ? '首班車' : 'First bus'}: ${scheduleInfo.firstBus}</div>
            </div>
        </li>`;
    } else if (nextBus.waitMinutes !== null) {
        const waitText = nextBus.waitMinutes <= 1
            ? (isZh ? '即將到站' : 'Arriving')
            : `${nextBus.waitMinutes} ${isZh ? '分鐘' : 'min'}`;
        headerHtml = `<li class="route-stop-item" style="background:#E8F5E9;">
            <div class="route-stop-info">
                <div class="route-stop-name" style="color:#2E7D32;">${isZh ? '下一班車' : 'Next bus'}: ${nextBus.time}</div>
                <div class="route-stop-time">${isZh ? '班距' : 'Interval'}: ${scheduleInfo.peakInterval}-${scheduleInfo.offPeakInterval} ${isZh ? '分鐘' : 'min'}</div>
            </div>
            <div class="bus-eta ${nextBus.waitMinutes <= 5 ? 'arriving' : 'scheduled'}">${waitText}</div>
        </li>`;
    }

    const stopsHtml = stops.map((stop, index) => {
        const isTerminal = index === 0 || index === stops.length - 1;
        const stopName = isZh ? stop.name.zh : stop.name.en;

        return `
            <li class="route-stop-item">
                <div class="stop-sequence ${isTerminal ? 'terminal' : ''}">${index + 1}</div>
                <div class="route-stop-info">
                    <div class="route-stop-name">${stopName}</div>
                    <div class="route-stop-time">${isZh ? '預計' : 'Est.'} ${stop.time}</div>
                </div>
            </li>
        `;
    }).join('');

    listEl.innerHTML = headerHtml + stopsHtml;
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

    // Setup tabs
    setupTabs();

    updateUI();

    // Initialize route schedule
    updateRouteSelector();
    renderRouteSchedule();

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

    // Auto-refresh arrivals every 30 seconds
    refreshTimer = setInterval(async () => {
        if (busStops.length > 0) {
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
