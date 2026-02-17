'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createBrowserContext, loadHtmlScript, exposeVars, setVar } = require('./helpers/load-script');

describe('oil.html', () => {
  let ctx;

  function makeCtx(overrides = {}) {
    const c = createBrowserContext({
      navigator: {
        language: 'en-US',
        userAgent: 'Mozilla/5.0',
        geolocation: { getCurrentPosition() {} },
        clipboard: { writeText: async () => {} },
        ...(overrides.navigator || {})
      },
      ...overrides
    });
    c.URL = URL;
    c.URLSearchParams = URLSearchParams;

    loadHtmlScript('oil.html', c);
    exposeVars(c, [
      'WORKER_URL', 'CPC_API', 'OVERPASS_API', 'SEARCH_RADIUS',
      'DEMO_PRICES', 'priceData', 'isZh', 'isDemo', 'map',
      'stationMarkers', 'userLocation', 'bottomSheet',
      'switchTab', 'loadPrices', 'renderPrices', 'renderPredictions',
      'renderChart', 'shareFB', 'copyPrices', 'getPriceShareText',
      'getDistanceInMeters', 'formatDistance', 'parseStation',
      'toggleLang', 'updateUI', 'updateSheetSummary',
      'getNavigationHtml', 'renderStations', 'renderStationMarkers'
    ]);
    return c;
  }

  beforeEach(() => {
    ctx = makeCtx();
  });

  // ========== Constants ==========

  describe('Constants', () => {
    it('OVERPASS_API points to overpass-api.de', () => {
      assert.ok(ctx.OVERPASS_API.includes('overpass-api.de'));
    });

    it('SEARCH_RADIUS is 5000 meters', () => {
      assert.equal(ctx.SEARCH_RADIUS, 5000);
    });

    it('WORKER_URL is empty by default (demo mode)', () => {
      assert.equal(ctx.WORKER_URL, '');
    });

    it('CPC_API points to cpc.com.tw', () => {
      assert.ok(ctx.CPC_API.includes('cpc.com.tw'));
    });
  });

  // ========== Demo Prices ==========

  describe('DEMO_PRICES', () => {
    it('has 4 fuel products', () => {
      assert.equal(ctx.DEMO_PRICES.products.length, 4);
    });

    it('contains 92, 95, 98, diesel', () => {
      const keys = ctx.DEMO_PRICES.products.map(p => p.key);
      assert.ok(keys.includes('92'));
      assert.ok(keys.includes('95'));
      assert.ok(keys.includes('98'));
      assert.ok(keys.includes('diesel'));
    });

    it('all prices are positive numbers', () => {
      for (const p of ctx.DEMO_PRICES.products) {
        assert.ok(typeof p.price === 'number');
        assert.ok(p.price > 0);
      }
    });

    it('has prediction data', () => {
      assert.ok(Array.isArray(ctx.DEMO_PRICES.predict));
      assert.equal(ctx.DEMO_PRICES.predict.length, 4);
    });

    it('has history data with 8 weeks', () => {
      assert.ok(Array.isArray(ctx.DEMO_PRICES.history));
      assert.equal(ctx.DEMO_PRICES.history.length, 8);
    });

    it('has date and dateEnd fields', () => {
      assert.ok(ctx.DEMO_PRICES.date);
      assert.ok(ctx.DEMO_PRICES.dateEnd);
    });

    it('each product has both en and zh names', () => {
      for (const p of ctx.DEMO_PRICES.products) {
        assert.ok(p.name, `missing name for ${p.key}`);
        assert.ok(p.nameZh, `missing nameZh for ${p.key}`);
      }
    });
  });

  // ========== Default State ==========

  describe('Default State', () => {
    it('isDemo defaults to true', () => {
      assert.equal(ctx.isDemo, true);
    });

    it('priceData defaults to null', () => {
      assert.equal(ctx.priceData, null);
    });

    it('userLocation defaults to null', () => {
      assert.equal(ctx.userLocation, null);
    });

    it('stationMarkers defaults to empty object', () => {
      assert.equal(typeof ctx.stationMarkers, 'object');
      assert.equal(Object.keys(ctx.stationMarkers).length, 0);
    });
  });

  // ========== getDistanceInMeters ==========

  describe('getDistanceInMeters()', () => {
    it('returns 0 for same point', () => {
      const d = ctx.getDistanceInMeters(25.033, 121.565, 25.033, 121.565);
      assert.ok(d < 1);
    });

    it('returns ~1km for points 1km apart', () => {
      // ~0.009 degrees latitude ≈ 1km
      const d = ctx.getDistanceInMeters(25.0, 121.0, 25.009, 121.0);
      assert.ok(d > 900 && d < 1100, `Expected ~1000m, got ${d}`);
    });

    it('handles Taipei to Kaohsiung (~300km)', () => {
      const d = ctx.getDistanceInMeters(25.033, 121.565, 22.627, 120.301);
      assert.ok(d > 250000 && d < 350000, `Expected ~300km, got ${d/1000}km`);
    });
  });

  // ========== formatDistance ==========

  describe('formatDistance()', () => {
    it('returns meters for < 1000', () => {
      assert.equal(ctx.formatDistance(500), '500m');
    });

    it('returns km for >= 1000', () => {
      assert.equal(ctx.formatDistance(1500), '1.5km');
    });

    it('returns empty string for null', () => {
      assert.equal(ctx.formatDistance(null), '');
    });

    it('rounds meters to nearest integer', () => {
      assert.equal(ctx.formatDistance(123.7), '124m');
    });
  });

  // ========== parseStation ==========

  describe('parseStation()', () => {
    it('parses CPC station correctly', () => {
      const el = {
        id: 123,
        lat: 25.033,
        lon: 121.565,
        tags: { name: '台灣中油加油站', brand: '台灣中油' }
      };
      const s = ctx.parseStation(el);
      assert.equal(s.type, 'cpc');
      assert.equal(s.id, 123);
      assert.equal(s.lat, 25.033);
      assert.equal(s.lng, 121.565);
    });

    it('parses Formosa station correctly', () => {
      const el = {
        id: 456,
        lat: 25.0,
        lon: 121.5,
        tags: { name: '台塑加油站', brand: '台塑' }
      };
      const s = ctx.parseStation(el);
      assert.equal(s.type, 'formosa');
    });

    it('identifies unknown brands as other', () => {
      const el = {
        id: 789,
        lat: 25.0,
        lon: 121.5,
        tags: { name: 'Some Gas Station' }
      };
      const s = ctx.parseStation(el);
      assert.equal(s.type, 'other');
    });

    it('handles missing tags', () => {
      const el = { id: 100, lat: 25.0, lon: 121.5 };
      const s = ctx.parseStation(el);
      assert.equal(s.type, 'other');
      assert.ok(s.name);
    });

    it('calculates distance when userLocation is set', () => {
      vm.runInContext('userLocation = { lat: 25.033, lng: 121.565 };', ctx);
      const el = {
        id: 123,
        lat: 25.034,
        lon: 121.565,
        tags: { name: 'Test Station' }
      };
      const s = ctx.parseStation(el);
      assert.ok(s.distance != null);
      assert.ok(s.distance > 0);
    });
  });

  // ========== getPriceShareText ==========

  describe('getPriceShareText()', () => {
    it('returns empty when no priceData', () => {
      assert.equal(ctx.getPriceShareText(), '');
    });

    it('returns formatted English text with priceData', () => {
      vm.runInContext('priceData = DEMO_PRICES;', ctx);
      const text = ctx.getPriceShareText();
      assert.ok(text.includes('Taiwan CPC Oil Prices'));
      assert.ok(text.includes('92 Unleaded'));
      assert.ok(text.includes('95 Unleaded'));
      assert.ok(text.includes('98 Unleaded'));
      assert.ok(text.includes('Diesel'));
    });

    it('returns Chinese text when isZh=true', () => {
      vm.runInContext('priceData = DEMO_PRICES; isZh = true;', ctx);
      const text = ctx.getPriceShareText();
      assert.ok(text.includes('台灣中油油價'));
      assert.ok(text.includes('92無鉛汽油'));
    });
  });

  // ========== getNavigationHtml ==========

  describe('getNavigationHtml()', () => {
    it('returns Google Maps and Apple Maps links', () => {
      const html = ctx.getNavigationHtml(25.033, 121.565);
      assert.ok(html.includes('google.com/maps'));
      assert.ok(html.includes('maps.apple.com'));
      assert.ok(html.includes('25.033'));
      assert.ok(html.includes('121.565'));
    });
  });

  // ========== Language Toggle ==========

  describe('Language', () => {
    it('starts in English for en-US browser', () => {
      assert.equal(ctx.isZh, false);
    });

    it('starts in Chinese for zh-TW browser', () => {
      const c = makeCtx({ navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0', geolocation: { getCurrentPosition() {} } } });
      assert.equal(c.isZh, true);
    });

    it('toggleLang flips isZh', () => {
      assert.equal(ctx.isZh, false);
      ctx.toggleLang();
      assert.equal(vm.runInContext('isZh', ctx), true);
      ctx.toggleLang();
      assert.equal(vm.runInContext('isZh', ctx), false);
    });

    it('toggleLang saves to localStorage', () => {
      ctx.toggleLang();
      assert.equal(ctx.localStorage.getItem('ubike-lang'), 'zh');
      ctx.toggleLang();
      assert.equal(ctx.localStorage.getItem('ubike-lang'), 'en');
    });
  });

  // ========== loadPrices (demo mode) ==========

  describe('loadPrices() - demo mode', () => {
    it('loads demo data when WORKER_URL is empty', async () => {
      await ctx.loadPrices();
      const pd = vm.runInContext('priceData', ctx);
      assert.ok(pd);
      assert.equal(pd.products.length, 4);
      assert.equal(vm.runInContext('isDemo', ctx), true);
    });
  });
});
