'use strict';

/**
 * UBike Station Locator with Leaflet/OpenStreetMap
 * Supports all Taiwan cities via official YouBike API
 */

// Official YouBike API - covers all cities
const YOUBIKE_API = 'https://apis.youbike.com.tw/json/station-yb2.json';

// City configurations with area codes from official API
const CITIES = {
    taipei: {
        name: { en: 'Taipei', zh: '台北市' },
        areaCode: '00',
        center: [25.0330, 121.5654]
    },
    newtaipei: {
        name: { en: 'New Taipei', zh: '新北市' },
        areaCode: '05',
        center: [25.0119, 121.4650]
    },
    taoyuan: {
        name: { en: 'Taoyuan', zh: '桃園市' },
        areaCode: '07',
        center: [24.9936, 121.3010]
    },
    hsinchu: {
        name: { en: 'Hsinchu City', zh: '新竹市' },
        areaCode: '09',
        center: [24.8138, 120.9675]
    },
    hsinchuCounty: {
        name: { en: 'Hsinchu County', zh: '新竹縣' },
        areaCode: '0B',
        center: [24.8387, 121.0178]
    },
    miaoli: {
        name: { en: 'Miaoli', zh: '苗栗縣' },
        areaCode: '0A',
        center: [24.5602, 120.8214]
    },
    taichung: {
        name: { en: 'Taichung', zh: '台中市' },
        areaCode: '01',
        center: [24.1477, 120.6736]
    },
    chiayi: {
        name: { en: 'Chiayi City', zh: '嘉義市' },
        areaCode: '08',
        center: [23.4800, 120.4491]
    },
    chiayiCounty: {
        name: { en: 'Chiayi County', zh: '嘉義縣' },
        areaCode: '11',
        center: [23.4518, 120.2555]
    },
    tainan: {
        name: { en: 'Tainan', zh: '台南市' },
        areaCode: '13',
        center: [22.9998, 120.2270]
    },
    kaohsiung: {
        name: { en: 'Kaohsiung', zh: '高雄市' },
        areaCode: '12',
        center: [22.6273, 120.3014]
    },
    pingtung: {
        name: { en: 'Pingtung', zh: '屏東縣' },
        areaCode: '14',
        center: [22.6762, 120.4929]
    },
    taitung: {
        name: { en: 'Taitung', zh: '台東縣' },
        areaCode: '15',
        center: [22.7583, 121.1444]
    }
};

const CONFIG = {
    DEFAULT_CENTER: [25.0330, 121.5654],
    DEFAULT_ZOOM: 14
};

// State
let map = null;
let allStationsCache = [];
let stations = [];
let markers = {};
let selectedStation = null;
let currentCity = 'all';
let isZh = (navigator.language || navigator.userLanguage).startsWith('zh');

function isChineseLocale() {
    return isZh;
}

function toggleLang() {
    isZh = !isZh;
    localStorage.setItem('ubike-lang', isZh ? 'zh' : 'en');
    updateUI();
}

function updateUI() {
    // Update search placeholder
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.placeholder = isZh ? '搜尋站點...' : 'Search stations...';
    }

    // Update city selector options
    const cityOptions = {
        all: { en: 'All Cities', zh: '全部' },
        taipei: { en: 'Taipei', zh: '台北市' },
        newtaipei: { en: 'New Taipei', zh: '新北市' },
        taoyuan: { en: 'Taoyuan', zh: '桃園市' },
        hsinchu: { en: 'Hsinchu City', zh: '新竹市' },
        hsinchuCounty: { en: 'Hsinchu County', zh: '新竹縣' },
        miaoli: { en: 'Miaoli', zh: '苗栗縣' },
        taichung: { en: 'Taichung', zh: '台中市' },
        chiayi: { en: 'Chiayi City', zh: '嘉義市' },
        chiayiCounty: { en: 'Chiayi County', zh: '嘉義縣' },
        tainan: { en: 'Tainan', zh: '台南市' },
        kaohsiung: { en: 'Kaohsiung', zh: '高雄市' },
        pingtung: { en: 'Pingtung', zh: '屏東縣' },
        taitung: { en: 'Taitung', zh: '台東縣' }
    };

    const select = document.getElementById('city-select');
    if (select) {
        Array.from(select.options).forEach(option => {
            const city = cityOptions[option.value];
            if (city) {
                option.textContent = isZh ? city.zh : city.en;
            }
        });
    }

    // Re-render station list and update popups
    if (stations.length > 0) {
        renderStationList(filterStations(document.getElementById('search-input')?.value || ''));
        // Update popup content for all markers
        Object.keys(markers).forEach(key => {
            const [city, sno] = key.split('-');
            const station = stations.find(s => s.sno === sno && s.city === city);
            if (station && markers[key]) {
                markers[key].setPopupContent(getPopupContent(station));
            }
        });
    }
}

function createMarkerIcon(type) {
    const colorClass = { ok: 'marker-ok', empty: 'marker-empty', full: 'marker-full' }[type];
    return L.divIcon({
        className: '',
        html: `<div class="marker-icon ${colorClass}" style="width:12px;height:12px;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -6]
    });
}

function getMarkerType(station) {
    if (station.available_rent_bikes === 0) return 'empty';
    if (station.available_return_bikes === 0) return 'full';
    return 'ok';
}

// Normalize station data from official YouBike API
function normalizeStation(s) {
    // Find city key by area code
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
        city: cityKey,
        areaCode: s.area_code
    };
}

async function fetchAllStationsFromAPI() {
    console.log('[UBike] Fetching all stations from official API...');
    const response = await fetch(YOUBIKE_API);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const normalized = data
        .filter(s => s.status === 1) // Only active stations
        .map(normalizeStation);
    console.log(`[UBike] Loaded ${normalized.length} stations from official API`);
    return normalized;
}

async function fetchStations(cityKey) {
    // Fetch all stations if not cached
    if (allStationsCache.length === 0) {
        allStationsCache = await fetchAllStationsFromAPI();
    }

    const city = CITIES[cityKey];
    if (!city) throw new Error(`Unknown city: ${cityKey}`);

    const filtered = allStationsCache.filter(s => s.areaCode === city.areaCode);
    console.log(`[UBike] Filtered ${filtered.length} stations for ${cityKey}`);
    return filtered;
}

async function fetchAllStations() {
    // Fetch all stations if not cached
    if (allStationsCache.length === 0) {
        allStationsCache = await fetchAllStationsFromAPI();
    }
    return allStationsCache;
}

function getStationName(station) {
    return isChineseLocale() ? station.sna : (station.snaen || station.sna);
}

function getStationAddress(station) {
    return isChineseLocale()
        ? `${station.sarea} ${station.ar}`
        : `${station.sareaen || station.sarea} ${station.aren || station.ar}`;
}

function getCityName(cityKey) {
    const city = CITIES[cityKey];
    return city ? city.name[isChineseLocale() ? 'zh' : 'en'] : cityKey;
}

function getPopupContent(station) {
    const bikes = station.available_rent_bikes;
    const slots = station.available_return_bikes;
    const isZh = isChineseLocale();

    return `<div>
        <strong>${getStationName(station)}</strong><br>
        <small>${getCityName(station.city)}</small><br>
        ${getStationAddress(station)}<br>
        ${isZh ? '可借' : 'Bikes'}: ${bikes} | ${isZh ? '可停' : 'Slots'}: ${slots}
    </div>`;
}

function createStationListItem(station) {
    const bikes = station.available_rent_bikes;
    const slots = station.available_return_bikes;
    const bikesClass = bikes === 0 ? 'no-bikes' : 'bikes';
    const slotsClass = slots === 0 ? 'no-slots' : 'slots';
    const isZh = isChineseLocale();

    return `
        <li class="station-item" data-sno="${station.sno}" data-city="${station.city}">
            <div class="station-name">${getStationName(station)}</div>
            <div class="station-address">${getCityName(station.city)} - ${getStationAddress(station)}</div>
            <div class="station-info">
                <span class="${bikesClass}">${isZh ? '可借' : 'Bikes'}: ${bikes}</span> |
                <span class="${slotsClass}">${isZh ? '可停' : 'Slots'}: ${slots}</span>
            </div>
        </li>
    `;
}

function addMarkers(stationList) {
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    stationList.forEach(station => {
        if (!station.latitude || !station.longitude) return;
        const marker = L.marker([station.latitude, station.longitude], {
            icon: createMarkerIcon(getMarkerType(station))
        });

        marker.bindPopup(getPopupContent(station));
        marker.on('click', () => selectStation(station.sno, station.city));
        marker.addTo(map);
        markers[`${station.city}-${station.sno}`] = marker;
    });
}

function renderStationList(stationList) {
    const listEl = document.getElementById('station-list');
    const countEl = document.getElementById('result-count');
    const isZh = isChineseLocale();

    listEl.innerHTML = stationList.map(createStationListItem).join('');
    countEl.textContent = isZh
        ? `顯示 ${stationList.length} 個站點`
        : `Showing ${stationList.length} stations`;

    listEl.querySelectorAll('.station-item').forEach(item => {
        item.addEventListener('click', () => {
            selectStation(item.dataset.sno, item.dataset.city);
        });
    });
}

function selectStation(sno, city) {
    document.querySelectorAll('.station-item.selected').forEach(el => {
        el.classList.remove('selected');
    });

    const listItem = document.querySelector(`.station-item[data-sno="${sno}"][data-city="${city}"]`);
    if (listItem) {
        listItem.classList.add('selected');
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const marker = markers[`${city}-${sno}`];
    if (marker) {
        map.setView(marker.getLatLng(), 17);
        marker.openPopup();
    }

    selectedStation = { sno, city };
    console.log(`[UBike] Selected station: ${city}-${sno}`);
}

function filterStations(query) {
    query = query.toLowerCase().trim();
    if (!query) return stations;

    return stations.filter(station => {
        const name = getStationName(station).toLowerCase();
        const address = getStationAddress(station).toLowerCase();
        return name.includes(query) || address.includes(query);
    });
}

function handleSearch(e) {
    const query = e.target.value;
    const filtered = filterStations(query);

    renderStationList(filtered);
    addMarkers(filtered);

    console.log(`[UBike] Search: "${query}" - ${filtered.length} results`);
}

async function changeCity() {
    const select = document.getElementById('city-select');
    currentCity = select.value;
    localStorage.setItem('ubike-city', currentCity);
    console.log(`[UBike] City changed to: ${currentCity}`);

    await loadStations();

    if (currentCity !== 'all' && CITIES[currentCity]) {
        map.setView(CITIES[currentCity].center, CONFIG.DEFAULT_ZOOM);
    }
}

async function loadStations() {
    const isZh = isChineseLocale();
    document.getElementById('station-list').innerHTML = `<li class="station-item">${isZh ? '載入中...' : 'Loading...'}</li>`;

    try {
        if (currentCity === 'all') {
            stations = await fetchAllStations();
        } else {
            stations = await fetchStations(currentCity);
        }

        renderStationList(stations);
        addMarkers(stations);
    } catch (error) {
        console.error('[UBike] Failed to load:', error.message);
        document.getElementById('station-list').innerHTML = `
            <li class="station-item" style="color: red;">
                ${isChineseLocale() ? '載入失敗' : 'Failed to load'}: ${error.message}
            </li>
        `;
    }
}

async function initStoreLocator() {
    console.log('[UBike] Initializing station locator...');

    // Restore language preference
    const savedLang = localStorage.getItem('ubike-lang');
    if (savedLang) {
        isZh = savedLang === 'zh';
    }

    // Restore city preference
    const savedCity = localStorage.getItem('ubike-city');
    if (savedCity && (CITIES[savedCity] || savedCity === 'all')) {
        currentCity = savedCity;
        const select = document.getElementById('city-select');
        if (select) select.value = currentCity;
    }

    // Update UI with language
    updateUI();

    // Create map
    const center = CITIES[currentCity]?.center || CONFIG.DEFAULT_CENTER;
    map = L.map('map-canvas').setView(center, CONFIG.DEFAULT_ZOOM);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // Load stations
    await loadStations();

    // Setup search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    console.log('[UBike] Station locator initialized successfully');
}

document.addEventListener('DOMContentLoaded', initStoreLocator);
