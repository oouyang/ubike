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
    distance: 'Distance',
    suspended: 'Suspended',
    ebikes: '2.0E',
    allDistricts: 'All',
    free30: 'Free first 30 min',
    noFree30: 'No free period',
    per30min: '/30 min',
    tpassLabel: 'TPASS',
    noTpass: 'Not available',
    rateLink: 'Official rates',
    selectCityForFare: 'Select a city to view fare info',
    fareTime: 'Duration',
    fareRate: 'Rate',
    ebikeFilterLabel: '⚡ E-bikes only',
    ebikeRangeTitle: '🔋 Range Reference',
    rangeFlat: '🛤️ Flat terrain',
    rangeHilly: '⛰️ Hilly terrain',
    rangeCold: '🌡️ Cold weather (<10°C)',
    rangeOfficial: '📋 Official max (ideal)',
    rangeKm: 'km',
    nearbyEbikes: 'e-bike stations within 500m',
    reportBtn: '⚠️ Report',
    reportTitle: 'Report Issue',
    reportStation: 'Station',
    reportSelectIssue: 'Issue Type',
    reportNotes: 'Notes (optional)',
    reportYourContact: 'Your Contact',
    reportEmailPlaceholder: 'Email *',
    reportPhonePlaceholder: 'Phone',
    reportActionForm: 'Open Official Form',
    reportActionFormDesc: 'Copy report & open YouBike form',
    reportActionAutoFill: 'Auto-fill Form',
    reportActionAutoFillDesc: 'Copy fill script & open form',
    reportAutoFillHint: 'Auto-fill script copied! On the YouBike page: press F12 → Console → Ctrl+V → Enter',
    reportActionCall: 'Call Hotline',
    reportActionEmail: 'Send Email',
    reportCopied: 'Report copied to clipboard!',
    reportIssueRequired: 'Please select an issue type',
    reportEmailRequired: 'Please enter a valid email',
    reportNotesPlaceholder: 'Describe the issue...',
    reportSubject: 'YouBike Issue Report',
    faultFlatTire: 'Flat tire',
    faultBrokenSeat: 'Broken seat',
    faultBrakeIssue: 'Brake issue',
    faultChainProblem: 'Chain problem',
    faultOtherBike: 'Other bike issue',
    faultBrokenDock: 'Broken dock',
    faultCannotLock: 'Cannot lock',
    faultCannotUnlock: 'Cannot unlock',
    faultStationFull: 'Station full',
    faultNoBikes: 'No bikes',
    faultOther: 'Other'
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
    distance: '距離',
    suspended: '暫停營運',
    ebikes: '2.0E',
    allDistricts: '全部',
    free30: '前30分鐘免費',
    noFree30: '無免費時段',
    per30min: '/30分鐘',
    tpassLabel: 'TPASS',
    noTpass: '不適用',
    rateLink: '官方費率',
    selectCityForFare: '請選擇城市以查看費率',
    fareTime: '時段',
    fareRate: '費率',
    ebikeFilterLabel: '⚡ 僅顯示電輔車',
    ebikeRangeTitle: '🔋 續航參考',
    rangeFlat: '🛤️ 平坦路面',
    rangeHilly: '⛰️ 山坡地形',
    rangeCold: '🌡️ 低溫天氣 (<10°C)',
    rangeOfficial: '📋 官方最大值 (理想)',
    rangeKm: '公里',
    nearbyEbikes: '500m內有電輔車的站點',
    reportBtn: '⚠️ 回報問題',
    reportTitle: '問題回報',
    reportStation: '站點',
    reportSelectIssue: '問題類型',
    reportNotes: '備註（選填）',
    reportYourContact: '聯絡資訊',
    reportEmailPlaceholder: 'Email *',
    reportPhonePlaceholder: '電話',
    reportActionForm: '開啟官方表單',
    reportActionFormDesc: '複製回報內容並開啟 YouBike 表單',
    reportActionAutoFill: '自動填入表單',
    reportActionAutoFillDesc: '複製填入腳本並開啟表單',
    reportAutoFillHint: '已複製自動填入腳本！請在 YouBike 頁面按 F12 → 主控台 → Ctrl+V → Enter',
    reportActionCall: '撥打客服電話',
    reportActionEmail: '寄送 Email',
    reportCopied: '已複製回報內容至剪貼簿！',
    reportIssueRequired: '請選擇問題類型',
    reportEmailRequired: '請輸入有效的 Email',
    reportNotesPlaceholder: '描述問題...',
    reportSubject: 'YouBike 問題回報',
    faultFlatTire: '輪胎沒氣',
    faultBrokenSeat: '座椅損壞',
    faultBrakeIssue: '煞車故障',
    faultChainProblem: '鏈條問題',
    faultOtherBike: '其他車輛問題',
    faultBrokenDock: '車柱損壞',
    faultCannotLock: '無法鎖車',
    faultCannotUnlock: '無法解鎖',
    faultStationFull: '車位滿載',
    faultNoBikes: '無車可借',
    faultOther: '其他'
  }
};

// ============================================================
// REPORT CONSTANTS
// ============================================================

const YOUBIKE_CONTACTS = {
  taipei:        { phone: '02-8978-8822', email: 'service-taipei@youbike.com.tw',    formalName: '臺北市' },
  newtaipei:     { phone: '02-8979-1122', email: 'service-ntpc@youbike.com.tw',      formalName: '新北市' },
  taoyuan:       { phone: '03-286-8222',  email: 'service-taoyuan@youbike.com.tw',   formalName: '桃園市' },
  hsinchu:       { phone: '03-659-0022',  email: 'service-hccg@youbike.com.tw',      formalName: '新竹市' },
  hsinchuCounty: { phone: '03-659-1122',  email: 'service-hsinchu@youbike.com.tw',   formalName: '新竹縣' },
  miaoli:        { phone: '037-558822',   email: 'service-miaoli@youbike.com.tw',    formalName: '苗栗縣' },
  taichung:      { phone: '04-2369-6922', email: 'service-taichung@youbike.com.tw',  formalName: '臺中市' },
  chiayi:        { phone: '05-294-9222',  email: 'service-chiayi@youbike.com.tw',    formalName: '嘉義市' },
  chiayiCounty:  { phone: '05-294-9522',  email: 'service-cyhg@youbike.com.tw',      formalName: '嘉義縣' },
  tainan:        { phone: '06-300-9966',  email: 'service-tainan@youbike.com.tw',    formalName: '臺南市' },
  kaohsiung:     { phone: '07-262-6288',  email: 'service-kaohsiung@youbike.com.tw', formalName: '高雄市' },
  pingtung:      { phone: '08-884-9888',  email: 'service-pingtung@youbike.com.tw',  formalName: '屏東縣' },
  taitung:       { phone: '089-219322',   email: 'service-taitung@youbike.com.tw',   formalName: '臺東縣' }
};

const FORM_SUBCATEGORY_MAP = {
  faultFlatTire:      { category: '調度維修', sub: '自行車問題' },
  faultBrokenSeat:    { category: '調度維修', sub: '自行車問題' },
  faultBrakeIssue:    { category: '調度維修', sub: '自行車問題' },
  faultChainProblem:  { category: '調度維修', sub: '自行車問題' },
  faultOtherBike:     { category: '調度維修', sub: '自行車問題' },
  faultBrokenDock:    { category: '調度維修', sub: '停車柱問題' },
  faultCannotLock:    { category: '調度維修', sub: '停車柱問題' },
  faultCannotUnlock:  { category: '調度維修', sub: '停車柱問題' },
  faultStationFull:   { category: '調度維修', sub: '無車可借問題' },
  faultNoBikes:       { category: '調度維修', sub: '無車可借問題' },
  faultOther:         { category: '意見表達', sub: null }
};

const FAULT_TYPES = [
  'faultFlatTire', 'faultBrokenSeat', 'faultBrakeIssue', 'faultChainProblem',
  'faultOtherBike', 'faultBrokenDock', 'faultCannotLock', 'faultCannotUnlock',
  'faultStationFull', 'faultNoBikes', 'faultOther'
];

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
let selectedDistricts = new Set();
let ebikeFilterOn = false;
let currentReportStation = null;
let selectedIssueType = null;

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

  let text;
  if (isZh) {
    text = `🚲 ${cityName} · ${stationCount} 站 · ${totalBikes.toLocaleString()} 車`;
  } else {
    text = `🚲 ${cityName} · ${stationCount} stations · ${totalBikes.toLocaleString()} bikes`;
  }

  const fare = YOUBIKE_FARES[currentCity];
  if (fare && fare.hasEbike) {
    const totalEbikes = stationsData.reduce((sum, s) => sum + (s.ebikes || 0), 0);
    if (totalEbikes > 0) {
      text += isZh ? ` · ⚡${totalEbikes} 電輔車` : ` · ⚡${totalEbikes} e-bikes`;
    }
  }

  summaryEl.textContent = text;
}

// ============================================================
// LANGUAGE
// ============================================================

function toggleLang() {
  isZh = !isZh;
  saveLanguage(isZh ? 'zh' : 'en');
  updateUI();
  applyFilters();
  updatePopups();
  updateSheetSummary();
  buildDistrictFilter(stationsData);
  updateLegend();
  updateFareCard();
  updateEbikeFilterVisibility();
  closeSearchDropdown();
  updateReportModalLabels();
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

  // Update map legend
  updateLegend();
}

function updateLegend() {
  const legend = document.getElementById('map-legend');
  if (!legend) return;
  legend.querySelectorAll('[data-en]').forEach(el => {
    el.textContent = isZh ? el.dataset.zh : el.dataset.en;
  });
}

// ============================================================
// FARE CARD
// ============================================================

const REGION_SLUGS = {
  taipei: 'taipei', newtaipei: 'ntpc', taoyuan: 'taoyuan',
  hsinchu: 'hsinchu', hsinchuCounty: 'hsinchu-county', miaoli: 'miaoli',
  taichung: 'taichung', chiayi: 'chiayi', chiayiCounty: 'chiayi-county',
  tainan: 'tainan', kaohsiung: 'kaohsiung', pingtung: 'pingtung',
  taitung: 'taitung'
};

function toggleFareCard() {
  const body = document.getElementById('fare-body');
  const toggle = document.getElementById('fare-toggle');
  if (!body) return;
  body.classList.toggle('open');
  toggle.classList.toggle('open');
}

function formatTierLabel(tier, prevMinutes, l) {
  const from = prevMinutes === 0 ? '0' : `${prevMinutes / 60}h`;
  const to = tier.minutes === Infinity ? '+' : `${tier.minutes / 60}h`;
  if (tier.minutes === Infinity) return `${from}${to}`;
  return `${from}–${to}`;
}

function buildRateTable(tiers, label, l) {
  let html = `<div style="font-weight:500;margin-top:6px;">${label}</div>`;
  html += `<table class="fare-table"><tr><th>${l.fareTime}</th><th>${l.fareRate}</th></tr>`;
  let prev = 0;
  tiers.forEach(tier => {
    html += `<tr><td>${formatTierLabel(tier, prev, l)}</td><td>NT$${tier.per30}${l.per30min}</td></tr>`;
    prev = tier.minutes;
  });
  html += '</table>';
  return html;
}

function updateFareCard() {
  const body = document.getElementById('fare-body');
  if (!body) return;

  const l = LABELS[isZh ? 'zh' : 'en'];

  // Update header text
  const header = document.querySelector('#fare-card .fare-header [data-en]');
  if (header) header.textContent = isZh ? header.dataset.zh : header.dataset.en;

  if (currentCity === 'all') {
    body.innerHTML = `<div style="color:#888;font-style:italic;">${l.selectCityForFare}</div>`;
    return;
  }

  const fare = YOUBIKE_FARES[currentCity];
  if (!fare) {
    body.innerHTML = '';
    return;
  }

  const base = YOUBIKE_FARES._base;
  let html = '';

  // Free 30 min badge
  if (fare.free30) {
    html += `<div><span class="fare-badge yes">✓ ${l.free30}</span></div>`;
  } else {
    html += `<div><span class="fare-badge no">✗ ${l.noFree30}</span></div>`;
  }

  // YouBike 2.0 rate table
  html += buildRateTable(base.yb2, 'YouBike 2.0', l);

  // YouBike 2.0E rate table (only if available)
  if (fare.hasEbike) {
    html += buildRateTable(base.yb2e, 'YouBike 2.0E ⚡', l);
    html += buildRangeReference(l);
  }

  // TPASS info
  if (fare.tpass) {
    const tpassText = isZh ? fare.tpass.zh : fare.tpass.en;
    html += `<div class="fare-tpass">🎫 ${l.tpassLabel}: ${tpassText}</div>`;
  } else {
    html += `<div class="fare-tpass" style="background:#fafafa;color:#888;">🎫 ${l.tpassLabel}: ${l.noTpass}</div>`;
  }

  // Official rate link
  const slug = REGION_SLUGS[currentCity] || currentCity;
  html += `<a class="fare-link" href="https://www.youbike.com.tw/region/${slug}/rate/" target="_blank">🔗 ${l.rateLink}</a>`;

  body.innerHTML = html;
}

function buildRangeReference(l) {
  let html = `<div style="font-weight:500;margin-top:8px;">${l.ebikeRangeTitle}</div>`;
  html += '<table class="fare-table">';
  html += `<tr><td>${l.rangeFlat}</td><td>~50 ${l.rangeKm}</td></tr>`;
  html += `<tr><td>${l.rangeHilly}</td><td>~30 ${l.rangeKm}</td></tr>`;
  html += `<tr><td>${l.rangeCold}</td><td>~35 ${l.rangeKm}</td></tr>`;
  html += `<tr><td>${l.rangeOfficial}</td><td>80 ${l.rangeKm}</td></tr>`;
  html += '</table>';
  return html;
}

// ============================================================
// E-BIKE FILTER
// ============================================================

function toggleEbikeFilter() {
  const checkbox = document.getElementById('ebike-toggle');
  ebikeFilterOn = checkbox ? checkbox.checked : false;
  applyFilters();
}

function updateEbikeFilterVisibility() {
  const container = document.getElementById('ebike-filter');
  if (!container) return;

  const fare = YOUBIKE_FARES[currentCity];
  if (fare && fare.hasEbike) {
    container.style.display = '';
    const textEl = document.getElementById('ebike-filter-text');
    if (textEl) {
      const l = LABELS[isZh ? 'zh' : 'en'];
      textEl.textContent = l.ebikeFilterLabel;
    }
  } else {
    container.style.display = 'none';
    // Reset filter when switching to non-ebike city
    ebikeFilterOn = false;
    const checkbox = document.getElementById('ebike-toggle');
    if (checkbox) checkbox.checked = false;
  }
}

// ============================================================
// NEARBY E-BIKE STATIONS
// ============================================================

function countNearbyEbikeStations(station) {
  const fare = YOUBIKE_FARES[station.city];
  if (!fare || !fare.hasEbike) return 0;

  let count = 0;
  for (const s of stationsData) {
    if (s.sno === station.sno) continue;
    if (s.ebikes <= 0) continue;
    const dist = getDistanceInMeters(station.latitude, station.longitude, s.latitude, s.longitude);
    if (dist <= 500) count++;
  }
  return count;
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
  const normalized = data.map(normalizeStation);
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

    // Build district filter chips
    buildDistrictFilter(stationsData);

    // Apply filters (district + search) and render
    applyFilters();
    updateSheetSummary();
    updateFareCard();
    updateEbikeFilterVisibility();

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

function createMarkerIconSimple(type, hasEbikes) {
  const colorClass = {
    ok: 'marker-ok', empty: 'marker-empty',
    full: 'marker-full', suspended: 'marker-suspended'
  }[type] || 'marker-ok';
  const bolt = hasEbikes ? '<span class="ebike-bolt">\u26A1</span>' : '';
  return L.divIcon({
    className: '',
    html: `<div class="marker-icon ${colorClass}" style="width:12px;height:12px;">${bolt}</div>`,
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
  const isSuspended = station.status === 2;

  let distanceHtml = '';
  if (station.distance !== undefined) {
    distanceHtml = `<br><strong>${L.distance}:</strong> ${formatDistance(station.distance, isZh)}`;
  }

  const navHtml = getNavigationHtml(station.latitude, station.longitude, isZh);
  const name = isZh ? station.sna : (station.snaen || station.sna);
  const address = isZh ? station.ar : (station.aren || station.ar);

  let statusHtml;
  if (isSuspended) {
    statusHtml = `<span style="color:#9E9E9E;font-weight:bold;">${L.suspended}</span>`;
  } else {
    const ebikeHtml = station.ebikes > 0
      ? `<br>\u26A1 ${L.ebikes}: ${station.ebikes}`
      : '';
    statusHtml = isZh
      ? `${L.bikes}: ${bikes} 輛<br>${L.slots}: ${slots} 輛${ebikeHtml}`
      : `${L.bikes}: ${bikes}<br>${L.slots}: ${slots}${ebikeHtml}`;
  }

  let fareHintHtml = '';
  if (!isSuspended) {
    const fare = YOUBIKE_FARES[station.city];
    if (fare && fare.free30) {
      fareHintHtml = `<br><span style="color:#2e7d32;font-size:12px;">🎫 ${L.free30}</span>`;
    }
  }

  let nearbyEbikeHtml = '';
  if (!isSuspended) {
    const nearbyCount = countNearbyEbikeStations(station);
    if (nearbyCount > 0) {
      nearbyEbikeHtml = isZh
        ? `<br><span style="color:#E65100;font-size:12px;">⚡ ${L.nearbyEbikes}: ${nearbyCount}</span>`
        : `<br><span style="color:#E65100;font-size:12px;">⚡ ${nearbyCount} ${L.nearbyEbikes}</span>`;
    }
  }

  const reportBtnHtml = !isSuspended ? getReportButtonHtml(station.sno) : '';

  return `<div>
    <strong>${name}</strong><br>
    <small>${cityName}</small><br>
    ${L.location}: ${address}<br>
    ${statusHtml}${fareHintHtml}${nearbyEbikeHtml}${distanceHtml}
    ${reportBtnHtml}
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
      icon: createMarkerIconSimple(getMarkerType(station), station.ebikes > 0)
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
    const isSuspended = station.status === 2;

    let distanceHtml = '';
    if (station.distance !== undefined) {
      distanceHtml = ` | ${formatDistance(station.distance, isZh)}`;
    }

    let infoHtml;
    if (isSuspended) {
      infoHtml = `<span class="suspended-label">${L.suspended}</span>${distanceHtml}`;
    } else {
      const bikesClass = bikes === 0 ? 'no-bikes' : 'bikes';
      const slotsClass = slots === 0 ? 'no-slots' : 'slots';
      const ebikeBadge = station.ebikes > 0
        ? ` <span class="ebike-badge">\u26A1${station.ebikes}</span>`
        : '';
      infoHtml = `<span class="${bikesClass}">${L.bikes}: ${bikes}</span>${ebikeBadge} |
        <span class="${slotsClass}">${L.slots}: ${slots}</span>${distanceHtml}`;
    }

    const suspendedClass = isSuspended ? ' station-suspended' : '';

    return `<li class="station-item${suspendedClass}" data-sno="${station.sno}" onclick="selectStation('${station.sno}')">
      <div class="station-name">${name}</div>
      <div class="station-address">${address}</div>
      <div class="station-info">${infoHtml}</div>
    </li>`;
  }).join('');
}

function getFilteredStations() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase();
  let filtered = stationsData;

  // District filter
  if (selectedDistricts.size > 0) {
    filtered = filtered.filter(s => selectedDistricts.has(s.sarea));
  }

  // E-bike filter
  if (ebikeFilterOn) {
    filtered = filtered.filter(s => s.ebikes > 0);
  }

  // Search filter
  if (query) {
    filtered = filtered.filter(s =>
      s.sna.toLowerCase().includes(query) ||
      s.snaen.toLowerCase().includes(query) ||
      s.ar.toLowerCase().includes(query) ||
      s.aren.toLowerCase().includes(query) ||
      s.sarea.toLowerCase().includes(query) ||
      s.sareaen.toLowerCase().includes(query)
    );
  }

  return filtered;
}

function applyFilters() {
  const filtered = getFilteredStations();
  updateStationList(filtered);
  updateMarkers(filtered);
}

// ============================================================
// DISTRICT FILTER
// ============================================================

function buildDistrictFilter(stations) {
  const container = document.getElementById('district-filter');
  if (!container) return;

  // Hide for "all" city (too many districts)
  if (currentCity === 'all') {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  // Extract unique districts
  const districtMap = new Map();
  stations.forEach(s => {
    if (s.sarea && !districtMap.has(s.sarea)) {
      districtMap.set(s.sarea, s.sareaen || s.sarea);
    }
  });

  if (districtMap.size === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  const L = LABELS[isZh ? 'zh' : 'en'];
  const allActive = selectedDistricts.size === 0;

  let html = `<button class="district-chip${allActive ? ' active' : ''}" data-district="__all__">${L.allDistricts}</button>`;
  for (const [zhName, enName] of districtMap) {
    const active = selectedDistricts.size === 0 || selectedDistricts.has(zhName);
    const label = isZh ? zhName : enName;
    html += `<button class="district-chip${active ? ' active' : ''}" data-district="${zhName}">${label}</button>`;
  }

  container.innerHTML = html;

  // Attach click handlers
  container.querySelectorAll('.district-chip').forEach(chip => {
    chip.addEventListener('click', () => toggleDistrict(chip.dataset.district, districtMap));
  });
}

function toggleDistrict(district, districtMap) {
  if (district === '__all__') {
    // Toggle all: if currently showing all, select none; otherwise select all
    if (selectedDistricts.size === 0) {
      // "All" is active → deselect everything (show nothing)
      const container = document.getElementById('district-filter');
      container.querySelectorAll('.district-chip').forEach(chip => {
        if (chip.dataset.district !== '__all__') {
          selectedDistricts.add(chip.dataset.district);
        }
      });
      // Actually we want "uncheck all" to clear, and re-check to restore
      // Simpler: toggle between "all selected" (empty set) and "none selected"
      selectedDistricts.clear();
      // Collect all districts from chips, then set them all as a "none" state
      // Re-think: empty set = all shown. So clicking "All" when all shown → set to impossible state
      // Better UX: All chip always resets to "show all"
      selectedDistricts.clear();
    } else {
      selectedDistricts.clear(); // Reset to show all
    }
  } else {
    if (selectedDistricts.size === 0) {
      // Currently showing all → switch to showing only NOT this one
      // i.e., deselect this district by selecting all others
      const container = document.getElementById('district-filter');
      container.querySelectorAll('.district-chip').forEach(chip => {
        if (chip.dataset.district !== '__all__' && chip.dataset.district !== district) {
          selectedDistricts.add(chip.dataset.district);
        }
      });
    } else if (selectedDistricts.has(district)) {
      selectedDistricts.delete(district);
      if (selectedDistricts.size === 0) {
        // All removed → this means nothing is selected, which shows all
        // That's fine — means user unchecked the last one → show all
      }
    } else {
      selectedDistricts.add(district);
    }
  }

  // Update chip active states
  updateDistrictChipStates();
  applyFilters();
}

function updateDistrictChipStates() {
  const container = document.getElementById('district-filter');
  if (!container) return;
  const allActive = selectedDistricts.size === 0;

  container.querySelectorAll('.district-chip').forEach(chip => {
    if (chip.dataset.district === '__all__') {
      chip.classList.toggle('active', allActive);
    } else {
      chip.classList.toggle('active', allActive || selectedDistricts.has(chip.dataset.district));
    }
  });
}

// ============================================================
// AUTOCOMPLETE DROPDOWN
// ============================================================

function updateSearchDropdown(query) {
  const dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;

  if (!query || query.length < 2) {
    dropdown.style.display = 'none';
    return;
  }

  const q = query.toLowerCase();
  const matches = stationsData.filter(s =>
    s.sna.toLowerCase().includes(q) ||
    s.snaen.toLowerCase().includes(q) ||
    s.sarea.toLowerCase().includes(q) ||
    s.sareaen.toLowerCase().includes(q)
  ).slice(0, 8);

  if (matches.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  const L = LABELS[isZh ? 'zh' : 'en'];
  dropdown.innerHTML = matches.map(s => {
    const name = isZh ? s.sna : s.snaen;
    const district = isZh ? s.sarea : s.sareaen;
    const statusLabel = s.status === 2
      ? `<span class="dd-suspended">${L.suspended}</span>`
      : `<span class="dd-bikes">${s.available_rent_bikes}</span>/<span class="dd-slots">${s.available_return_bikes}</span>`;
    const ebike = s.ebikes > 0 ? ` <span class="dd-ebike">\u26A1${s.ebikes}</span>` : '';
    return `<li class="dd-item" data-sno="${s.sno}">
      <span class="dd-name">${name}</span>
      <span class="dd-district">${district}</span>
      <span class="dd-counts">${statusLabel}${ebike}</span>
    </li>`;
  }).join('');

  dropdown.style.display = 'block';

  // Attach click handlers
  dropdown.querySelectorAll('.dd-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur from firing first
      const sno = item.dataset.sno;
      selectStation(sno);
      closeSearchDropdown();
      document.getElementById('search-input').value = '';
      applyFilters();
    });
  });
}

function closeSearchDropdown() {
  const dropdown = document.getElementById('search-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

// ============================================================
// CITY CHANGE
// ============================================================

function changeCity() {
  const select = document.getElementById('city-select');
  currentCity = select.value;

  localStorage.setItem('ubike-city', currentCity);
  console.log(`[UBike] City changed to: ${currentCity}`);

  // Reset district filter
  selectedDistricts.clear();

  // Reset e-bike filter
  ebikeFilterOn = false;
  const ebikeCheckbox = document.getElementById('ebike-toggle');
  if (ebikeCheckbox) ebikeCheckbox.checked = false;

  // Clear search
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  closeSearchDropdown();

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
// FAULT REPORT
// ============================================================

function getReportButtonHtml(sno) {
  const L = LABELS[isZh ? 'zh' : 'en'];
  return `<div style="margin:6px 0;">
    <button onclick="openReportModal('${sno}')" style="
      background:#FF9800;color:white;border:none;border-radius:4px;
      padding:6px 12px;cursor:pointer;font-size:13px;font-weight:500;
    ">${L.reportBtn}</button>
  </div>`;
}

function openReportModal(sno) {
  const station = stationsData.find(s => s.sno === sno) ||
                  allStationsCache.find(s => s.sno === sno);
  if (!station) return;

  currentReportStation = station;
  selectedIssueType = null;

  populateReportModal(station);
  loadSavedContactInfo();

  const overlay = document.getElementById('report-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReportModal() {
  const overlay = document.getElementById('report-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  currentReportStation = null;
  selectedIssueType = null;

  // Clear errors
  const issueErr = document.getElementById('report-issue-error');
  const emailErr = document.getElementById('report-email-error');
  if (issueErr) issueErr.style.display = 'none';
  if (emailErr) emailErr.style.display = 'none';
}

function populateReportModal(station) {
  const L = LABELS[isZh ? 'zh' : 'en'];
  const contact = YOUBIKE_CONTACTS[station.city];

  // Title & section labels
  document.getElementById('report-title').textContent = L.reportTitle;
  document.getElementById('report-station-label').textContent = L.reportStation;
  document.getElementById('report-issue-label').textContent = L.reportSelectIssue;
  document.getElementById('report-notes-label').textContent = L.reportNotes;
  document.getElementById('report-contact-label').textContent = L.reportYourContact;

  // Station info
  const name = isZh ? station.sna : (station.snaen || station.sna);
  const cityName = CITIES[station.city]?.name[isZh ? 'zh' : 'en'] || station.city;
  const address = isZh ? station.ar : (station.aren || station.ar);
  const bikes = station.available_rent_bikes;
  const slots = station.available_return_bikes;

  document.getElementById('report-station-info').innerHTML =
    `<strong>${name}</strong><br>` +
    `${cityName}<br>` +
    `${address}<br>` +
    `${L.bikes}: ${bikes} | ${L.slots}: ${slots}`;

  // Issue grid
  buildIssueTypeGrid();

  // Notes
  const notes = document.getElementById('report-notes');
  if (notes) {
    notes.value = '';
    notes.placeholder = L.reportNotesPlaceholder;
  }

  // Contact placeholders
  const emailInput = document.getElementById('report-email');
  const phoneInput = document.getElementById('report-phone');
  if (emailInput) emailInput.placeholder = L.reportEmailPlaceholder;
  if (phoneInput) phoneInput.placeholder = L.reportPhonePlaceholder;

  // Action buttons
  document.getElementById('report-action-form-title').textContent = L.reportActionForm;
  document.getElementById('report-action-form-desc').textContent = L.reportActionFormDesc;
  const autoFillTitle = document.getElementById('report-action-autofill-title');
  const autoFillDesc = document.getElementById('report-action-autofill-desc');
  if (autoFillTitle) autoFillTitle.textContent = L.reportActionAutoFill;
  if (autoFillDesc) autoFillDesc.textContent = L.reportActionAutoFillDesc;
  document.getElementById('report-action-call-title').textContent = L.reportActionCall;
  document.getElementById('report-action-call-desc').textContent = contact ? contact.phone : '';
  document.getElementById('report-action-email-title').textContent = L.reportActionEmail;
  document.getElementById('report-action-email-desc').textContent = contact ? contact.email : '';
}

function buildIssueTypeGrid() {
  const grid = document.getElementById('report-issue-grid');
  if (!grid) return;
  const L = LABELS[isZh ? 'zh' : 'en'];

  grid.innerHTML = FAULT_TYPES.map(type => {
    const selected = selectedIssueType === type ? ' selected' : '';
    return `<button class="report-issue-chip${selected}" onclick="selectIssueType('${type}')">${L[type]}</button>`;
  }).join('');
}

function selectIssueType(type) {
  selectedIssueType = selectedIssueType === type ? null : type;
  buildIssueTypeGrid();

  // Clear error
  const err = document.getElementById('report-issue-error');
  if (err) err.style.display = 'none';
}

function loadSavedContactInfo() {
  const email = localStorage.getItem('ubike-report-email') || '';
  const phone = localStorage.getItem('ubike-report-phone') || '';
  const emailInput = document.getElementById('report-email');
  const phoneInput = document.getElementById('report-phone');
  if (emailInput) emailInput.value = email;
  if (phoneInput) phoneInput.value = phone;
}

function saveContactInfo() {
  const email = (document.getElementById('report-email')?.value || '').trim();
  const phone = (document.getElementById('report-phone')?.value || '').trim();
  if (email) localStorage.setItem('ubike-report-email', email);
  if (phone) localStorage.setItem('ubike-report-phone', phone);
}

function validateReport() {
  const L = LABELS[isZh ? 'zh' : 'en'];
  let valid = true;

  // Issue type
  const issueErr = document.getElementById('report-issue-error');
  if (!selectedIssueType) {
    if (issueErr) {
      issueErr.textContent = L.reportIssueRequired;
      issueErr.style.display = 'block';
    }
    valid = false;
  } else if (issueErr) {
    issueErr.style.display = 'none';
  }

  // Email
  const email = (document.getElementById('report-email')?.value || '').trim();
  const emailErr = document.getElementById('report-email-error');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    if (emailErr) {
      emailErr.textContent = L.reportEmailRequired;
      emailErr.style.display = 'block';
    }
    valid = false;
  } else if (emailErr) {
    emailErr.style.display = 'none';
  }

  return valid;
}

function buildReportText() {
  const station = currentReportStation;
  if (!station) return '';

  const L = LABELS[isZh ? 'zh' : 'en'];
  const contact = YOUBIKE_CONTACTS[station.city];
  const formalCity = contact ? contact.formalName : (CITIES[station.city]?.name.zh || station.city);
  const issueLabel = L[selectedIssueType] || selectedIssueType;
  const notes = (document.getElementById('report-notes')?.value || '').trim();
  const email = (document.getElementById('report-email')?.value || '').trim();
  const phone = (document.getElementById('report-phone')?.value || '').trim();
  const now = new Date().toLocaleString(isZh ? 'zh-TW' : 'en-US');

  if (isZh) {
    let text = `【YouBike 問題回報】\n`;
    text += `時間：${now}\n`;
    text += `城市：${formalCity}\n`;
    text += `站點：${station.sna}\n`;
    text += `地址：${station.ar}\n`;
    text += `可借車輛：${station.available_rent_bikes}\n`;
    text += `可停空位：${station.available_return_bikes}\n`;
    text += `問題類型：${issueLabel}\n`;
    if (notes) text += `備註：${notes}\n`;
    text += `回報者 Email：${email}\n`;
    if (phone) text += `回報者電話：${phone}\n`;
    return text;
  } else {
    let text = `【YouBike Issue Report】\n`;
    text += `Time: ${now}\n`;
    text += `City: ${formalCity}\n`;
    text += `Station: ${station.snaen || station.sna}\n`;
    text += `Address: ${station.aren || station.ar}\n`;
    text += `Bikes available: ${station.available_rent_bikes}\n`;
    text += `Slots available: ${station.available_return_bikes}\n`;
    text += `Issue: ${issueLabel}\n`;
    if (notes) text += `Notes: ${notes}\n`;
    text += `Reporter email: ${email}\n`;
    if (phone) text += `Reporter phone: ${phone}\n`;
    return text;
  }
}

function showToast(msg) {
  const existing = document.querySelector('.report-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'report-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  const duration = msg.length > 40 ? 5000 : 3000;
  setTimeout(() => toast.remove(), duration);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

async function reportViaForm() {
  if (!validateReport()) return;
  saveContactInfo();

  const text = buildReportText();
  await copyToClipboard(text);

  const L = LABELS[isZh ? 'zh' : 'en'];
  showToast(L.reportCopied);

  const slug = REGION_SLUGS[currentReportStation.city] || currentReportStation.city;
  const url = `https://www.youbike.com.tw/region/${slug}/customer-service/`;
  window.open(url, '_blank');

  closeReportModal();
}

async function reportViaAutoFill() {
  if (!validateReport()) return;
  saveContactInfo();

  const station = currentReportStation;
  const contact = YOUBIKE_CONTACTS[station.city];
  const mapping = FORM_SUBCATEGORY_MAP[selectedIssueType] || { category: '調度維修', sub: null };
  const reportText = buildReportText();
  const email = (document.getElementById('report-email')?.value || '').trim();
  const phone = (document.getElementById('report-phone')?.value || '').trim();

  const fillData = JSON.stringify({
    city: contact.formalName,
    email: email,
    phone: phone,
    category: mapping.category,
    subcategory: mapping.sub,
    description: reportText
  });

  const script = `(function(){var d=${fillData};` +
    `function s(el,v){if(!el)return;var ns=Object.getOwnPropertyDescriptor(` +
    `window.HTMLSelectElement.prototype,'value').set||` +
    `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;` +
    `ns.call(el,v);el.dispatchEvent(new Event('change',{bubbles:true}));}` +
    `function f(el,v){if(!el)return;var ns=Object.getOwnPropertyDescriptor(` +
    `window.HTMLInputElement.prototype,'value').set||` +
    `Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;` +
    `ns.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));}` +
    `var sels=document.querySelectorAll('select');` +
    `var inps=document.querySelectorAll('input[type="text"],input[type="email"],input:not([type])');` +
    `var ta=document.querySelector('textarea');` +
    `if(sels[0])s(sels[0],d.city);` +
    `if(inps[0])f(inps[0],d.email);` +
    `if(inps[1])f(inps[1],d.phone);` +
    `setTimeout(function(){` +
    `if(sels[1])s(sels[1],d.category);` +
    `setTimeout(function(){` +
    `if(d.subcategory&&sels[2])s(sels[2],d.subcategory);` +
    `if(ta)f(ta,d.description);` +
    `},500);},300);` +
    `})();`;

  await copyToClipboard(script);

  const slug = REGION_SLUGS[station.city] || station.city;
  window.open(`https://www.youbike.com.tw/region/${slug}/customer-service/`, '_blank');

  const L = LABELS[isZh ? 'zh' : 'en'];
  showToast(L.reportAutoFillHint);
  closeReportModal();
}

function reportViaCall() {
  if (!currentReportStation) return;

  const contact = YOUBIKE_CONTACTS[currentReportStation.city];
  if (!contact) return;

  saveContactInfo();
  window.location.href = `tel:${contact.phone.replace(/-/g, '')}`;
  closeReportModal();
}

async function reportViaEmail() {
  if (!validateReport()) return;
  saveContactInfo();

  const station = currentReportStation;
  const contact = YOUBIKE_CONTACTS[station.city];
  if (!contact) return;

  const L = LABELS[isZh ? 'zh' : 'en'];
  const subject = encodeURIComponent(`${L.reportSubject} - ${station.sna}`);
  const body = encodeURIComponent(buildReportText());
  window.location.href = `mailto:${contact.email}?subject=${subject}&body=${body}`;

  closeReportModal();
}

function updateReportModalLabels() {
  if (!currentReportStation) return;
  const overlay = document.getElementById('report-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  populateReportModal(currentReportStation);
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

  // Setup search with autocomplete
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    applyFilters();
    updateSearchDropdown(e.target.value.trim());
  });
  searchInput.addEventListener('blur', () => {
    setTimeout(closeSearchDropdown, 150);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSearchDropdown();
  });

  // Close report modal on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('report-overlay');
      if (overlay && overlay.classList.contains('open')) {
        closeReportModal();
      }
    }
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
window.applyFilters = applyFilters;
window.toggleFareCard = toggleFareCard;
window.toggleEbikeFilter = toggleEbikeFilter;
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.selectIssueType = selectIssueType;
window.reportViaForm = reportViaForm;
window.reportViaAutoFill = reportViaAutoFill;
window.reportViaCall = reportViaCall;
window.reportViaEmail = reportViaEmail;
