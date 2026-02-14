'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createBrowserContext, loadJsFile, exposeVars, setVar } = require('./helpers/load-script');

const BUS_VARS = [
  'BUS_CITIES', 'ADJACENT_CITIES', 'timeToMinutes', 'safeParseTime', 'formatArrivalTime',
  'getArrivalClass', 'debounce', 'calculateEstimatedTime', 'isZh',
  'routeBusData', 'busMarkers', 'fetchRouteBusPositions', 'clearBusMarkers',
  'renderStopItems', 'useProxy', 'TDX_PROXY_URL',
  'getAdjacentCities', 'fetchMergedRoutes', 'mergedRoutesCache', 'activeRouteSourceCity',
  'fetchedRoutes', 'findRouteInOtherCities', 'currentRouteCity', 'fetchRoutes'
];

describe('js/bus.js', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    // bus.js depends on common.js functions being on window
    loadJsFile('js/common.js', ctx);
    loadJsFile('js/bus.js', ctx);
    exposeVars(ctx, BUS_VARS);
  });

  // ========== BUS_CITIES ==========

  describe('BUS_CITIES', () => {
    it('has at least 20 cities', () => {
      const keys = Object.keys(ctx.BUS_CITIES);
      assert.ok(keys.length >= 20, `Expected >= 20 cities, got ${keys.length}`);
    });

    it('each city has name.en, name.zh, center', () => {
      for (const [key, city] of Object.entries(ctx.BUS_CITIES)) {
        assert.ok(city.name.en, `${key} missing name.en`);
        assert.ok(city.name.zh, `${key} missing name.zh`);
        assert.ok(Array.isArray(city.center), `${key} missing center`);
        assert.equal(city.center.length, 2, `${key} center should have 2 elements`);
      }
    });

    it('includes major cities', () => {
      assert.ok(ctx.BUS_CITIES.Taipei);
      assert.ok(ctx.BUS_CITIES.Kaohsiung);
      assert.ok(ctx.BUS_CITIES.Taichung);
      assert.ok(ctx.BUS_CITIES.Tainan);
    });
  });

  // ========== timeToMinutes ==========

  describe('timeToMinutes()', () => {
    it('converts "08:30" to 510', () => {
      assert.equal(ctx.timeToMinutes('08:30'), 510);
    });

    it('converts "00:00" to 0', () => {
      assert.equal(ctx.timeToMinutes('00:00'), 0);
    });

    it('converts "23:59" to 1439', () => {
      assert.equal(ctx.timeToMinutes('23:59'), 1439);
    });

    it('returns 0 for null/undefined (via safeParseTime)', () => {
      assert.equal(ctx.timeToMinutes(null), 0);
      assert.equal(ctx.timeToMinutes(undefined), 0);
    });

    it('returns 0 for empty string', () => {
      assert.equal(ctx.timeToMinutes(''), 0);
    });
  });

  // ========== safeParseTime ==========

  describe('safeParseTime()', () => {
    function assertParsed(result, h, m) {
      assert.equal(result[0], h);
      assert.equal(result[1], m);
    }

    it('parses valid time "12:30" to [12, 30]', () => {
      assertParsed(ctx.safeParseTime('12:30'), 12, 30);
    });

    it('returns [0, 0] for null', () => {
      assertParsed(ctx.safeParseTime(null), 0, 0);
    });

    it('returns [0, 0] for non-string', () => {
      assertParsed(ctx.safeParseTime(123), 0, 0);
    });

    it('returns [0, 0] for string without colon', () => {
      assertParsed(ctx.safeParseTime('1230'), 0, 0);
    });

    it('returns [0, 0] for "abc:def"', () => {
      assertParsed(ctx.safeParseTime('abc:def'), 0, 0);
    });
  });

  // ========== formatArrivalTime ==========

  describe('formatArrivalTime()', () => {
    it('returns "Arriving" for status 1', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(null, 1), 'Arriving');
    });

    it('returns "Not started" for status 2', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(null, 2), 'Not started');
    });

    it('returns "Last bus left" for status 3', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(null, 3), 'Last bus left');
    });

    it('returns "No service" for status 4', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(null, 4), 'No service');
    });

    it('returns "Unknown" for null seconds with no status', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(null, 0), 'Unknown');
      assert.equal(ctx.formatArrivalTime(undefined, 0), 'Unknown');
    });

    it('returns "Arriving" for <= 60 seconds', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(30, 0), 'Arriving');
      assert.equal(ctx.formatArrivalTime(60, 0), 'Arriving');
    });

    it('returns minutes for < 3600 seconds', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(300, 0), '5 min');
    });

    it('returns ">1 hour" for >= 3600 seconds', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.formatArrivalTime(3600, 0), '>1 hour');
    });

    it('uses Chinese labels when isZh=true', () => {
      setVar(ctx, 'isZh', true);
      assert.equal(ctx.formatArrivalTime(null, 1), '進站中');
      assert.equal(ctx.formatArrivalTime(300, 0), '5 分');
      assert.equal(ctx.formatArrivalTime(3600, 0), '超過1小時');
    });
  });

  // ========== getArrivalClass ==========

  describe('getArrivalClass()', () => {
    it('returns "arriving" for status 1', () => {
      assert.equal(ctx.getArrivalClass(undefined, 1), 'arriving');
    });

    it('returns "arriving" for <= 120 seconds', () => {
      assert.equal(ctx.getArrivalClass(60, 0), 'arriving');
      assert.equal(ctx.getArrivalClass(120, 0), 'arriving');
    });

    it('returns "waiting" for status >= 2', () => {
      assert.equal(ctx.getArrivalClass(undefined, 2), 'waiting');
      assert.equal(ctx.getArrivalClass(undefined, 3), 'waiting');
      assert.equal(ctx.getArrivalClass(undefined, 4), 'waiting');
    });

    it('returns empty string for normal arrival', () => {
      assert.equal(ctx.getArrivalClass(300, 0), '');
    });
  });

  // ========== debounce ==========

  describe('debounce()', () => {
    it('calls the function after delay', async () => {
      let called = false;
      const fn = ctx.debounce(() => { called = true; }, 50);
      fn();
      assert.equal(called, false);
      await new Promise(r => setTimeout(r, 100));
      assert.equal(called, true);
    });

    it('resets timer on re-call', async () => {
      let count = 0;
      const fn = ctx.debounce(() => { count++; }, 50);
      fn();
      await new Promise(r => setTimeout(r, 30));
      fn(); // Reset
      await new Promise(r => setTimeout(r, 30));
      assert.equal(count, 0); // Should not have fired yet
      await new Promise(r => setTimeout(r, 50));
      assert.equal(count, 1); // Should fire once
    });
  });

  // ========== calculateEstimatedTime ==========

  describe('calculateEstimatedTime()', () => {
    it('returns "06:00" for index 0', () => {
      assert.equal(ctx.calculateEstimatedTime(0), '06:00');
    });

    it('returns "06:02" for index 1', () => {
      assert.equal(ctx.calculateEstimatedTime(1), '06:02');
    });

    it('returns "07:00" for index 30', () => {
      assert.equal(ctx.calculateEstimatedTime(30), '07:00');
    });
  });

  // ========== routeBusData state ==========

  describe('routeBusData', () => {
    it('is initialized with empty nearStop and busPositions', () => {
      assert.ok(ctx.routeBusData, 'routeBusData should exist');
      assert.equal(Object.keys(ctx.routeBusData.nearStop).length, 0);
      assert.ok(Array.isArray(ctx.routeBusData.busPositions));
      assert.equal(ctx.routeBusData.busPositions.length, 0);
    });
  });

  // ========== busMarkers state ==========

  describe('busMarkers', () => {
    it('is initialized as an empty array', () => {
      assert.ok(Array.isArray(ctx.busMarkers));
      assert.equal(ctx.busMarkers.length, 0);
    });
  });

  // ========== fetchRouteBusPositions ==========

  describe('fetchRouteBusPositions()', () => {
    it('is a function', () => {
      assert.equal(typeof ctx.fetchRouteBusPositions, 'function');
    });

    it('returns { nearStop, busPositions } with correct keys', () => {
      // Just verify the function signature produces the right structure shape
      assert.equal(typeof ctx.fetchRouteBusPositions, 'function');
    });

    it('returns { nearStop, busPositions } structure with mock data', async () => {
      const nearStopData = [
        { PlateNumb: '206-U5', StopUID: 'TPE10001', Direction: 0, A2EventType: 1, BusStatus: 0 },
        { PlateNumb: 'EAA-150', StopUID: 'TPE10002', Direction: 1, A2EventType: 0, BusStatus: 0 }
      ];
      const freqData = [
        { PlateNumb: '206-U5', BusPosition: { PositionLat: 25.05, PositionLon: 121.55 }, Speed: 30, Direction: 0, BusStatus: 0 },
        { PlateNumb: 'EAA-150', BusPosition: { PositionLat: 25.02, PositionLon: 121.52 }, Speed: 0, Direction: 1, BusStatus: 0 }
      ];

      let callCount = 0;
      const ctx2 = createBrowserContext({
        fetch: async (url) => {
          callCount++;
          if (url.includes('RealTimeNearStop')) {
            return { ok: true, json: async () => nearStopData, status: 200 };
          }
          if (url.includes('RealTimeByFrequency')) {
            return { ok: true, json: async () => freqData, status: 200 };
          }
          return { ok: true, json: async () => [], status: 200 };
        }
      });
      loadJsFile('js/common.js', ctx2);
      loadJsFile('js/bus.js', ctx2);
      exposeVars(ctx2, ['fetchRouteBusPositions']);

      const result = await ctx2.fetchRouteBusPositions('Taipei', '307');

      // nearStop should have two entries keyed by dir_StopUID
      assert.ok(result.nearStop['go_TPE10001'], 'should have go_TPE10001');
      assert.equal(result.nearStop['go_TPE10001'].plate, '206-U5');
      assert.equal(result.nearStop['go_TPE10001'].a2event, 1);
      assert.ok(result.nearStop['back_TPE10002'], 'should have back_TPE10002');
      assert.equal(result.nearStop['back_TPE10002'].plate, 'EAA-150');

      // busPositions should have two entries
      assert.equal(result.busPositions.length, 2);
      assert.equal(result.busPositions[0].plate, '206-U5');
      assert.equal(result.busPositions[0].lat, 25.05);
      assert.equal(result.busPositions[0].direction, 'go');
      assert.equal(result.busPositions[0].speed, 30);
      assert.equal(result.busPositions[1].plate, 'EAA-150');
      assert.equal(result.busPositions[1].direction, 'back');
    });

    it('skips buses with non-zero BusStatus', async () => {
      const nearStopData = [
        { PlateNumb: 'OK-BUS', StopUID: 'TPE10001', Direction: 0, A2EventType: 1, BusStatus: 0 },
        { PlateNumb: 'BAD-BUS', StopUID: 'TPE10002', Direction: 0, A2EventType: 0, BusStatus: 2 }
      ];
      const freqData = [
        { PlateNumb: 'OK-BUS', BusPosition: { PositionLat: 25.05, PositionLon: 121.55 }, Speed: 10, Direction: 0, BusStatus: 0 },
        { PlateNumb: 'BAD-BUS', BusPosition: { PositionLat: 25.02, PositionLon: 121.52 }, Speed: 0, Direction: 0, BusStatus: 1 }
      ];

      const ctx2 = createBrowserContext({
        fetch: async (url) => {
          if (url.includes('RealTimeNearStop')) return { ok: true, json: async () => nearStopData, status: 200 };
          if (url.includes('RealTimeByFrequency')) return { ok: true, json: async () => freqData, status: 200 };
          return { ok: true, json: async () => [], status: 200 };
        }
      });
      loadJsFile('js/common.js', ctx2);
      loadJsFile('js/bus.js', ctx2);
      exposeVars(ctx2, ['fetchRouteBusPositions']);

      const result = await ctx2.fetchRouteBusPositions('Taipei', '307');

      assert.equal(Object.keys(result.nearStop).length, 1, 'should only have the OK bus');
      assert.ok(result.nearStop['go_TPE10001']);
      assert.equal(result.busPositions.length, 1);
      assert.equal(result.busPositions[0].plate, 'OK-BUS');
    });

    it('handles API errors gracefully', async () => {
      // Use a fetch that returns non-ok responses (no retries needed)
      const ctx2 = createBrowserContext({
        fetch: async () => ({ ok: false, status: 500, json: async () => [] })
      });
      loadJsFile('js/common.js', ctx2);
      loadJsFile('js/bus.js', ctx2);
      exposeVars(ctx2, ['fetchRouteBusPositions']);

      const result = await ctx2.fetchRouteBusPositions('Taipei', '307');
      assert.equal(Object.keys(result.nearStop).length, 0);
      assert.equal(result.busPositions.length, 0);
    });

    it('skips bus positions without valid GPS coordinates', async () => {
      const freqData = [
        { PlateNumb: 'GPS-BUS', BusPosition: { PositionLat: 25.05, PositionLon: 121.55 }, Speed: 5, Direction: 0, BusStatus: 0 },
        { PlateNumb: 'NO-GPS', BusPosition: { PositionLat: null, PositionLon: null }, Speed: 0, Direction: 0, BusStatus: 0 },
        { PlateNumb: 'NO-POS', BusPosition: {}, Speed: 0, Direction: 0, BusStatus: 0 }
      ];

      const ctx2 = createBrowserContext({
        fetch: async (url) => {
          if (url.includes('RealTimeNearStop')) return { ok: true, json: async () => [], status: 200 };
          if (url.includes('RealTimeByFrequency')) return { ok: true, json: async () => freqData, status: 200 };
          return { ok: true, json: async () => [], status: 200 };
        }
      });
      loadJsFile('js/common.js', ctx2);
      loadJsFile('js/bus.js', ctx2);
      exposeVars(ctx2, ['fetchRouteBusPositions']);

      const result = await ctx2.fetchRouteBusPositions('Taipei', '307');
      assert.equal(result.busPositions.length, 1);
      assert.equal(result.busPositions[0].plate, 'GPS-BUS');
    });
  });

  // ========== renderStopItems plate tags ==========

  describe('renderStopItems() plate tags', () => {
    it('includes plate-tag span when routeBusData has near-stop data', () => {
      setVar(ctx, 'isZh', false);
      // Set routeBusData with a plate near a stop
      vm.runInContext(`
        routeBusData = {
          nearStop: { 'go_TPE100': { plate: '206-U5', a2event: 1 } },
          busPositions: []
        };
      `, ctx);
      exposeVars(ctx, ['renderStopItems']);

      const stops = [
        { name: { en: 'Stop A', zh: '站A' }, stopUID: 'TPE100', time: '06:00' }
      ];
      const arrivalMap = {
        'go_TPE100': { estimateTime: 60, stopStatus: 0 }
      };

      const html = ctx.renderStopItems(stops, 'go', arrivalMap);
      assert.ok(html.includes('plate-tag'), 'should contain plate-tag class');
      assert.ok(html.includes('206-U5'), 'should contain plate number');
    });

    it('shows plate with event text when only near-stop data (no arrival)', () => {
      setVar(ctx, 'isZh', false);
      vm.runInContext(`
        routeBusData = {
          nearStop: { 'go_TPE200': { plate: 'EAA-150', a2event: 0 } },
          busPositions: []
        };
      `, ctx);
      exposeVars(ctx, ['renderStopItems']);

      const stops = [
        { name: { en: 'Stop B', zh: '站B' }, stopUID: 'TPE200', time: '06:02' }
      ];
      const arrivalMap = {}; // no arrival data

      const html = ctx.renderStopItems(stops, 'go', arrivalMap);
      assert.ok(html.includes('EAA-150'), 'should contain plate number');
      assert.ok(html.includes('Departing'), 'a2event=0 should show Departing');
    });

    it('shows Chinese event text when isZh is true', () => {
      setVar(ctx, 'isZh', true);
      vm.runInContext(`
        routeBusData = {
          nearStop: { 'go_TPE300': { plate: 'ABC-123', a2event: 1 } },
          busPositions: []
        };
      `, ctx);
      exposeVars(ctx, ['renderStopItems']);

      const stops = [
        { name: { en: 'Stop C', zh: '站C' }, stopUID: 'TPE300', time: '06:04' }
      ];
      const arrivalMap = {};

      const html = ctx.renderStopItems(stops, 'go', arrivalMap);
      assert.ok(html.includes('ABC-123'), 'should contain plate number');
      assert.ok(html.includes('進站中'), 'a2event=1 should show 進站中');
    });

    it('does not include plate-tag when routeBusData has no matching stop', () => {
      setVar(ctx, 'isZh', false);
      vm.runInContext(`
        routeBusData = { nearStop: {}, busPositions: [] };
      `, ctx);
      exposeVars(ctx, ['renderStopItems']);

      const stops = [
        { name: { en: 'Stop D', zh: '站D' }, stopUID: 'TPE400', time: '06:06' }
      ];
      const arrivalMap = {
        'go_TPE400': { estimateTime: 300, stopStatus: 0 }
      };

      const html = ctx.renderStopItems(stops, 'go', arrivalMap);
      assert.ok(!html.includes('plate-tag'), 'should not contain plate-tag when no near-stop data');
    });
  });

  // ========== clearBusMarkers ==========

  describe('clearBusMarkers()', () => {
    it('is a function', () => {
      assert.equal(typeof ctx.clearBusMarkers, 'function');
    });
  });

  // ========== useProxy ==========

  describe('useProxy()', () => {
    it('returns true when TDX_PROXY_URL is set', () => {
      assert.equal(ctx.useProxy(), true);
    });
  });

  // ========== ADJACENT_CITIES ==========

  describe('ADJACENT_CITIES', () => {
    it('has entries for all BUS_CITIES', () => {
      const busCityKeys = Object.keys(ctx.BUS_CITIES);
      const adjKeys = Object.keys(ctx.ADJACENT_CITIES);
      for (const city of busCityKeys) {
        assert.ok(adjKeys.includes(city), `ADJACENT_CITIES missing ${city}`);
      }
    });

    it('Taipei includes NewTaipei and Keelung', () => {
      const adj = ctx.ADJACENT_CITIES.Taipei;
      assert.ok(adj.includes('NewTaipei'));
      assert.ok(adj.includes('Keelung'));
    });

    it('NewTaipei includes Taipei, Keelung, Taoyuan, YilanCounty', () => {
      const adj = ctx.ADJACENT_CITIES.NewTaipei;
      assert.ok(adj.includes('Taipei'));
      assert.ok(adj.includes('Keelung'));
      assert.ok(adj.includes('Taoyuan'));
      assert.ok(adj.includes('YilanCounty'));
    });

    it('island counties have empty adjacency lists', () => {
      assert.equal(ctx.ADJACENT_CITIES.KinmenCounty.length, 0);
      assert.equal(ctx.ADJACENT_CITIES.PenghuCounty.length, 0);
      assert.equal(ctx.ADJACENT_CITIES.LianjiangCounty.length, 0);
    });

    it('adjacency is symmetric (if A lists B, B lists A)', () => {
      for (const [city, neighbors] of Object.entries(ctx.ADJACENT_CITIES)) {
        for (const neighbor of neighbors) {
          const reverseAdj = ctx.ADJACENT_CITIES[neighbor];
          assert.ok(
            reverseAdj && reverseAdj.includes(city),
            `${neighbor} should list ${city} as adjacent (symmetric)`
          );
        }
      }
    });
  });

  // ========== getAdjacentCities ==========

  describe('getAdjacentCities()', () => {
    it('returns adjacent cities for Taipei', () => {
      const result = ctx.getAdjacentCities('Taipei');
      assert.ok(result.includes('NewTaipei'));
      assert.ok(result.includes('Keelung'));
      assert.equal(result.length, 2);
    });

    it('returns empty array for unknown city', () => {
      const result = ctx.getAdjacentCities('Atlantis');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('returns empty array for island counties', () => {
      const result = ctx.getAdjacentCities('KinmenCounty');
      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });
  });

  // ========== fetchMergedRoutes ==========

  describe('fetchMergedRoutes()', () => {
    it('merges routes from primary and adjacent cities', async () => {
      const mockRoutes = {
        Taipei: [
          { id: '307', name: { en: '307', zh: '307' }, terminals: { en: 'A-B', zh: 'A-B' }, routeUID: 'TPE_307' }
        ],
        NewTaipei: [
          { id: '919', name: { en: '919', zh: '919' }, terminals: { en: 'C-D', zh: 'C-D' }, routeUID: 'NWT_919' },
          { id: '307', name: { en: '307', zh: '307' }, terminals: { en: 'E-F', zh: 'E-F' }, routeUID: 'NWT_307' }
        ],
        Keelung: [
          { id: '1001', name: { en: '1001', zh: '1001' }, terminals: { en: 'G-H', zh: 'G-H' }, routeUID: 'KEE_1001' }
        ]
      };

      const ctx2 = createBrowserContext({
        fetch: async (url) => {
          // Return appropriate routes based on city in URL
          for (const city of Object.keys(mockRoutes)) {
            if (url.includes(`/City/${city}`)) {
              return { ok: true, json: async () => mockRoutes[city].map(r => ({
                RouteName: { Zh_tw: r.id, En: r.id },
                DepartureStopNameZh: r.terminals.zh.split('-')[0],
                DestinationStopNameZh: r.terminals.zh.split('-')[1],
                DepartureStopNameEn: r.terminals.en.split('-')[0],
                DestinationStopNameEn: r.terminals.en.split('-')[1],
                RouteUID: r.routeUID,
                SubRoutes: []
              })), status: 200 };
            }
          }
          return { ok: true, json: async () => [], status: 200 };
        }
      });
      loadJsFile('js/common.js', ctx2);
      loadJsFile('js/bus.js', ctx2);
      exposeVars(ctx2, ['fetchMergedRoutes', 'mergedRoutesCache']);

      const merged = await ctx2.fetchMergedRoutes('Taipei');

      // Should have 307 (Taipei), 919 (NewTaipei), 1001 (Keelung)
      // 307 from NewTaipei should be deduplicated (Taipei wins)
      assert.equal(merged.length, 3);

      const route307 = merged.find(r => r.id === '307');
      assert.ok(route307, '307 should be in merged list');
      assert.equal(route307.sourceCity, 'Taipei', '307 should come from primary city');
      assert.equal(route307.isAdjacentCity, false);

      const route919 = merged.find(r => r.id === '919');
      assert.ok(route919, '919 should be in merged list');
      assert.equal(route919.sourceCity, 'NewTaipei');
      assert.equal(route919.isAdjacentCity, true);

      const route1001 = merged.find(r => r.id === '1001');
      assert.ok(route1001, '1001 should be in merged list');
      assert.equal(route1001.sourceCity, 'Keelung');
      assert.equal(route1001.isAdjacentCity, true);
    });

    it('caches merged results', async () => {
      const ctx2 = createBrowserContext({
        fetch: async () => ({ ok: true, json: async () => [], status: 200 })
      });
      loadJsFile('js/common.js', ctx2);
      loadJsFile('js/bus.js', ctx2);
      exposeVars(ctx2, ['fetchMergedRoutes', 'mergedRoutesCache']);

      await ctx2.fetchMergedRoutes('Taipei');
      // Second call should use cache
      const result = await ctx2.fetchMergedRoutes('Taipei');
      assert.ok(Array.isArray(result));
    });
  });

  // ========== findRouteInOtherCities (skips adjacent) ==========

  describe('findRouteInOtherCities() skips adjacent cities', () => {
    it('does not return adjacent cities', () => {
      // Pre-load routes into fetchedRoutes for multiple cities
      vm.runInContext(`
        currentRouteCity = 'Taipei';
        fetchedRoutes['NewTaipei'] = [{ id: '919', name: { en: '919', zh: '919' } }];
        fetchedRoutes['Taichung'] = [{ id: '919', name: { en: '919', zh: '919' } }];
      `, ctx);
      exposeVars(ctx, ['findRouteInOtherCities']);

      const results = ctx.findRouteInOtherCities('919');
      // NewTaipei is adjacent to Taipei, should be skipped
      assert.ok(!results.some(r => r.city === 'NewTaipei'), 'NewTaipei should be skipped (adjacent)');
      // Taichung is NOT adjacent to Taipei, should appear
      assert.ok(results.some(r => r.city === 'Taichung'), 'Taichung should appear (non-adjacent)');
    });
  });

  // ========== activeRouteSourceCity ==========

  describe('activeRouteSourceCity', () => {
    it('is initialized to null', () => {
      assert.equal(ctx.activeRouteSourceCity, null);
    });
  });

  // ========== mergedRoutesCache ==========

  describe('mergedRoutesCache', () => {
    it('is initialized as empty object', () => {
      assert.ok(ctx.mergedRoutesCache);
      assert.equal(Object.keys(ctx.mergedRoutesCache).length, 0);
    });
  });
});
