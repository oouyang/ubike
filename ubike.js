'use strict';

/**
 * UBike Store Locator Integration
 * Provides data source for the store-locator library
 */

const UBIKE_CONFIG = {
    API_URL: 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json',
    DEFAULT_CENTER: { lat: 25.03304, lng: 121.5656 },
    DEFAULT_ZOOM: 14
};

/**
 * Check if user's locale is Chinese
 */
function isChineseLocale() {
    const userLang = navigator.language || navigator.userLanguage;
    return userLang === 'zh-TW' || userLang === 'zh-CN';
}

/**
 * UBike Data Feed for store-locator library
 */
class UBikeDataFeed {
    constructor() {
        this.stations = [];
        this.loaded = false;
    }

    async loadStations() {
        if (this.loaded) return this.stations;

        console.log('[UBike] Loading station data...');
        try {
            const response = await fetch(UBIKE_CONFIG.API_URL);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.stations = await response.json();
            this.loaded = true;
            console.log(`[UBike] Loaded ${this.stations.length} stations`);
        } catch (error) {
            console.error('[UBike] Failed to load stations:', error.message);
            this.stations = [];
        }
        return this.stations;
    }

    /**
     * Convert station data to store-locator Store format
     */
    toStores() {
        const isZh = isChineseLocale();
        return this.stations.map(station => {
            const position = new google.maps.LatLng(station.latitude, station.longitude);
            const name = isZh ? station.sna : station.snaen;
            const address = isZh
                ? `${station.sarea} ${station.ar}`
                : `${station.sareaen} ${station.aren}`;

            return new storeLocator.Store(station.sno, position, null, {
                title: name,
                address: address,
                hours: `Bikes: ${station.available_rent_bikes} | Slots: ${station.available_return_bikes}`
            });
        });
    }
}

/**
 * Initialize the store locator view
 */
async function initStoreLocator() {
    console.log('[UBike] Initializing store locator...');

    const feed = new UBikeDataFeed();
    await feed.loadStations();

    if (feed.stations.length === 0) {
        console.error('[UBike] No stations loaded, cannot initialize');
        document.getElementById('panel').innerHTML = '<p style="color:red;">Error loading stations</p>';
        return;
    }

    const center = new google.maps.LatLng(
        UBIKE_CONFIG.DEFAULT_CENTER.lat,
        UBIKE_CONFIG.DEFAULT_CENTER.lng
    );

    const map = new google.maps.Map(document.getElementById('map-canvas'), {
        center: center,
        zoom: UBIKE_CONFIG.DEFAULT_ZOOM
    });

    try {
        const view = new storeLocator.View(map, feed.toStores());
        new storeLocator.Panel(document.getElementById('panel'), { view: view });
        console.log('[UBike] Store locator initialized successfully');
    } catch (error) {
        console.error('[UBike] Failed to initialize store locator:', error.message);
        // Fallback: just show markers
        feed.stations.forEach(station => {
            new google.maps.Marker({
                position: new google.maps.LatLng(station.latitude, station.longitude),
                map: map,
                title: isChineseLocale() ? station.sna : station.snaen
            });
        });
        console.log('[UBike] Fallback: displayed simple markers');
    }
}

// Initialize when DOM is ready
if (typeof google !== 'undefined' && google.maps) {
    google.maps.event.addDomListener(window, 'load', initStoreLocator);
} else {
    document.addEventListener('DOMContentLoaded', () => {
        console.warn('[UBike] Google Maps not loaded, waiting...');
        // Retry after a delay if Google Maps loads asynchronously
        setTimeout(() => {
            if (typeof google !== 'undefined' && google.maps) {
                initStoreLocator();
            } else {
                console.error('[UBike] Google Maps failed to load');
            }
        }, 1000);
    });
}
