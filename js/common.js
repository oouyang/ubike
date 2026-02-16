'use strict';

/**
 * Taiwan Transport PWA - Shared Utilities Module
 * Common functions and configurations used across multiple pages
 */

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Official YouBike API - covers all cities across Taiwan
 */
const YOUBIKE_API = 'https://apis.youbike.com.tw/json/station-yb2.json';

/**
 * City configurations with area codes for YouBike API filtering
 */
const CITIES = {
    all: { name: { en: 'All Cities', zh: '全部' }, areaCode: null, center: [23.5, 121] },
    taipei: { name: { en: 'Taipei', zh: '台北市' }, areaCode: '00', center: [25.0330, 121.5654] },
    newtaipei: { name: { en: 'New Taipei', zh: '新北市' }, areaCode: '05', center: [25.0119, 121.4650] },
    taoyuan: { name: { en: 'Taoyuan', zh: '桃園市' }, areaCode: '07', center: [24.9936, 121.3010] },
    hsinchu: { name: { en: 'Hsinchu City', zh: '新竹市' }, areaCode: '09', center: [24.8138, 120.9675] },
    hsinchuCounty: { name: { en: 'Hsinchu County', zh: '新竹縣' }, areaCode: '0B', center: [24.8387, 121.0178] },
    miaoli: { name: { en: 'Miaoli', zh: '苗栗縣' }, areaCode: '0A', center: [24.5602, 120.8214] },
    taichung: { name: { en: 'Taichung', zh: '台中市' }, areaCode: '01', center: [24.1477, 120.6736] },
    chiayi: { name: { en: 'Chiayi City', zh: '嘉義市' }, areaCode: '08', center: [23.4800, 120.4491] },
    chiayiCounty: { name: { en: 'Chiayi County', zh: '嘉義縣' }, areaCode: '11', center: [23.4518, 120.2555] },
    tainan: { name: { en: 'Tainan', zh: '台南市' }, areaCode: '13', center: [22.9998, 120.2270] },
    kaohsiung: { name: { en: 'Kaohsiung', zh: '高雄市' }, areaCode: '12', center: [22.6273, 120.3014] },
    pingtung: { name: { en: 'Pingtung', zh: '屏東縣' }, areaCode: '14', center: [22.6762, 120.4929] },
    taitung: { name: { en: 'Taitung', zh: '台東縣' }, areaCode: '15', center: [22.7583, 121.1444] }
};

/**
 * YouBike fare data per city - base tiers + per-city subsidy/TPASS info
 * Base rates are the same across all 13 cities; per-city data captures subsidy + TPASS only.
 * Source: youbike.com.tw/region/taipei/rate/
 */
const YOUBIKE_FARES = {
    _base: {
        yb2: [
            { minutes: 240, per30: 10 },
            { minutes: 480, per30: 20 },
            { minutes: Infinity, per30: 40 }
        ],
        yb2e: [
            { minutes: 120, per30: 20 },
            { minutes: Infinity, per30: 40 }
        ]
    },
    taipei:        { free30: true,  hasEbike: true,  tpass: { zh: '基北北桃 NT$1,200', en: 'Metro Taipei NT$1,200' } },
    newtaipei:     { free30: true,  hasEbike: true,  tpass: { zh: '基北北桃 NT$1,200', en: 'Metro Taipei NT$1,200' } },
    taoyuan:       { free30: true,  hasEbike: true,  tpass: { zh: '基北北桃 NT$1,200', en: 'Metro Taipei NT$1,200' } },
    hsinchu:       { free30: true,  hasEbike: false, tpass: { zh: '竹竹苗 NT$999', en: 'Hsinchu-Miaoli NT$999' } },
    hsinchuCounty: { free30: true,  hasEbike: false, tpass: { zh: '竹竹苗 NT$999', en: 'Hsinchu-Miaoli NT$999' } },
    miaoli:        { free30: true,  hasEbike: false, tpass: { zh: '竹竹苗 NT$999', en: 'Hsinchu-Miaoli NT$999' } },
    taichung:      { free30: true,  hasEbike: false, tpass: { zh: '中彰投 NT$999', en: 'Taichung Region NT$999' } },
    chiayi:        { free30: true,  hasEbike: false, tpass: { zh: '嘉義 NT$999', en: 'Chiayi NT$999' } },
    chiayiCounty:  { free30: true,  hasEbike: false, tpass: { zh: '嘉義 NT$999', en: 'Chiayi NT$999' } },
    tainan:        { free30: true,  hasEbike: false, tpass: { zh: '南高屏 NT$999', en: 'Southern TW NT$999' } },
    kaohsiung:     { free30: true,  hasEbike: false, tpass: { zh: '南高屏 NT$999', en: 'Southern TW NT$999' } },
    pingtung:      { free30: true,  hasEbike: false, tpass: { zh: '南高屏 NT$999', en: 'Southern TW NT$999' } },
    taitung:       { free30: false, hasEbike: false, tpass: null }
};

/**
 * localStorage keys used across the app
 */
const STORAGE_KEYS = {
    LANG: 'ubike-lang',
    CITY: 'ubike-city',
    BUS_CITY: 'bus-city',
    MRT_SYSTEM: 'mrt-system',
    MRT_LANG: 'mrt-lang',
    RAIL_LINE: 'rail-line',
    RAIL_LANG: 'rail-lang',
    TDX_LANG: 'tdx-lang'
};

// ============================================================
// LANGUAGE UTILITIES
// ============================================================

/**
 * Detect user's preferred language from localStorage or browser settings
 * @returns {'en' | 'zh'} Language code
 */
function detectLanguage() {
    const saved = localStorage.getItem(STORAGE_KEYS.LANG);
    if (saved) return saved;
    const userLang = navigator.language || navigator.userLanguage;
    return (userLang === 'zh-TW' || userLang === 'zh-CN' || userLang.startsWith('zh')) ? 'zh' : 'en';
}

/**
 * Check if the current language setting is Chinese
 * @returns {boolean}
 */
function isChineseLocale() {
    return detectLanguage() === 'zh';
}

/**
 * Save language preference to localStorage
 * @param {'en' | 'zh'} lang - Language code
 */
function saveLanguage(lang) {
    localStorage.setItem(STORAGE_KEYS.LANG, lang);
}

// ============================================================
// DISTANCE UTILITIES (Haversine Formula)
// ============================================================

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
const deg2rad = (deg) => deg * (Math.PI / 180);

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @param {boolean} [isZh=false] - Use Chinese units
 * @returns {string} Formatted distance string
 */
function formatDistance(meters, isZh = false) {
    if (meters < 1000) {
        return `${Math.round(meters)} ${isZh ? '公尺' : 'm'}`;
    }
    return `${(meters / 1000).toFixed(1)} ${isZh ? '公里' : 'km'}`;
}

// ============================================================
// YOUBIKE DATA UTILITIES
// ============================================================

/**
 * Normalize station data from official YouBike API to common schema
 * @param {Object} s - Raw station data from API
 * @returns {Object} Normalized station object
 */
function normalizeStation(s) {
    const cityKey = Object.keys(CITIES).find(key => CITIES[key].areaCode === s.area_code) || s.area_code;
    return {
        sno: s.station_no,
        sna: s.name_tw,
        snaen: s.name_en || s.name_tw,
        sarea: s.district_tw,
        sareaen: s.district_en || s.district_tw,
        ar: s.address_tw,
        aren: s.address_en || s.address_tw,
        latitude: parseFloat(s.lat),
        longitude: parseFloat(s.lng),
        available_rent_bikes: parseInt(s.available_spaces) || 0,
        available_return_bikes: parseInt(s.empty_spaces) || 0,
        ebikes: parseInt(s.available_spaces_detail?.eyb) || 0,
        totalDocks: parseInt(s.parking_spaces) || 0,
        status: s.status,
        city: cityKey,
        areaCode: s.area_code
    };
}

/**
 * Get marker type based on station availability
 * @param {Object} station - Station data
 * @returns {'ok' | 'empty' | 'full'} Marker type
 */
function getMarkerType(station) {
    if (station.status === 2) return 'suspended';
    if (station.available_rent_bikes === 0) return 'empty';
    if (station.available_return_bikes === 0) return 'full';
    return 'ok';
}

// ============================================================
// SCHEDULE/TIME UTILITIES
// ============================================================

/**
 * Format minutes since midnight to HH:MM string
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Formatted time string (e.g., "08:30")
 */
function formatTime(minutes) {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Get current time as minutes since midnight
 * @returns {number} Current minutes since midnight
 */
function getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

/**
 * Format countdown display for upcoming departures
 * @param {number} departureMinutes - Departure time in minutes since midnight
 * @param {boolean} [isZh=false] - Use Chinese labels
 * @returns {string} Formatted countdown string
 */
function getCountdown(departureMinutes, isZh = false) {
    const now = getCurrentMinutes();
    let diff = departureMinutes - now;
    if (diff < 0) diff += 24 * 60; // Handle next day

    if (diff < 1) return isZh ? '即將發車' : 'Departing';
    if (diff < 60) return `${diff} ${isZh ? '分鐘' : 'min'}`;

    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}${isZh ? '時' : 'h'} ${m}${isZh ? '分' : 'm'}`;
}

/**
 * Format duration in minutes to readable string
 * @param {number} minutes - Duration in minutes
 * @param {boolean} [isZh=false] - Use Chinese labels
 * @returns {string} Formatted duration string
 */
function formatDuration(minutes, isZh = false) {
    if (minutes < 60) {
        return `${minutes}${isZh ? '分鐘' : ' min'}`;
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) {
        return `${h}${isZh ? '小時' : 'h'}`;
    }
    return `${h}${isZh ? '時' : 'h'}${m}${isZh ? '分' : 'm'}`;
}

/**
 * Get localized text from an object with en/zh properties
 * @param {Object} obj - Object containing {en: string, zh: string}
 * @param {boolean} [isZh=false] - Return Chinese text
 * @returns {string} Localized text
 */
function getLocalizedText(obj, isZh = false) {
    if (!obj) return '';
    return isZh ? (obj.zh || obj.en || '') : (obj.en || obj.zh || '');
}

/**
 * Create a Leaflet divIcon marker
 * @param {Object} options - Marker options
 * @param {string} [options.content=''] - HTML content or text inside marker
 * @param {string} [options.bgColor='#4CAF50'] - Background color
 * @param {number} [options.size=28] - Marker size in pixels
 * @param {string} [options.className=''] - Additional CSS class
 * @returns {L.DivIcon} Leaflet divIcon instance
 */
function createMarkerIcon(options = {}) {
    const {
        content = '',
        bgColor = '#4CAF50',
        size = 28,
        className = ''
    } = options;

    return L.divIcon({
        className: '',
        html: `<div class="marker-icon ${className}" style="width:${size}px;height:${size}px;background-color:${bgColor};border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:${Math.floor(size * 0.4)}px;">${content}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2]
    });
}

// ============================================================
// NAVIGATION UTILITIES
// ============================================================

/**
 * Generate Google Maps navigation URL
 * @param {number} lat - Destination latitude
 * @param {number} lng - Destination longitude
 * @returns {string} Google Maps URL
 */
function getGoogleMapsUrl(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Generate Apple Maps navigation URL
 * @param {number} lat - Destination latitude
 * @param {number} lng - Destination longitude
 * @returns {string} Apple Maps URL
 */
function getAppleMapsUrl(lat, lng) {
    return `http://maps.apple.com/?daddr=${lat},${lng}`;
}

/**
 * Generate navigation links HTML
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {boolean} [isZh=false] - Use Chinese labels
 * @returns {string} HTML string with navigation buttons
 */
function getNavigationHtml(lat, lng, isZh = false) {
    const googleUrl = getGoogleMapsUrl(lat, lng);
    const appleUrl = getAppleMapsUrl(lat, lng);
    const btnStyle = 'display:inline-block;padding:4px 8px;margin:2px;background:#4CAF50;color:white;text-decoration:none;border-radius:4px;font-size:12px;';

    return `<div style="margin-top:8px;">
        <a href="${googleUrl}" target="_blank" style="${btnStyle}">${isZh ? 'Google導航' : 'Google Maps'}</a>
        <a href="${appleUrl}" target="_blank" style="${btnStyle}">${isZh ? 'Apple導航' : 'Apple Maps'}</a>
    </div>`;
}

// ============================================================
// GEOLOCATION UTILITIES
// ============================================================

/**
 * Get user's current position as a Promise
 * @param {Object} [options] - Geolocation options
 * @returns {Promise<{lat: number, lng: number}>} User location
 */
function getUserLocation(options = { timeout: 10000 }) {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => resolve({
                lat: position.coords.latitude,
                lng: position.coords.longitude
            }),
            reject,
            options
        );
    });
}

// ============================================================
// UI UTILITIES
// ============================================================

/**
 * Update navigation button text based on language
 * @param {string} lang - Language code ('en' or 'zh')
 */
function updateNavButtons(lang) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        const text = lang === 'zh' ? btn.dataset.zh : btn.dataset.en;
        if (text) btn.textContent = text;
    });
}

/**
 * Create a standard Leaflet map with OpenStreetMap tiles
 * @param {string} elementId - DOM element ID for the map
 * @param {Array<number>} center - [lat, lng] center coordinates
 * @param {number} [zoom=14] - Initial zoom level
 * @returns {L.Map} Leaflet map instance
 */
function createMap(elementId, center, zoom = 14) {
    const map = L.map(elementId).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);
    return map;
}

// ============================================================
// EXPORT FOR BROWSER USE
// ============================================================

// Export to window for browser use
window.YOUBIKE_API = YOUBIKE_API;
window.CITIES = CITIES;
window.YOUBIKE_FARES = YOUBIKE_FARES;
window.STORAGE_KEYS = STORAGE_KEYS;
window.detectLanguage = detectLanguage;
window.isChineseLocale = isChineseLocale;
window.saveLanguage = saveLanguage;
window.deg2rad = deg2rad;
window.getDistanceInMeters = getDistanceInMeters;
window.formatDistance = formatDistance;
window.normalizeStation = normalizeStation;
window.getMarkerType = getMarkerType;
window.formatTime = formatTime;
window.getCurrentMinutes = getCurrentMinutes;
window.getCountdown = getCountdown;
window.formatDuration = formatDuration;
window.getLocalizedText = getLocalizedText;
window.createMarkerIcon = createMarkerIcon;
window.getGoogleMapsUrl = getGoogleMapsUrl;
window.getAppleMapsUrl = getAppleMapsUrl;
window.getNavigationHtml = getNavigationHtml;
window.getUserLocation = getUserLocation;
window.updateNavButtons = updateNavButtons;
window.createMap = createMap;

// For environments that support modules (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        YOUBIKE_API,
        CITIES,
        YOUBIKE_FARES,
        STORAGE_KEYS,
        detectLanguage,
        isChineseLocale,
        saveLanguage,
        deg2rad,
        getDistanceInMeters,
        formatDistance,
        normalizeStation,
        getMarkerType,
        formatTime,
        getCurrentMinutes,
        getCountdown,
        formatDuration,
        getLocalizedText,
        createMarkerIcon,
        getGoogleMapsUrl,
        getAppleMapsUrl,
        getNavigationHtml,
        getUserLocation,
        updateNavButtons,
        createMap
    };
}
