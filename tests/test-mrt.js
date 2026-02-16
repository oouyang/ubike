'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserContext, loadHtmlScript, exposeVars, setVar } = require('./helpers/load-script');

const MRT_VARS = [
  'MRT_SYSTEMS', 'STATIONS', 'CONFIG',
  'getSystemInfo', 'getLineInfo', 'getStationName', 'getLineName', 'getSystemName',
  'isZh'
];

describe('mrt.html', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    loadHtmlScript('mrt.html', ctx);
    exposeVars(ctx, MRT_VARS);
  });

  // ========== MRT_SYSTEMS ==========

  describe('MRT_SYSTEMS', () => {
    it('has 4 systems', () => {
      const keys = Object.keys(ctx.MRT_SYSTEMS);
      assert.equal(keys.length, 4);
    });

    it('includes TRTC, KRTC, TYMC, TMRT', () => {
      assert.ok(ctx.MRT_SYSTEMS.TRTC);
      assert.ok(ctx.MRT_SYSTEMS.KRTC);
      assert.ok(ctx.MRT_SYSTEMS.TYMC);
      assert.ok(ctx.MRT_SYSTEMS.TMRT);
    });

    it('each system has name, center, lines', () => {
      for (const [code, sys] of Object.entries(ctx.MRT_SYSTEMS)) {
        assert.ok(sys.name.en, `${code} missing name.en`);
        assert.ok(sys.name.zh, `${code} missing name.zh`);
        assert.ok(Array.isArray(sys.center), `${code} missing center`);
        assert.ok(typeof sys.lines === 'object', `${code} missing lines`);
      }
    });

    it('TRTC has 7 lines (BR, R, G, O, BL, Y, LG)', () => {
      const lines = Object.keys(ctx.MRT_SYSTEMS.TRTC.lines);
      assert.equal(lines.length, 7);
      assert.ok(lines.includes('BR'));
      assert.ok(lines.includes('R'));
      assert.ok(lines.includes('G'));
      assert.ok(lines.includes('O'));
      assert.ok(lines.includes('BL'));
      assert.ok(lines.includes('Y'));
      assert.ok(lines.includes('LG'));
    });

    it('KRTC has 3 lines (KR, KO, KC)', () => {
      const lines = Object.keys(ctx.MRT_SYSTEMS.KRTC.lines);
      assert.equal(lines.length, 3);
      assert.ok(lines.includes('KR'));
      assert.ok(lines.includes('KO'));
      assert.ok(lines.includes('KC'));
    });

    it('TYMC has 1 line (A)', () => {
      assert.deepEqual(Object.keys(ctx.MRT_SYSTEMS.TYMC.lines), ['A']);
    });

    it('TMRT has 1 line (TG)', () => {
      assert.deepEqual(Object.keys(ctx.MRT_SYSTEMS.TMRT.lines), ['TG']);
    });

    it('each line has name and color', () => {
      for (const [sysCode, sys] of Object.entries(ctx.MRT_SYSTEMS)) {
        for (const [lineCode, line] of Object.entries(sys.lines)) {
          assert.ok(line.name.en, `${sysCode}/${lineCode} missing name.en`);
          assert.ok(line.name.zh, `${sysCode}/${lineCode} missing name.zh`);
          assert.ok(line.color, `${sysCode}/${lineCode} missing color`);
          assert.ok(line.color.startsWith('#'), `${sysCode}/${lineCode} color should start with #`);
        }
      }
    });
  });

  // ========== STATIONS ==========

  describe('STATIONS', () => {
    it('has entries', () => {
      assert.ok(ctx.STATIONS.length > 0, 'STATIONS should not be empty');
    });

    it('each station has required fields', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.id, 'Missing id');
        assert.ok(s.name.en, `${s.id} missing name.en`);
        assert.ok(s.name.zh, `${s.id} missing name.zh`);
        assert.ok(s.line, `${s.id} missing line`);
        assert.ok(s.system, `${s.id} missing system`);
        assert.equal(typeof s.lat, 'number', `${s.id} lat not number`);
        assert.equal(typeof s.lng, 'number', `${s.id} lng not number`);
      }
    });

    it('all stations reference valid systems', () => {
      const validSystems = Object.keys(ctx.MRT_SYSTEMS);
      for (const s of ctx.STATIONS) {
        assert.ok(validSystems.includes(s.system),
          `Station ${s.id} has invalid system ${s.system}`);
      }
    });

    it('all stations reference valid lines', () => {
      for (const s of ctx.STATIONS) {
        const system = ctx.MRT_SYSTEMS[s.system];
        assert.ok(system.lines[s.line],
          `Station ${s.id} has invalid line ${s.line} for system ${s.system}`);
      }
    });

    it('coordinates are in Taiwan range', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.lat >= 22 && s.lat <= 26, `${s.id} lat out of range: ${s.lat}`);
        assert.ok(s.lng >= 118 && s.lng <= 122, `${s.id} lng out of range: ${s.lng}`);
      }
    });
  });

  // ========== getSystemInfo ==========

  describe('getSystemInfo()', () => {
    it('returns system info for valid code', () => {
      const info = ctx.getSystemInfo('TRTC');
      assert.equal(info.name.en, 'Taipei Metro');
      assert.equal(info.name.zh, '台北捷運');
    });

    it('returns fallback for invalid code', () => {
      const info = ctx.getSystemInfo('INVALID');
      assert.ok(info.name);
    });
  });

  // ========== getLineInfo ==========

  describe('getLineInfo()', () => {
    it('returns line info for valid combo', () => {
      const info = ctx.getLineInfo('TRTC', 'BR');
      assert.equal(info.name.en, 'Wenhu Line');
      assert.equal(info.color, '#c48c31');
    });

    it('returns fallback for invalid combo', () => {
      const info = ctx.getLineInfo('TRTC', 'INVALID');
      assert.ok(info.name);
      assert.ok(info.color);
    });
  });

  // ========== getStationName / getLineName / getSystemName ==========

  describe('getStationName()', () => {
    it('returns English name when isZh=false', () => {
      setVar(ctx, 'isZh', false);
      const s = ctx.STATIONS[0];
      assert.equal(ctx.getStationName(s), s.name.en);
    });

    it('returns Chinese name when isZh=true', () => {
      setVar(ctx, 'isZh', true);
      const s = ctx.STATIONS[0];
      assert.equal(ctx.getStationName(s), s.name.zh);
    });
  });

  describe('getLineName()', () => {
    it('returns English line name when isZh=false', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.getLineName('TRTC', 'R'), 'Tamsui-Xinyi Line');
    });

    it('returns Chinese line name when isZh=true', () => {
      setVar(ctx, 'isZh', true);
      assert.equal(ctx.getLineName('TRTC', 'R'), '淡水信義線');
    });
  });

  describe('getSystemName()', () => {
    it('returns English system name when isZh=false', () => {
      setVar(ctx, 'isZh', false);
      assert.equal(ctx.getSystemName('KRTC'), 'Kaohsiung Metro');
    });

    it('returns Chinese system name when isZh=true', () => {
      setVar(ctx, 'isZh', true);
      assert.equal(ctx.getSystemName('KRTC'), '高雄捷運');
    });
  });
});
