'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserContext, loadJsFile } = require('./helpers/load-script');

describe('js/common.js', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    loadJsFile('js/common.js', ctx);
  });

  // ========== Constants ==========

  describe('CITIES', () => {
    it('has 14 entries (all + 13 cities)', () => {
      const keys = Object.keys(ctx.window.CITIES);
      assert.equal(keys.length, 14);
      assert.ok(keys.includes('all'));
      assert.ok(keys.includes('taipei'));
      assert.ok(keys.includes('kaohsiung'));
    });

    it('each city has name.en, name.zh, areaCode, center', () => {
      for (const [key, city] of Object.entries(ctx.window.CITIES)) {
        assert.ok(city.name.en, `${key} missing name.en`);
        assert.ok(city.name.zh, `${key} missing name.zh`);
        assert.ok(Array.isArray(city.center), `${key} missing center`);
        assert.equal(city.center.length, 2, `${key} center should have 2 elements`);
      }
    });

    it('"all" city has null areaCode', () => {
      assert.equal(ctx.window.CITIES.all.areaCode, null);
    });
  });

  describe('STORAGE_KEYS', () => {
    it('has expected keys', () => {
      const sk = ctx.window.STORAGE_KEYS;
      assert.ok(sk.LANG);
      assert.ok(sk.CITY);
      assert.ok(sk.BUS_CITY);
      assert.ok(sk.MRT_SYSTEM);
    });
  });

  // ========== deg2rad ==========

  describe('deg2rad()', () => {
    it('converts 0 degrees to 0 radians', () => {
      assert.equal(ctx.window.deg2rad(0), 0);
    });

    it('converts 180 degrees to PI', () => {
      assert.ok(Math.abs(ctx.window.deg2rad(180) - Math.PI) < 1e-10);
    });

    it('converts 90 degrees to PI/2', () => {
      assert.ok(Math.abs(ctx.window.deg2rad(90) - Math.PI / 2) < 1e-10);
    });

    it('converts 360 degrees to 2*PI', () => {
      assert.ok(Math.abs(ctx.window.deg2rad(360) - 2 * Math.PI) < 1e-10);
    });
  });

  // ========== getDistanceInMeters ==========

  describe('getDistanceInMeters()', () => {
    it('returns 0 for same point', () => {
      const d = ctx.window.getDistanceInMeters(25.0330, 121.5654, 25.0330, 121.5654);
      assert.equal(d, 0);
    });

    it('calculates Taipei to Kaohsiung ~300km', () => {
      // Taipei ~25.0330, 121.5654 → Kaohsiung ~22.6273, 120.3014
      const d = ctx.window.getDistanceInMeters(25.0330, 121.5654, 22.6273, 120.3014);
      assert.ok(d > 280000 && d < 320000, `Expected ~300km, got ${d / 1000}km`);
    });

    it('is symmetric', () => {
      const d1 = ctx.window.getDistanceInMeters(25.0, 121.5, 22.6, 120.3);
      const d2 = ctx.window.getDistanceInMeters(22.6, 120.3, 25.0, 121.5);
      assert.ok(Math.abs(d1 - d2) < 0.01);
    });
  });

  // ========== formatDistance ==========

  describe('formatDistance()', () => {
    it('shows meters when < 1000', () => {
      assert.equal(ctx.window.formatDistance(500), '500 m');
    });

    it('shows km when >= 1000', () => {
      assert.equal(ctx.window.formatDistance(1500), '1.5 km');
    });

    it('rounds meters to nearest integer', () => {
      assert.equal(ctx.window.formatDistance(123.7), '124 m');
    });

    it('uses Chinese units when isZh=true', () => {
      assert.equal(ctx.window.formatDistance(500, true), '500 公尺');
      assert.equal(ctx.window.formatDistance(1500, true), '1.5 公里');
    });
  });

  // ========== formatTime ==========

  describe('formatTime()', () => {
    it('formats midnight as 00:00', () => {
      assert.equal(ctx.window.formatTime(0), '00:00');
    });

    it('formats noon as 12:00', () => {
      assert.equal(ctx.window.formatTime(720), '12:00');
    });

    it('formats 8:30 as 08:30', () => {
      assert.equal(ctx.window.formatTime(510), '08:30');
    });

    it('pads single-digit hours and minutes', () => {
      assert.equal(ctx.window.formatTime(65), '01:05');
    });

    it('wraps past 24 hours', () => {
      assert.equal(ctx.window.formatTime(1440), '00:00');
      assert.equal(ctx.window.formatTime(1500), '01:00');
    });
  });

  // ========== formatDuration ==========

  describe('formatDuration()', () => {
    it('shows minutes-only for < 60', () => {
      assert.equal(ctx.window.formatDuration(45), '45 min');
    });

    it('shows hours-only for exact hours', () => {
      assert.equal(ctx.window.formatDuration(120), '2h');
    });

    it('shows hours+minutes for mixed', () => {
      assert.equal(ctx.window.formatDuration(90), '1h30m');
    });

    it('shows Chinese labels when isZh=true', () => {
      assert.equal(ctx.window.formatDuration(45, true), '45分鐘');
      assert.equal(ctx.window.formatDuration(120, true), '2小時');
      assert.equal(ctx.window.formatDuration(90, true), '1時30分');
    });
  });

  // ========== normalizeStation ==========

  describe('normalizeStation()', () => {
    it('transforms API shape to app schema', () => {
      const raw = {
        station_no: 'S001',
        name_tw: '台北車站',
        name_en: 'Taipei Station',
        district_tw: '中正區',
        district_en: 'Zhongzheng',
        address_tw: '北平西路',
        address_en: 'Beiping W Rd',
        lat: '25.0478',
        lng: '121.5170',
        available_spaces: '10',
        empty_spaces: '5',
        area_code: '00',
        status: 1,
        parking_spaces: '28',
        available_spaces_detail: { yb1: 0, yb2: 8, eyb: 2 }
      };

      const result = ctx.window.normalizeStation(raw);
      assert.equal(result.sno, 'S001');
      assert.equal(result.sna, '台北車站');
      assert.equal(result.snaen, 'Taipei Station');
      assert.equal(result.latitude, 25.0478);
      assert.equal(result.longitude, 121.517);
      assert.equal(result.available_rent_bikes, 10);
      assert.equal(result.available_return_bikes, 5);
      assert.equal(result.city, 'taipei');
      assert.equal(result.areaCode, '00');
      assert.equal(result.ebikes, 2);
      assert.equal(result.totalDocks, 28);
      assert.equal(result.status, 1);
    });

    it('falls back to tw names when en names missing', () => {
      const raw = {
        station_no: 'S002',
        name_tw: '測試站',
        district_tw: '區',
        address_tw: '路',
        lat: '24.0',
        lng: '121.0',
        available_spaces: '0',
        empty_spaces: '0',
        area_code: '99'
      };

      const result = ctx.window.normalizeStation(raw);
      assert.equal(result.snaen, '測試站');
    });

    it('defaults ebikes to 0 when available_spaces_detail is missing', () => {
      const raw = {
        station_no: 'S003',
        name_tw: '無電輔站',
        district_tw: '區',
        address_tw: '路',
        lat: '24.0',
        lng: '121.0',
        available_spaces: '5',
        empty_spaces: '3',
        area_code: '00',
        status: 1
      };

      const result = ctx.window.normalizeStation(raw);
      assert.equal(result.ebikes, 0);
      assert.equal(result.totalDocks, 0);
    });

    it('parses ebikes from available_spaces_detail.eyb', () => {
      const raw = {
        station_no: 'S004',
        name_tw: '電輔站',
        district_tw: '區',
        address_tw: '路',
        lat: '24.0',
        lng: '121.0',
        available_spaces: '15',
        empty_spaces: '10',
        area_code: '00',
        status: 1,
        parking_spaces: '30',
        available_spaces_detail: { yb1: 0, yb2: 10, eyb: 5 }
      };

      const result = ctx.window.normalizeStation(raw);
      assert.equal(result.ebikes, 5);
      assert.equal(result.totalDocks, 30);
    });

    it('preserves status field from raw data', () => {
      const raw = {
        station_no: 'S005',
        name_tw: '暫停站',
        district_tw: '區',
        address_tw: '路',
        lat: '24.0',
        lng: '121.0',
        available_spaces: '0',
        empty_spaces: '0',
        area_code: '00',
        status: 2
      };

      const result = ctx.window.normalizeStation(raw);
      assert.equal(result.status, 2);
    });
  });

  // ========== getMarkerType ==========

  describe('getMarkerType()', () => {
    it('returns "ok" when bikes and slots both available', () => {
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 5, available_return_bikes: 5, status: 1 }), 'ok');
    });

    it('returns "empty" when no bikes', () => {
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 0, available_return_bikes: 5, status: 1 }), 'empty');
    });

    it('returns "full" when no slots', () => {
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 5, available_return_bikes: 0, status: 1 }), 'full');
    });

    it('returns "empty" when both zero (empty takes priority)', () => {
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 0, available_return_bikes: 0, status: 1 }), 'empty');
    });

    it('returns "suspended" when status is 2', () => {
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 5, available_return_bikes: 5, status: 2 }), 'suspended');
    });

    it('returns "suspended" even when bikes/slots are zero', () => {
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 0, available_return_bikes: 0, status: 2 }), 'suspended');
    });

    it('suspended takes priority over empty/full', () => {
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 0, available_return_bikes: 5, status: 2 }), 'suspended');
      assert.equal(ctx.window.getMarkerType({ available_rent_bikes: 5, available_return_bikes: 0, status: 2 }), 'suspended');
    });
  });

  // ========== getNavigationHtml ==========

  describe('getNavigationHtml()', () => {
    it('contains Google Maps URL', () => {
      const html = ctx.window.getNavigationHtml(25.0, 121.5);
      assert.ok(html.includes('google.com/maps'));
      assert.ok(html.includes('25'));
      assert.ok(html.includes('121.5'));
    });

    it('contains Apple Maps URL', () => {
      const html = ctx.window.getNavigationHtml(25.0, 121.5);
      assert.ok(html.includes('maps.apple.com'));
    });

    it('uses Chinese labels when isZh=true', () => {
      const html = ctx.window.getNavigationHtml(25.0, 121.5, true);
      assert.ok(html.includes('Google導航'));
      assert.ok(html.includes('Apple導航'));
    });

    it('uses English labels when isZh=false', () => {
      const html = ctx.window.getNavigationHtml(25.0, 121.5, false);
      assert.ok(html.includes('Google Maps'));
      assert.ok(html.includes('Apple Maps'));
    });
  });

  // ========== detectLanguage / saveLanguage ==========

  describe('detectLanguage()', () => {
    it('returns saved language from localStorage', () => {
      ctx.localStorage.setItem('ubike-lang', 'zh');
      // Re-load to pick up from localStorage
      const ctx2 = createBrowserContext();
      ctx2.localStorage.setItem('ubike-lang', 'zh');
      loadJsFile('js/common.js', ctx2);
      assert.equal(ctx2.window.detectLanguage(), 'zh');
    });

    it('returns "en" for English browser when no saved preference', () => {
      const ctx2 = createBrowserContext({ navigator: { language: 'en-US' } });
      loadJsFile('js/common.js', ctx2);
      assert.equal(ctx2.window.detectLanguage(), 'en');
    });

    it('returns "zh" for zh-TW browser when no saved preference', () => {
      const ctx2 = createBrowserContext({ navigator: { language: 'zh-TW' } });
      loadJsFile('js/common.js', ctx2);
      assert.equal(ctx2.window.detectLanguage(), 'zh');
    });
  });

  describe('saveLanguage()', () => {
    it('persists language to localStorage', () => {
      ctx.window.saveLanguage('zh');
      assert.equal(ctx.localStorage.getItem('ubike-lang'), 'zh');
    });
  });

  // ========== getCurrentMinutes ==========

  describe('getCurrentMinutes()', () => {
    it('returns minutes since midnight based on Date', () => {
      const origDate = ctx.Date;
      ctx.Date = class extends origDate {
        constructor() { super('2025-01-15T08:30:00'); }
      };
      // Reload to capture mocked Date
      const ctx2 = createBrowserContext();
      const MockDate = class {
        getHours() { return 8; }
        getMinutes() { return 30; }
      };
      ctx2.Date = MockDate;
      loadJsFile('js/common.js', ctx2);
      assert.equal(ctx2.window.getCurrentMinutes(), 510);
    });
  });

  // ========== getCountdown ==========

  describe('getCountdown()', () => {
    it('returns "Departing" when diff < 1 min', () => {
      // Mock getCurrentMinutes by setting up context where it returns 510
      const ctx2 = createBrowserContext();
      const MockDate = class {
        getHours() { return 8; }
        getMinutes() { return 30; }
      };
      ctx2.Date = MockDate;
      loadJsFile('js/common.js', ctx2);

      const result = ctx2.window.getCountdown(510, false);
      assert.equal(result, 'Departing');
    });

    it('returns minutes for < 60 min diff', () => {
      const ctx2 = createBrowserContext();
      const MockDate = class {
        getHours() { return 8; }
        getMinutes() { return 30; }
      };
      ctx2.Date = MockDate;
      loadJsFile('js/common.js', ctx2);

      const result = ctx2.window.getCountdown(540, false);
      assert.equal(result, '30 min');
    });

    it('returns hours+minutes for >= 60 min diff', () => {
      const ctx2 = createBrowserContext();
      const MockDate = class {
        getHours() { return 8; }
        getMinutes() { return 30; }
      };
      ctx2.Date = MockDate;
      loadJsFile('js/common.js', ctx2);

      const result = ctx2.window.getCountdown(600, false);
      assert.equal(result, '1h 30m');
    });

    it('uses Chinese labels when isZh=true', () => {
      const ctx2 = createBrowserContext();
      const MockDate = class {
        getHours() { return 8; }
        getMinutes() { return 30; }
      };
      ctx2.Date = MockDate;
      loadJsFile('js/common.js', ctx2);

      assert.equal(ctx2.window.getCountdown(510, true), '即將發車');
      assert.equal(ctx2.window.getCountdown(540, true), '30 分鐘');
      assert.equal(ctx2.window.getCountdown(600, true), '1時 30分');
    });
  });

  // ========== YOUBIKE_FARES ==========

  describe('YOUBIKE_FARES', () => {
    it('has _base with yb2 and yb2e tiers', () => {
      const fares = ctx.window.YOUBIKE_FARES;
      assert.ok(fares._base, 'missing _base');
      assert.ok(Array.isArray(fares._base.yb2), '_base.yb2 should be an array');
      assert.ok(Array.isArray(fares._base.yb2e), '_base.yb2e should be an array');
      assert.equal(fares._base.yb2.length, 3);
      assert.equal(fares._base.yb2e.length, 2);
    });

    it('has entry for every city in CITIES except "all"', () => {
      const fares = ctx.window.YOUBIKE_FARES;
      const cities = ctx.window.CITIES;
      for (const key of Object.keys(cities)) {
        if (key === 'all') continue;
        assert.ok(fares[key], `missing fare entry for city: ${key}`);
      }
    });

    it('each city has free30 boolean and tpass object or null', () => {
      const fares = ctx.window.YOUBIKE_FARES;
      const cities = ctx.window.CITIES;
      for (const key of Object.keys(cities)) {
        if (key === 'all') continue;
        const f = fares[key];
        assert.equal(typeof f.free30, 'boolean', `${key}.free30 should be boolean`);
        assert.equal(typeof f.hasEbike, 'boolean', `${key}.hasEbike should be boolean`);
        if (f.tpass !== null) {
          assert.ok(f.tpass.en, `${key}.tpass.en should exist`);
          assert.ok(f.tpass.zh, `${key}.tpass.zh should exist`);
        }
      }
    });

    it('taipei has free30=true, hasEbike=true, tpass defined', () => {
      const f = ctx.window.YOUBIKE_FARES.taipei;
      assert.equal(f.free30, true);
      assert.equal(f.hasEbike, true);
      assert.ok(f.tpass);
      assert.ok(f.tpass.zh.includes('1,200'));
    });

    it('taitung has free30=false, tpass=null', () => {
      const f = ctx.window.YOUBIKE_FARES.taitung;
      assert.equal(f.free30, false);
      assert.equal(f.hasEbike, false);
      assert.equal(f.tpass, null);
    });
  });

  // ========== getLocalizedText ==========

  describe('getLocalizedText()', () => {
    it('returns English text by default', () => {
      assert.equal(ctx.window.getLocalizedText({ en: 'Hello', zh: '你好' }), 'Hello');
    });

    it('returns Chinese text when isZh=true', () => {
      assert.equal(ctx.window.getLocalizedText({ en: 'Hello', zh: '你好' }, true), '你好');
    });

    it('returns empty string for null/undefined', () => {
      assert.equal(ctx.window.getLocalizedText(null), '');
      assert.equal(ctx.window.getLocalizedText(undefined), '');
    });
  });
});
