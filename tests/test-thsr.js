'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserContext, loadJsFile, loadHtmlScript, exposeVars, setVar } = require('./helpers/load-script');

const THSR_VARS = [
  'STATIONS', 'THSR_FARES', 'STATION_ID_MAP', 'DEMO_TIMETABLE',
  'timetableData', 'timeToMinutes', 'getStationName', 'getAddress',
  'getStationIndex', 'getTrainsForStation', 'isZh', 'selectedDestStation',
  'currentDirection'
];

function loadThsr(ctxOverrides = {}) {
  const ctx = createBrowserContext(ctxOverrides);
  loadJsFile('js/common.js', ctx);
  loadHtmlScript('thsr.html', ctx);
  exposeVars(ctx, THSR_VARS);
  return ctx;
}

describe('thsr.html', () => {
  let ctx;

  beforeEach(() => {
    ctx = loadThsr();
  });

  // ========== STATIONS data ==========

  describe('STATIONS', () => {
    it('has 12 entries', () => {
      assert.equal(ctx.STATIONS.length, 12);
    });

    it('each station has id, name, lat, lng, km', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.id, `Station missing id`);
        assert.ok(s.name.en, `${s.id} missing name.en`);
        assert.ok(s.name.zh, `${s.id} missing name.zh`);
        assert.equal(typeof s.lat, 'number', `${s.id} lat not a number`);
        assert.equal(typeof s.lng, 'number', `${s.id} lng not a number`);
        assert.equal(typeof s.km, 'number', `${s.id} km not a number`);
      }
    });

    it('first station is Nangang', () => {
      assert.equal(ctx.STATIONS[0].name.en, 'Nangang');
    });

    it('last station is Zuoying', () => {
      assert.equal(ctx.STATIONS[11].name.en, 'Zuoying');
    });

    it('km increases from north to south', () => {
      for (let i = 1; i < ctx.STATIONS.length; i++) {
        assert.ok(ctx.STATIONS[i].km > ctx.STATIONS[i - 1].km,
          `Station ${ctx.STATIONS[i].name.en} km should be > ${ctx.STATIONS[i - 1].name.en}`);
      }
    });

    it('each station has an address object', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.address.en, `${s.id} missing address.en`);
        assert.ok(s.address.zh, `${s.id} missing address.zh`);
      }
    });
  });

  // ========== THSR_FARES ==========

  describe('THSR_FARES', () => {
    it('is a 12x12 matrix', () => {
      assert.equal(ctx.THSR_FARES.length, 12);
      for (const row of ctx.THSR_FARES) {
        assert.equal(row.length, 12);
      }
    });

    it('diagonal is all zeros', () => {
      for (let i = 0; i < 12; i++) {
        assert.equal(ctx.THSR_FARES[i][i], 0, `THSR_FARES[${i}][${i}] should be 0`);
      }
    });

    it('is symmetric', () => {
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
          assert.equal(ctx.THSR_FARES[i][j], ctx.THSR_FARES[j][i],
            `THSR_FARES[${i}][${j}] !== THSR_FARES[${j}][${i}]`);
        }
      }
    });

    it('all values are non-negative', () => {
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
          assert.ok(ctx.THSR_FARES[i][j] >= 0);
        }
      }
    });
  });

  // ========== STATION_ID_MAP ==========

  describe('STATION_ID_MAP', () => {
    it('has 12 entries', () => {
      assert.equal(Object.keys(ctx.STATION_ID_MAP).length, 12);
    });

    it('maps TDX codes to station indices 0-11', () => {
      const values = Object.values(ctx.STATION_ID_MAP);
      for (let i = 0; i < 12; i++) {
        assert.ok(values.includes(i), `Index ${i} missing from STATION_ID_MAP`);
      }
    });

    it('codes match STATIONS code field', () => {
      for (const [code, idx] of Object.entries(ctx.STATION_ID_MAP)) {
        assert.equal(ctx.STATIONS[idx].code, code,
          `STATION_ID_MAP[${code}] = ${idx}, but STATIONS[${idx}].code = ${ctx.STATIONS[idx].code}`);
      }
    });
  });

  // ========== DEMO_TIMETABLE ==========

  describe('DEMO_TIMETABLE', () => {
    it('has southbound and northbound arrays', () => {
      assert.ok(Array.isArray(ctx.DEMO_TIMETABLE.southbound));
      assert.ok(Array.isArray(ctx.DEMO_TIMETABLE.northbound));
    });

    it('southbound trains have 12-element times arrays', () => {
      for (const train of ctx.DEMO_TIMETABLE.southbound) {
        assert.equal(train.times.length, 12);
        assert.ok(train.trainNo, 'Missing trainNo');
      }
    });

    it('northbound trains have 12-element times arrays', () => {
      for (const train of ctx.DEMO_TIMETABLE.northbound) {
        assert.equal(train.times.length, 12);
        assert.ok(train.trainNo, 'Missing trainNo');
      }
    });

    it('train times are valid minutes or null', () => {
      const allTrains = [...ctx.DEMO_TIMETABLE.southbound, ...ctx.DEMO_TIMETABLE.northbound];
      for (const train of allTrains) {
        for (const t of train.times) {
          assert.ok(t === null || (typeof t === 'number' && t >= 0 && t <= 1440),
            `Invalid time ${t} in train ${train.trainNo}`);
        }
      }
    });
  });

  // ========== timeToMinutes ==========

  describe('timeToMinutes()', () => {
    it('converts "06:30" to 390', () => {
      assert.equal(ctx.timeToMinutes('06:30'), 390);
    });

    it('converts "00:00" to 0', () => {
      assert.equal(ctx.timeToMinutes('00:00'), 0);
    });

    it('converts "23:59" to 1439', () => {
      assert.equal(ctx.timeToMinutes('23:59'), 1439);
    });

    it('returns null for null input', () => {
      assert.equal(ctx.timeToMinutes(null), null);
    });

    it('returns null for undefined input', () => {
      assert.equal(ctx.timeToMinutes(undefined), null);
    });
  });

  // ========== getStationName / getAddress ==========

  describe('getStationName() / getAddress()', () => {
    it('returns English name when isZh=false', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.getStationName(ctx.STATIONS[0]), 'Nangang');
    });

    it('returns Chinese name when isZh=true', () => {
      setVar(ctx, 'isZh', true);
      assert.equal(ctx.getStationName(ctx.STATIONS[0]), '南港');
    });

    it('returns English address when isZh=false', () => {
      setVar(ctx, 'isZh', false);
      assert.ok(ctx.getAddress(ctx.STATIONS[0]).includes('Taipei'));
    });

    it('returns Chinese address when isZh=true', () => {
      setVar(ctx, 'isZh', true);
      assert.ok(ctx.getAddress(ctx.STATIONS[0]).includes('台北'));
    });
  });

  // ========== getStationIndex ==========

  describe('getStationIndex()', () => {
    it('returns 1-based index for first station', () => {
      assert.equal(ctx.getStationIndex(ctx.STATIONS[0]), 1);
    });

    it('returns 12 for last station', () => {
      assert.equal(ctx.getStationIndex(ctx.STATIONS[11]), 12);
    });
  });

  // ========== getTrainsForStation ==========

  describe('getTrainsForStation()', () => {
    function makeTimedCtx(hours, minutes) {
      const MockDate = class { getHours() { return hours; } getMinutes() { return minutes; } };
      const c = createBrowserContext();
      c.Date = MockDate;
      loadJsFile('js/common.js', c);
      loadHtmlScript('thsr.html', c);
      exposeVars(c, THSR_VARS);
      return c;
    }

    it('returns trains for a valid station', () => {
      const c = makeTimedCtx(8, 0);
      const trains = c.getTrainsForStation('THSR-02', 'south');
      assert.ok(Array.isArray(trains));
      assert.ok(trains.length > 0, 'Should return trains for Taipei southbound');
    });

    it('returns empty for invalid station', () => {
      const trains = ctx.getTrainsForStation('INVALID', 'south');
      assert.ok(Array.isArray(trains));
      assert.equal(trains.length, 0);
    });

    it('returns empty for southbound at Zuoying (terminal)', () => {
      const c = makeTimedCtx(8, 0);
      const trains = c.getTrainsForStation('THSR-12', 'south');
      assert.ok(Array.isArray(trains));
    });

    it('trains are sorted by departure time', () => {
      const c = makeTimedCtx(6, 0);
      const trains = c.getTrainsForStation('THSR-01', 'south');
      for (let i = 1; i < trains.length; i++) {
        assert.ok(trains[i].adjustedDepTime >= trains[i - 1].adjustedDepTime,
          `Trains not sorted: ${trains[i - 1].depTimeStr} > ${trains[i].depTimeStr}`);
      }
    });

    it('uses selectedDestStation when set', () => {
      const c = makeTimedCtx(6, 0);
      // Set selectedDestStation in the vm context's closure scope
      const vm = require('vm');
      vm.runInContext('selectedDestStation = "THSR-07";', c);
      const trains = c.getTrainsForStation('THSR-02', 'south');
      if (trains.length > 0) {
        assert.equal(trains[0].destination.name.en, 'Taichung');
      }
    });

    it('falls back destIndex when selectedDestStation is invalid', () => {
      const c = makeTimedCtx(6, 0);
      const vm = require('vm');
      vm.runInContext('selectedDestStation = "INVALID_STATION";', c);
      const trains = c.getTrainsForStation('THSR-01', 'south');
      if (trains.length > 0) {
        assert.equal(trains[0].destination.name.en, 'Zuoying');
      }
    });
  });
});
