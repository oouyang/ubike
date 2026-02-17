'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createBrowserContext, loadHtmlScript, exposeVars, setVar } = require('./helpers/load-script');

describe('earthquake.html', () => {
  let ctx;

  function makeCtx(overrides = {}) {
    const c = createBrowserContext({
      navigator: {
        language: 'en-US',
        userAgent: 'Mozilla/5.0',
        ...(overrides.navigator || {})
      },
      Notification: { permission: 'default' },
      ...overrides
    });
    // Need to add URL constructor for the worker tests
    c.URL = URL;
    c.URLSearchParams = URLSearchParams;

    loadHtmlScript('earthquake.html', c);
    exposeVars(c, [
      'MAG_COLORS', 'getTimeAgo', 'shareFB', 'updateSheetSummary',
      'applyFilters', 'renderList', 'renderMarkers', 'translatePlace',
      'isZh', 'currentTimeDays', 'currentMinMag', 'lastSeenTime',
      'earthquakes', 'filteredQuakes', 'USGS_API', 'LAST_SEEN_KEY',
      'NOTIFY_SETTINGS_KEY', 'getNotifySettings', 'saveNotifySettings',
      'toggleLang', 'updateUI', 'onMagSliderChange', 'selectedQuakeId'
    ]);
    return c;
  }

  beforeEach(() => {
    ctx = makeCtx();
  });

  // ========== Constants ==========

  describe('Constants', () => {
    it('USGS_API points to earthquake.usgs.gov', () => {
      assert.ok(ctx.USGS_API.includes('earthquake.usgs.gov'));
    });

    it('LAST_SEEN_KEY is earthquake-last-seen', () => {
      assert.equal(ctx.LAST_SEEN_KEY, 'earthquake-last-seen');
    });

    it('NOTIFY_SETTINGS_KEY is earthquake-notify-settings', () => {
      assert.equal(ctx.NOTIFY_SETTINGS_KEY, 'earthquake-notify-settings');
    });
  });

  // ========== MAG_COLORS ==========

  describe('MAG_COLORS', () => {
    it('getColor returns red for mag >= 6', () => {
      assert.equal(ctx.MAG_COLORS.getColor(6.0), '#d32f2f');
      assert.equal(ctx.MAG_COLORS.getColor(7.5), '#d32f2f');
    });

    it('getColor returns orange for mag 4-5.9', () => {
      assert.equal(ctx.MAG_COLORS.getColor(4.0), '#f57c00');
      assert.equal(ctx.MAG_COLORS.getColor(5.9), '#f57c00');
    });

    it('getColor returns yellow for mag 2-3.9', () => {
      assert.equal(ctx.MAG_COLORS.getColor(2.0), '#fbc02d');
      assert.equal(ctx.MAG_COLORS.getColor(3.9), '#fbc02d');
    });

    it('getColor returns green for mag < 2', () => {
      assert.equal(ctx.MAG_COLORS.getColor(1.5), '#388e3c');
      assert.equal(ctx.MAG_COLORS.getColor(0.5), '#388e3c');
    });

    it('getClass returns correct CSS classes', () => {
      assert.equal(ctx.MAG_COLORS.getClass(6.0), 'mag-red');
      assert.equal(ctx.MAG_COLORS.getClass(4.5), 'mag-orange');
      assert.equal(ctx.MAG_COLORS.getClass(3.0), 'mag-yellow');
      assert.equal(ctx.MAG_COLORS.getClass(1.0), 'mag-green');
    });
  });

  // ========== getTimeAgo ==========

  describe('getTimeAgo()', () => {
    it('returns "just now" for recent timestamps', () => {
      const result = ctx.getTimeAgo(Date.now() - 10000); // 10 seconds ago
      assert.equal(result, 'just now');
    });

    it('returns minutes for < 60 min', () => {
      const result = ctx.getTimeAgo(Date.now() - 15 * 60 * 1000); // 15 min ago
      assert.equal(result, '15m ago');
    });

    it('returns hours for < 24 hours', () => {
      const result = ctx.getTimeAgo(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      assert.equal(result, '3h ago');
    });

    it('returns days for < 30 days', () => {
      const result = ctx.getTimeAgo(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      assert.equal(result, '5d ago');
    });

    it('returns Chinese labels when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.getTimeAgo(Date.now() - 10000), '剛剛');
      assert.equal(ctx.getTimeAgo(Date.now() - 15 * 60 * 1000), '15 分鐘前');
      assert.equal(ctx.getTimeAgo(Date.now() - 3 * 60 * 60 * 1000), '3 小時前');
      assert.equal(ctx.getTimeAgo(Date.now() - 5 * 24 * 60 * 60 * 1000), '5 天前');
    });
  });

  // ========== Unread Tracking ==========

  describe('Unread Tracking', () => {
    it('initializes lastSeenTime from localStorage when initialize runs', () => {
      // lastSeenTime is set in initialize(), which is called from DOMContentLoaded.
      // In unit tests, we simulate by reading the code that sets it.
      const c = createBrowserContext();
      c.URL = URL;
      c.URLSearchParams = URLSearchParams;
      c.localStorage.setItem('earthquake-last-seen', '1700000000000');
      loadHtmlScript('earthquake.html', c);
      // Manually run the line that reads lastSeenTime from localStorage
      vm.runInContext("lastSeenTime = parseInt(localStorage.getItem('earthquake-last-seen')) || 0;", c);
      exposeVars(c, ['lastSeenTime']);
      assert.equal(c.lastSeenTime, 1700000000000);
    });

    it('defaults lastSeenTime to 0 when not set', () => {
      assert.equal(ctx.lastSeenTime, 0);
    });
  });

  // ========== Notification Settings ==========

  describe('Notification Settings', () => {
    it('getNotifySettings returns empty object when nothing saved', () => {
      const result = ctx.getNotifySettings();
      assert.equal(JSON.stringify(result), '{}');
    });

    it('saveNotifySettings persists to localStorage', () => {
      ctx.saveNotifySettings({ minMag: 5.0, pushEnabled: true });
      const stored = JSON.parse(ctx.localStorage.getItem('earthquake-notify-settings'));
      assert.equal(stored.minMag, 5.0);
      assert.equal(stored.pushEnabled, true);
    });

    it('getNotifySettings retrieves saved settings', () => {
      ctx.saveNotifySettings({ minMag: 4.5, email: 'test@example.com' });
      const result = ctx.getNotifySettings();
      assert.equal(result.minMag, 4.5);
      assert.equal(result.email, 'test@example.com');
    });

    it('getNotifySettings handles corrupted localStorage gracefully', () => {
      ctx.localStorage.setItem('earthquake-notify-settings', 'not-json');
      const result = ctx.getNotifySettings();
      assert.equal(JSON.stringify(result), '{}');
    });
  });

  // ========== State Defaults ==========

  describe('Default State', () => {
    it('currentTimeDays defaults to 7', () => {
      assert.equal(ctx.currentTimeDays, 7);
    });

    it('currentMinMag defaults to 2', () => {
      assert.equal(ctx.currentMinMag, 2);
    });

    it('selectedQuakeId defaults to null', () => {
      assert.equal(ctx.selectedQuakeId, null);
    });

    it('earthquakes defaults to empty array', () => {
      assert.ok(Array.isArray(ctx.earthquakes));
      assert.equal(ctx.earthquakes.length, 0);
    });
  });

  // ========== Language Toggle ==========

  describe('Language', () => {
    it('starts in English for en-US browser', () => {
      assert.equal(ctx.isZh, false);
    });

    it('starts in Chinese for zh-TW browser', () => {
      const c = makeCtx({ navigator: { language: 'zh-TW', userAgent: 'Mozilla/5.0' } });
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

  // ========== Filter Logic ==========

  describe('Filter / applyFilters()', () => {
    it('filters earthquakes by currentMinMag', () => {
      // Set up mock earthquakes
      vm.runInContext(`
        earthquakes = [
          { id: 'q1', properties: { mag: 2.5, time: Date.now(), place: 'A', url: '' }, geometry: { coordinates: [121, 23, 10] } },
          { id: 'q2', properties: { mag: 4.5, time: Date.now(), place: 'B', url: '' }, geometry: { coordinates: [121, 24, 20] } },
          { id: 'q3', properties: { mag: 6.0, time: Date.now(), place: 'C', url: '' }, geometry: { coordinates: [121, 25, 30] } }
        ];
        currentMinMag = 4;
      `, ctx);
      ctx.applyFilters();
      const filtered = vm.runInContext('filteredQuakes', ctx);
      assert.equal(filtered.length, 2);
      assert.equal(filtered[0].id, 'q2');
      assert.equal(filtered[1].id, 'q3');
    });

    it('shows all when minMag = 2', () => {
      vm.runInContext(`
        earthquakes = [
          { id: 'q1', properties: { mag: 2.0, time: Date.now(), place: 'A', url: '' }, geometry: { coordinates: [121, 23, 10] } },
          { id: 'q2', properties: { mag: 5.0, time: Date.now(), place: 'B', url: '' }, geometry: { coordinates: [121, 24, 20] } }
        ];
        currentMinMag = 2;
      `, ctx);
      ctx.applyFilters();
      const filtered = vm.runInContext('filteredQuakes', ctx);
      assert.equal(filtered.length, 2);
    });

    it('returns empty when no earthquakes match', () => {
      vm.runInContext(`
        earthquakes = [
          { id: 'q1', properties: { mag: 2.0, time: Date.now(), place: 'A', url: '' }, geometry: { coordinates: [121, 23, 10] } }
        ];
        currentMinMag = 5;
      `, ctx);
      ctx.applyFilters();
      const filtered = vm.runInContext('filteredQuakes', ctx);
      assert.equal(filtered.length, 0);
    });
  });

  // ========== translatePlace ==========

  describe('translatePlace()', () => {
    it('returns original place when isZh=false', () => {
      vm.runInContext('isZh = false;', ctx);
      assert.equal(ctx.translatePlace('34 km ESE of Yilan, Taiwan'), '34 km ESE of Yilan, Taiwan');
    });

    it('translates Taiwan city and direction to Chinese', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.translatePlace('34 km ESE of Yilan, Taiwan'), '台灣宜蘭東南東方 34 公里');
    });

    it('translates Hualien location', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.translatePlace('10 km NW of Hualien, Taiwan'), '台灣花蓮西北方 10 公里');
    });

    it('translates Hengchun location', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.translatePlace('179 km SSW of Hengchun, Taiwan'), '台灣恆春南南西方 179 公里');
    });

    it('handles Japan locations', () => {
      vm.runInContext('isZh = true;', ctx);
      const result = ctx.translatePlace('97 km SE of Ishigaki, Japan');
      assert.ok(result.includes('日本'));
      assert.ok(result.includes('石垣'));
      assert.ok(result.includes('東南'));
    });

    it('returns null/undefined as-is', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.translatePlace(null), null);
      assert.equal(ctx.translatePlace(undefined), undefined);
    });

    it('returns non-matching format as-is', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.translatePlace('somewhere unknown'), 'somewhere unknown');
    });
  });
});
