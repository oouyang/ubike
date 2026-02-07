'use strict';

/**
 * UBike Station Locator with Leaflet/OpenStreetMap
 */

const UBIKE_CONFIG = {
    API_URL: 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json',
    DEFAULT_CENTER: [25.03304, 121.5656],
    DEFAULT_ZOOM: 14
};

// State
let map = null;
let stations = [];
let markers = {};
let selectedStation = null;

/**
 * Check if user's locale is Chinese
 */
function isChineseLocale() {
    const userLang = navigator.language || navigator.userLanguage;
    return userLang === 'zh-TW' || userLang === 'zh-CN';
}

/**
 * Create custom marker icon
 */
function createMarkerIcon(type) {
    const colorClass = {
        ok: 'marker-ok',
        empty: 'marker-empty',
        full: 'marker-full'
    }[type];

    return L.divIcon({
        className: '',
        html: `<div class="marker-icon ${colorClass}" style="width:12px;height:12px;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -6]
    });
}

/**
 * Get marker type based on availability
 */
function getMarkerType(station) {
    if (station.available_rent_bikes === 0) return 'empty';
    if (station.available_return_bikes === 0) return 'full';
    return 'ok';
}

/**
 * Fetch station data from API
 */
async function fetchStations() {
    console.log('[UBike] Fetching station data...');
    const response = await fetch(UBIKE_CONFIG.API_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`[UBike] Loaded ${data.length} stations`);
    return data;
}

/**
 * Get station display name based on locale
 */
function getStationName(station) {
    return isChineseLocale() ? station.sna : station.snaen;
}

/**
 * Get station address based on locale
 */
function getStationAddress(station) {
    return isChineseLocale()
        ? `${station.sarea} ${station.ar}`
        : `${station.sareaen} ${station.aren}`;
}

/**
 * Create popup content for marker
 */
function getPopupContent(station) {
    const bikes = station.available_rent_bikes;
    const slots = station.available_return_bikes;
    const isZh = isChineseLocale();

    return `<div>
        <strong>${getStationName(station)}</strong><br>
        ${getStationAddress(station)}<br>
        ${isZh ? '可借' : 'Bikes'}: ${bikes} | ${isZh ? '可停' : 'Slots'}: ${slots}
    </div>`;
}

/**
 * Create station list item HTML
 */
function createStationListItem(station) {
    const bikes = station.available_rent_bikes;
    const slots = station.available_return_bikes;
    const bikesClass = bikes === 0 ? 'no-bikes' : 'bikes';
    const slotsClass = slots === 0 ? 'no-slots' : 'slots';
    const isZh = isChineseLocale();

    return `
        <li class="station-item" data-sno="${station.sno}">
            <div class="station-name">${getStationName(station)}</div>
            <div class="station-address">${getStationAddress(station)}</div>
            <div class="station-info">
                <span class="${bikesClass}">${isZh ? '可借' : 'Bikes'}: ${bikes}</span> |
                <span class="${slotsClass}">${isZh ? '可停' : 'Slots'}: ${slots}</span>
            </div>
        </li>
    `;
}

/**
 * Add markers to map
 */
function addMarkers(stationList) {
    // Clear existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    stationList.forEach(station => {
        const marker = L.marker([station.latitude, station.longitude], {
            icon: createMarkerIcon(getMarkerType(station))
        });

        marker.bindPopup(getPopupContent(station));
        marker.on('click', () => selectStation(station.sno));
        marker.addTo(map);
        markers[station.sno] = marker;
    });
}

/**
 * Render station list
 */
function renderStationList(stationList) {
    const listEl = document.getElementById('station-list');
    const countEl = document.getElementById('result-count');
    const isZh = isChineseLocale();

    listEl.innerHTML = stationList.map(createStationListItem).join('');
    countEl.textContent = isZh
        ? `顯示 ${stationList.length} 個站點`
        : `Showing ${stationList.length} stations`;

    // Add click handlers
    listEl.querySelectorAll('.station-item').forEach(item => {
        item.addEventListener('click', () => {
            selectStation(item.dataset.sno);
        });
    });
}

/**
 * Select a station
 */
function selectStation(sno) {
    // Remove previous selection
    document.querySelectorAll('.station-item.selected').forEach(el => {
        el.classList.remove('selected');
    });

    // Find and highlight the station
    const listItem = document.querySelector(`.station-item[data-sno="${sno}"]`);
    if (listItem) {
        listItem.classList.add('selected');
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Pan to marker and open popup
    const marker = markers[sno];
    if (marker) {
        map.setView(marker.getLatLng(), 17);
        marker.openPopup();
    }

    selectedStation = sno;
    console.log(`[UBike] Selected station: ${sno}`);
}

/**
 * Filter stations by search query
 */
function filterStations(query) {
    query = query.toLowerCase().trim();

    if (!query) {
        return stations;
    }

    return stations.filter(station => {
        const name = getStationName(station).toLowerCase();
        const address = getStationAddress(station).toLowerCase();
        return name.includes(query) || address.includes(query);
    });
}

/**
 * Handle search input
 */
function handleSearch(e) {
    const query = e.target.value;
    const filtered = filterStations(query);

    renderStationList(filtered);
    addMarkers(filtered);

    console.log(`[UBike] Search: "${query}" - ${filtered.length} results`);
}

/**
 * Initialize the application
 */
async function initStoreLocator() {
    console.log('[UBike] Initializing station locator...');

    try {
        // Load stations
        stations = await fetchStations();

        if (stations.length === 0) {
            throw new Error('No stations loaded');
        }

        // Create map with OpenStreetMap
        map = L.map('map-canvas').setView(UBIKE_CONFIG.DEFAULT_CENTER, UBIKE_CONFIG.DEFAULT_ZOOM);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map);

        // Render initial data
        renderStationList(stations);
        addMarkers(stations);

        // Setup search
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', handleSearch);
        searchInput.placeholder = isChineseLocale() ? '搜尋站點...' : 'Search stations...';

        console.log('[UBike] Station locator initialized successfully');

    } catch (error) {
        console.error('[UBike] Failed to initialize:', error.message);
        document.getElementById('station-list').innerHTML = `
            <li class="station-item" style="color: red;">
                ${isChineseLocale() ? '載入失敗' : 'Failed to load'}: ${error.message}
            </li>
        `;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initStoreLocator);
