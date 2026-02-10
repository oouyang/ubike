'use strict';

/**
 * YouBike Unified Page - Map & List Views
 * Uses YOUBIKE_API, CITIES, normalizeStation, getMarkerType from common.js
 */

// ============================================================
// LABELS
// ============================================================

const LABELS = {
  en: {
    title: 'YouBike',
    loading: 'Loading...',
    error: 'Error loading stations',
    showing: 'Showing',
    stations: 'stations',
    searchPlaceholder: 'Search stations...',
    bikes: 'Bikes',
    slots: 'Slots',
    location: 'Location',
    distance: 'Distance'
  },
  zh: {
    title: '微笑單車',
    loading: '載入中...',
    error: '載入失敗',
    showing: '顯示',
    stations: '個站點',
    searchPlaceholder: '搜尋站點...',
    bikes: '可借車輛',
    slots: '可停空位',
    location: '站點位置',
    distance: '距離'
  }
};

// ============================================================
// STATE
// ============================================================

let map = null;
let markers = [];
let stationsData = [];
let allStationsCache = [];
let currentCity = 'taipei';
let isZh = detectLanguage() === 'zh';
let userLocation = null;
let refreshTimer = null;
let routePath = null;
let routeCoords = [];
let bottomSheet = null;

const CONFIG = {
  REFRESH_INTERVAL: 5 * 60 * 1000,
  DEFAULT_ZOOM: 14
};

// ============================================================
// BOTTOM SHEET SUMMARY
// ============================================================

function updateSheetSummary() {
  const summaryEl = document.getElementById('sheet-summary');
  if (!summaryEl) return;

  const cityName = currentCity === 'all'
    ? (isZh ? '全台' : 'All')
    : (CITIES[currentCity]?.name[isZh ? 'zh' : 'en'] || currentCity);

  const stationCount = stationsData.length;
  const totalBikes = stationsData.reduce((sum, s) => sum + (s.available_rent_bikes || 0), 0);

  if (isZh) {
    summaryEl.textContent = `🚲 ${cityName} · ${stationCount} 站 · ${totalBikes.toLocaleString()} 車`;
  } else {
    summaryEl.textContent = `🚲 ${cityName} · ${stationCount} stations · ${totalBikes.toLocaleString()} bikes`;
  }
}

// ============================================================
// LANGUAGE
// ============================================================

function toggleLang() {
  isZh = !isZh;
  saveLanguage(isZh ? 'zh' : 'en');
  updateUI();
  updateStationList(stationsData);
  updatePopups();
  updateSheetSummary();
}

function updateUI() {
  const L = LABELS[isZh ? 'zh' : 'en'];

  // Update page title
  document.getElementById('page-title').textContent = L.title;
  document.title = L.title;

  // Update loading text
  document.getElementById('loading').textContent = L.loading;

  // Update search placeholder
  document.getElementById('search-input').placeholder = L.searchPlaceholder;


  // Update navigation buttons
  updateNavButtons(isZh ? 'zh' : 'en');

  // Update city selector
  updateCitySelector();

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

function updateCitySelector() {
  const select = document.getElementById('city-select');
  if (!select) return;
  Array.from(select.options).forEach(option => {
    if (option.value === 'all') {
      option.textContent = isZh ? '所有城市' : 'All Cities';
    } else {
      const city = CITIES[option.value];
      if (city) {
        option.textContent = isZh ? city.name.zh : city.name.en;
      }
    }
  });
}

// ============================================================
// DATA FETCHING
// ============================================================

async function fetchAllStationsFromAPI() {
  console.log('[UBike] Fetching all stations from official API...');
  const response = await fetch(YOUBIKE_API);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  const normalized = data
    .filter(s => s.status === 1)
    .map(normalizeStation);
  console.log(`[UBike] Loaded ${normalized.length} stations from official API`);
  return normalized;
}

async function fetchStations() {
  if (allStationsCache.length === 0) {
    allStationsCache = await fetchAllStationsFromAPI();
  }

  if (currentCity === 'all') {
    return allStationsCache;
  }

  const city = CITIES[currentCity];
  if (!city) throw new Error(`Unknown city: ${currentCity}`);

  const filtered = allStationsCache.filter(s => s.areaCode === city.areaCode);
  console.log(`[UBike] Filtered ${filtered.length} stations for ${currentCity}`);
  return filtered;
}

async function loadStations() {
  showLoading(true);
  try {
    stationsData = await fetchStations();

    // Add distance if user location is known
    if (userLocation) {
      addDistanceToStations();
    }

    // Update map and list
    updateMarkers(stationsData);
    updateStationList(stationsData);
    updateSheetSummary();

    console.log(`[UBike] Loaded ${stationsData.length} stations`);
  } catch (error) {
    console.error('[UBike] Failed to load stations:', error.message);
    const L = LABELS[isZh ? 'zh' : 'en'];
    document.getElementById('result-count').textContent = `${L.error}: ${error.message}`;
  }
  showLoading(false);
}

// ============================================================
// MAP FUNCTIONS
// ============================================================

function initMap() {
  const center = CITIES[currentCity]?.center || CITIES.taipei.center;
  map = L.map('map-canvas').setView(center, CONFIG.DEFAULT_ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);
}

function createMarkerIconSimple(type) {
  const colorClass = { ok: 'marker-ok', empty: 'marker-empty', full: 'marker-full' }[type];
  return L.divIcon({
    className: '',
    html: `<div class="marker-icon ${colorClass}" style="width:12px;height:12px;"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6]
  });
}

function getPopupContent(station) {
  const bikes = station.available_rent_bikes;
  const slots = station.available_return_bikes;
  const cityName = CITIES[station.city]?.name[isZh ? 'zh' : 'en'] || station.city;
  const L = LABELS[isZh ? 'zh' : 'en'];

  let distanceHtml = '';
  if (station.distance !== undefined) {
    distanceHtml = `<br><strong>${L.distance}:</strong> ${formatDistance(station.distance, isZh)}`;
  }

  const navHtml = getNavigationHtml(station.latitude, station.longitude, isZh);

  if (isZh) {
    return `<div>
      <strong>${station.sna}</strong><br>
      <small>${cityName}</small><br>
      ${L.location}: ${station.ar}<br>
      ${L.bikes}: ${bikes} 輛<br>
      ${L.slots}: ${slots} 輛${distanceHtml}
      ${navHtml}
    </div>`;
  }
  return `<div>
    <strong>${station.snaen || station.sna}</strong><br>
    <small>${cityName}</small><br>
    ${L.location}: ${station.aren || station.ar}<br>
    ${L.bikes}: ${bikes}<br>
    ${L.slots}: ${slots}${distanceHtml}
    ${navHtml}
  </div>`;
}

function clearMarkers() {
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
}

function updateMarkers(stations) {
  if (!map) return;
  console.log(`[UBike] Updating ${stations.length} markers`);
  clearMarkers();

  stations.filter(s => s.latitude && s.longitude).forEach(station => {
    const marker = L.marker([station.latitude, station.longitude], {
      icon: createMarkerIconSimple(getMarkerType(station))
    });
    marker.bindPopup(getPopupContent(station));
    marker.stationId = station.sno;
    marker.addTo(map);
    markers.push(marker);
  });
}

function updatePopups() {
  if (!map || markers.length === 0) return;
  markers.forEach(marker => {
    const station = stationsData.find(s => s.sno === marker.stationId);
    if (station) {
      marker.setPopupContent(getPopupContent(station));
    }
  });
}

function selectStation(sno) {
  const station = stationsData.find(s => s.sno === sno);
  if (!station || !map) return;

  // Pan to station
  map.setView([station.latitude, station.longitude], 17);

  // Open popup
  const marker = markers.find(m => m.stationId === sno);
  if (marker) {
    marker.openPopup();
  }

  // Highlight in list
  document.querySelectorAll('.station-item').forEach(item => {
    item.classList.toggle('selected', item.dataset.sno === sno);
  });
}

// ============================================================
// AUTO-REFRESH
// ============================================================

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setTimeout(async () => {
    console.log('[UBike] Auto-refresh triggered');
    allStationsCache = []; // Clear cache to get fresh data
    await loadStations();
    startAutoRefresh();
  }, CONFIG.REFRESH_INTERVAL);
  console.log(`[UBike] Next refresh in ${CONFIG.REFRESH_INTERVAL / 1000}s`);
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// ============================================================
// SEARCH PANEL
// ============================================================

function updateStationList(stations) {
  const L = LABELS[isZh ? 'zh' : 'en'];
  const list = document.getElementById('station-list');
  const countEl = document.getElementById('result-count');

  countEl.textContent = `${L.showing} ${stations.length} ${L.stations}`;

  list.innerHTML = stations.slice(0, 100).map(station => {
    const name = isZh ? station.sna : station.snaen;
    const address = isZh ? station.ar : station.aren;
    const bikes = station.available_rent_bikes;
    const slots = station.available_return_bikes;
    const bikesClass = bikes === 0 ? 'no-bikes' : 'bikes';
    const slotsClass = slots === 0 ? 'no-slots' : 'slots';

    let distanceHtml = '';
    if (station.distance !== undefined) {
      distanceHtml = ` | ${formatDistance(station.distance, isZh)}`;
    }

    return `<li class="station-item" data-sno="${station.sno}" onclick="selectStation('${station.sno}')">
      <div class="station-name">${name}</div>
      <div class="station-address">${address}</div>
      <div class="station-info">
        <span class="${bikesClass}">${L.bikes}: ${bikes}</span> |
        <span class="${slotsClass}">${L.slots}: ${slots}</span>${distanceHtml}
      </div>
    </li>`;
  }).join('');
}

function filterStations(query) {
  if (!query) {
    updateStationList(stationsData);
    updateMarkers(stationsData);
    return;
  }

  const q = query.toLowerCase();
  const filtered = stationsData.filter(s =>
    s.sna.toLowerCase().includes(q) ||
    s.snaen.toLowerCase().includes(q) ||
    s.ar.toLowerCase().includes(q) ||
    s.aren.toLowerCase().includes(q) ||
    s.sarea.toLowerCase().includes(q) ||
    s.sareaen.toLowerCase().includes(q)
  );

  updateStationList(filtered);
  updateMarkers(filtered);
}


// ============================================================
// CITY CHANGE
// ============================================================

function changeCity() {
  const select = document.getElementById('city-select');
  currentCity = select.value;

  localStorage.setItem('ubike-city', currentCity);
  console.log(`[UBike] City changed to: ${currentCity}`);

  // Pan to city center
  if (currentCity !== 'all' && CITIES[currentCity] && map) {
    map.setView(CITIES[currentCity].center, CONFIG.DEFAULT_ZOOM);
  }

  // Clear cache and reload
  allStationsCache = [];
  loadStations();
}

// ============================================================
// GEOLOCATION
// ============================================================

function addDistanceToStations() {
  if (!userLocation) return;

  stationsData.forEach(station => {
    station.distance = getDistanceInMeters(
      userLocation.lat, userLocation.lng,
      station.latitude, station.longitude
    );
  });
}

function initGeolocationTracking() {
  if (!('geolocation' in navigator)) return;

  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      userLocation = { lat: latitude, lng: longitude };

      // Update route tracking
      routeCoords.push([latitude, longitude]);
      if (map) {
        if (routePath) map.removeLayer(routePath);
        routePath = L.polyline(routeCoords, {
          color: '#0000FF', weight: 2, opacity: 1.0
        }).addTo(map);
      }

      // Update distances
      if (stationsData.length > 0) {
        addDistanceToStations();
        updateStationList(stationsData);
        updatePopups();
      }
    },
    (error) => console.warn('[UBike] Geolocation error:', error.message),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 2000 }
  );
}

// ============================================================
// LOCATE USER
// ============================================================

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

    userLocation = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    if (map) {
      map.setView([userLocation.lat, userLocation.lng], 16);
    }

    // Update distances
    if (stationsData.length > 0) {
      addDistanceToStations();
      updateStationList(stationsData);
      updatePopups();
    }

    console.log('[UBike] Centered to user location:', userLocation);
  } catch (error) {
    console.warn('[UBike] Could not get location:', error.code, error.message);
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

// ============================================================
// LOADING INDICATOR
// ============================================================

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
  console.log('[UBike] Initializing...');

  // Restore saved language
  const savedLang = localStorage.getItem(STORAGE_KEYS.LANG);
  if (savedLang) {
    isZh = savedLang === 'zh';
  }
  updateUI();

  // Restore saved city
  const savedCity = localStorage.getItem(STORAGE_KEYS.CITY);
  if (savedCity && (CITIES[savedCity] || savedCity === 'all')) {
    currentCity = savedCity;
  }
  const citySelect = document.getElementById('city-select');
  if (citySelect) citySelect.value = currentCity;

  // Try to get user location first
  try {
    const location = await getUserLocation({ timeout: 5000 });
    userLocation = location;
    console.log(`[UBike] User location: ${userLocation.lat}, ${userLocation.lng}`);
  } catch (error) {
    console.warn('[UBike] Could not get user location');
  }

  // Initialize map
  initMap();
  if (userLocation) {
    map.setView([userLocation.lat, userLocation.lng], CONFIG.DEFAULT_ZOOM);
  }

  // Load stations
  await loadStations();

  // Start geolocation tracking
  initGeolocationTracking();

  // Start auto-refresh
  startAutoRefresh();

  // Setup search
  document.getElementById('search-input').addEventListener('input', (e) => {
    filterStations(e.target.value);
  });

  // Initialize bottom sheet (mobile only)
  const panel = document.getElementById('panel');
  if (panel && typeof BottomSheet !== 'undefined') {
    bottomSheet = new BottomSheet(panel, {
      initialSnap: 'collapsed',
      onSnapChange: (snap) => {
        console.log('[UBike] Sheet snap:', snap);
      }
    });
  }

  console.log('[UBike] Initialization complete');
}

// Start when DOM is ready and Leaflet is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (typeof L !== 'undefined') {
    init();
  } else {
    // Wait for Leaflet to load
    const checkLeaflet = setInterval(() => {
      if (typeof L !== 'undefined') {
        clearInterval(checkLeaflet);
        init();
      }
    }, 100);
    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkLeaflet);
      if (typeof L === 'undefined') {
        console.error('[UBike] Leaflet failed to load');
      }
    }, 10000);
  }
});

// Make functions available globally for onclick handlers
window.toggleLang = toggleLang;
window.changeCity = changeCity;
window.selectStation = selectStation;
window.centerToUserLocation = centerToUserLocation;
