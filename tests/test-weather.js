'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createBrowserContext, loadHtmlScript, exposeVars, setVar } = require('./helpers/load-script');

describe('weather.html', () => {
  let ctx;

  function makeCtx(overrides = {}) {
    const c = createBrowserContext({
      navigator: {
        language: 'en-US',
        userAgent: 'Mozilla/5.0',
        geolocation: { getCurrentPosition() {} },
        ...(overrides.navigator || {})
      },
      ...overrides
    });
    c.URL = URL;
    c.URLSearchParams = URLSearchParams;

    loadHtmlScript('weather.html', c);
    exposeVars(c, [
      'FORECAST_API', 'GEOCODING_API', 'CACHE_KEY', 'CACHE_TTL',
      'TAIWAN_CITIES', 'WORLD_CITIES', 'WMO_CODES', 'WIND_DIRS',
      'isZh', 'currentLocation', 'weatherData', 'worldExpanded',
      'getWeatherInfo', 'getWindDirection', 'formatUpdatedTime',
      'getDayName', 'toggleLang', 'updateUI', 'toggleWorldCities',
      'getCachedWeather', 'setCachedWeather', 'renderWeather',
      'renderCurrentWeather', 'renderForecast'
    ]);
    return c;
  }

  beforeEach(() => {
    ctx = makeCtx();
  });

  // ========== Constants ==========

  describe('Constants', () => {
    it('FORECAST_API points to open-meteo.com', () => {
      assert.ok(ctx.FORECAST_API.includes('open-meteo.com'));
    });

    it('GEOCODING_API points to geocoding-api.open-meteo.com', () => {
      assert.ok(ctx.GEOCODING_API.includes('geocoding-api.open-meteo.com'));
    });

    it('CACHE_KEY is weather-cache', () => {
      assert.equal(ctx.CACHE_KEY, 'weather-cache');
    });

    it('CACHE_TTL is 30 minutes', () => {
      assert.equal(ctx.CACHE_TTL, 30 * 60 * 1000);
    });
  });

  // ========== TAIWAN_CITIES ==========

  describe('TAIWAN_CITIES', () => {
    it('has 13 cities', () => {
      assert.equal(ctx.TAIWAN_CITIES.length, 13);
    });

    it('all cities have lat, lng, and name (en/zh)', () => {
      for (const city of ctx.TAIWAN_CITIES) {
        assert.ok(typeof city.lat === 'number', `${city.key} missing lat`);
        assert.ok(typeof city.lng === 'number', `${city.key} missing lng`);
        assert.ok(city.name.en, `${city.key} missing name.en`);
        assert.ok(city.name.zh, `${city.key} missing name.zh`);
      }
    });

    it('first city is Taipei', () => {
      assert.equal(ctx.TAIWAN_CITIES[0].key, 'taipei');
    });

    it('all latitudes are in Taiwan range (22-26)', () => {
      for (const city of ctx.TAIWAN_CITIES) {
        assert.ok(city.lat >= 22 && city.lat <= 26, `${city.key} lat ${city.lat} out of range`);
      }
    });
  });

  // ========== WORLD_CITIES ==========

  describe('WORLD_CITIES', () => {
    it('has 20 cities', () => {
      assert.equal(ctx.WORLD_CITIES.length, 20);
    });

    it('all cities have lat, lng, and bilingual names', () => {
      for (const city of ctx.WORLD_CITIES) {
        assert.ok(typeof city.lat === 'number', `${city.name.en} missing lat`);
        assert.ok(typeof city.lng === 'number', `${city.name.en} missing lng`);
        assert.ok(city.name.en, `missing name.en`);
        assert.ok(city.name.zh, `${city.name.en} missing name.zh`);
      }
    });

    it('includes Tokyo, New York, London', () => {
      const names = ctx.WORLD_CITIES.map(c => c.name.en);
      assert.ok(names.includes('Tokyo'));
      assert.ok(names.includes('New York'));
      assert.ok(names.includes('London'));
    });
  });

  // ========== WMO_CODES ==========

  describe('WMO_CODES', () => {
    it('has code 0 (clear sky)', () => {
      assert.ok(ctx.WMO_CODES[0]);
      assert.ok(ctx.WMO_CODES[0].icon);
      assert.ok(ctx.WMO_CODES[0].en);
      assert.ok(ctx.WMO_CODES[0].zh);
    });

    it('has thunderstorm code 95', () => {
      assert.ok(ctx.WMO_CODES[95]);
      assert.ok(ctx.WMO_CODES[95].en.toLowerCase().includes('thunderstorm'));
    });

    it('all codes have icon, en, zh fields', () => {
      for (const [code, info] of Object.entries(ctx.WMO_CODES)) {
        assert.ok(info.icon, `code ${code} missing icon`);
        assert.ok(info.en, `code ${code} missing en`);
        assert.ok(info.zh, `code ${code} missing zh`);
      }
    });
  });

  // ========== getWeatherInfo ==========

  describe('getWeatherInfo()', () => {
    it('returns correct info for code 0', () => {
      const info = ctx.getWeatherInfo(0);
      assert.equal(info.en, 'Clear sky');
    });

    it('returns fallback for unknown code', () => {
      const info = ctx.getWeatherInfo(999);
      assert.ok(info.icon);
      assert.ok(info.en);
    });
  });

  // ========== getWindDirection ==========

  describe('getWindDirection()', () => {
    it('returns N for 0 degrees', () => {
      const dir = ctx.getWindDirection(0);
      assert.equal(dir, 'N');
    });

    it('returns E for 90 degrees', () => {
      const dir = ctx.getWindDirection(90);
      assert.equal(dir, 'E');
    });

    it('returns S for 180 degrees', () => {
      const dir = ctx.getWindDirection(180);
      assert.equal(dir, 'S');
    });

    it('returns W for 270 degrees', () => {
      const dir = ctx.getWindDirection(270);
      assert.equal(dir, 'W');
    });

    it('returns Chinese directions when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.getWindDirection(0), '北');
      assert.equal(ctx.getWindDirection(90), '東');
      assert.equal(ctx.getWindDirection(180), '南');
      assert.equal(ctx.getWindDirection(270), '西');
    });

    it('handles NE (45 degrees)', () => {
      const dir = ctx.getWindDirection(45);
      assert.equal(dir, 'NE');
    });
  });

  // ========== formatUpdatedTime ==========

  describe('formatUpdatedTime()', () => {
    it('formats ISO string to HH:MM', () => {
      const result = ctx.formatUpdatedTime('2026-02-17T14:30');
      assert.ok(result.includes('14:30'));
      assert.ok(result.includes('Updated'));
    });

    it('returns Chinese prefix when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      const result = ctx.formatUpdatedTime('2026-02-17T08:00');
      assert.ok(result.includes('更新'));
      assert.ok(result.includes('08:00'));
    });

    it('returns a string for any input', () => {
      // formatUpdatedTime handles edge cases via try/catch
      const result = ctx.formatUpdatedTime('invalid-date');
      assert.ok(typeof result === 'string');
    });
  });

  // ========== getDayName ==========

  describe('getDayName()', () => {
    it('returns "Today" for index 0', () => {
      assert.equal(ctx.getDayName('2026-02-17', 0), 'Today');
    });

    it('returns "Tomorrow" for index 1', () => {
      assert.equal(ctx.getDayName('2026-02-18', 1), 'Tomorrow');
    });

    it('returns Chinese day names when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.getDayName('2026-02-17', 0), '今天');
      assert.equal(ctx.getDayName('2026-02-18', 1), '明天');
    });

    it('returns weekday name for index >= 2', () => {
      const result = ctx.getDayName('2026-02-19', 2); // Thursday
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
    });
  });

  // ========== Default State ==========

  describe('Default State', () => {
    it('currentLocation defaults to null', () => {
      assert.equal(ctx.currentLocation, null);
    });

    it('weatherData defaults to null', () => {
      assert.equal(ctx.weatherData, null);
    });

    it('worldExpanded defaults to false', () => {
      assert.equal(ctx.worldExpanded, false);
    });
  });

  // ========== Caching ==========

  describe('Caching', () => {
    it('getCachedWeather returns null when no cache', () => {
      assert.equal(ctx.getCachedWeather(), null);
    });

    it('setCachedWeather stores and getCachedWeather retrieves', () => {
      const loc = { lat: 25.0, lng: 121.5, name: 'Test' };
      const data = { current: { temperature_2m: 22 } };
      ctx.setCachedWeather(loc, data);
      const cached = ctx.getCachedWeather();
      assert.ok(cached);
      assert.equal(cached.location.name, 'Test');
      assert.equal(cached.data.current.temperature_2m, 22);
    });

    it('getCachedWeather returns null for expired cache', () => {
      const expired = JSON.stringify({
        timestamp: Date.now() - 31 * 60 * 1000,
        location: { lat: 25, lng: 121, name: 'Old' },
        data: {}
      });
      ctx.localStorage.setItem('weather-cache', expired);
      assert.equal(ctx.getCachedWeather(), null);
    });

    it('getCachedWeather handles corrupted JSON', () => {
      ctx.localStorage.setItem('weather-cache', 'not-json');
      assert.equal(ctx.getCachedWeather(), null);
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
    });

    it('toggleLang saves to localStorage', () => {
      ctx.toggleLang();
      assert.equal(ctx.localStorage.getItem('ubike-lang'), 'zh');
      ctx.toggleLang();
      assert.equal(ctx.localStorage.getItem('ubike-lang'), 'en');
    });
  });

  // ========== WIND_DIRS ==========

  describe('WIND_DIRS', () => {
    it('has 16 English directions', () => {
      assert.equal(ctx.WIND_DIRS.en.length, 16);
    });

    it('has 16 Chinese directions', () => {
      assert.equal(ctx.WIND_DIRS.zh.length, 16);
    });

    it('first direction is N/北', () => {
      assert.equal(ctx.WIND_DIRS.en[0], 'N');
      assert.equal(ctx.WIND_DIRS.zh[0], '北');
    });
  });
});
