'use strict';

/**
 * UBike Station Locator with Leaflet/OpenStreetMap
 * Supports multiple cities
 */

// City configurations
const CITIES = {
    taipei: {
        name: { en: 'Taipei', zh: '台北市' },
        api: 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json',
        center: [25.03304, 121.5656],
        normalize: (data) => data.map(s => ({
            sno: s.sno,
            sna: s.sna,
            snaen: s.snaen,
            sarea: s.sarea,
            sareaen: s.sareaen,
            ar: s.ar,
            aren: s.aren,
            latitude: parseFloat(s.latitude),
            longitude: parseFloat(s.longitude),
            available_rent_bikes: parseInt(s.available_rent_bikes) || 0,
            available_return_bikes: parseInt(s.available_return_bikes) || 0,
            city: 'taipei'
        }))
    },
    newtaipei: {
        name: { en: 'New Taipei', zh: '新北市' },
        api: 'https://data.ntpc.gov.tw/api/datasets/010e5b15-3823-4b20-b401-b1cf000550c5/json?size=2000',
        center: [25.0119, 121.4650],
        normalize: (data) => data.map(s => ({
            sno: s.sno,
            sna: s.sna,
            snaen: s.snaen,
            sarea: s.sarea,
            sareaen: s.sareaen,
            ar: s.ar,
            aren: s.aren,
            latitude: parseFloat(s.lat),
            longitude: parseFloat(s.lng),
            available_rent_bikes: parseInt(s.sbi_quantity) || 0,
            available_return_bikes: parseInt(s.bemp) || 0,
            city: 'newtaipei'
        }))
    }
};

const CONFIG = {
    DEFAULT_CENTER: [25.03304, 121.5656],
    DEFAULT_ZOOM: 14
};

// State
let map = null;
let stations = [];
let markers = {};
let selectedStation = null;
let currentCity = 'all';

function isChineseLocale() {
    const userLang = navigator.language || navigator.userLanguage;
    return userLang === 'zh-TW' || userLang === 'zh-CN';
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

async function fetchStations(cityKey) {
    const city = CITIES[cityKey];
    if (!city) throw new Error(`Unknown city: ${cityKey}`);

    console.log(`[UBike] Fetching ${cityKey} stations...`);
    const response = await fetch(city.api);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const normalized = city.normalize(data);
    console.log(`[UBike] Loaded ${normalized.length} stations from ${cityKey}`);
    return normalized;
}

async function fetchAllStations() {
    const results = await Promise.allSettled([
        fetchStations('taipei'),
        fetchStations('newtaipei')
    ]);

    const allStations = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            allStations.push(...result.value);
        } else {
            console.error(`[UBike] Failed to load city:`, result.reason);
        }
    });

    return allStations;
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

    // Restore preferences
    const savedCity = localStorage.getItem('ubike-city');
    if (savedCity && (CITIES[savedCity] || savedCity === 'all')) {
        currentCity = savedCity;
        document.getElementById('city-select').value = currentCity;
    }

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
    searchInput.addEventListener('input', handleSearch);
    searchInput.placeholder = isChineseLocale() ? '搜尋站點...' : 'Search stations...';

    console.log('[UBike] Station locator initialized successfully');
}

document.addEventListener('DOMContentLoaded', initStoreLocator);
