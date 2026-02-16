'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserContext, loadJsFile, loadHtmlScript, exposeVars } = require('./helpers/load-script');

const RAIL_VARS = ['RAIL_LINES', 'STATION_CLASSES', 'STATIONS'];

describe('rail.html', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    // rail.html depends on common.js (loaded via external script tag)
    loadJsFile('js/common.js', ctx);
    loadHtmlScript('rail.html', ctx);
    exposeVars(ctx, RAIL_VARS);
  });

  // ========== RAIL_LINES ==========

  describe('RAIL_LINES', () => {
    it('has 13 lines', () => {
      assert.equal(Object.keys(ctx.RAIL_LINES).length, 13);
    });

    it('includes documented line codes', () => {
      const codes = ['WL', 'ML', 'CL', 'SL', 'YL', 'NL', 'TL', 'SLL', 'PX', 'NW', 'JJ', 'SH', 'LJ'];
      for (const code of codes) {
        assert.ok(ctx.RAIL_LINES[code], `Missing line ${code}`);
      }
    });

    it('each line has name.en, name.zh, color', () => {
      for (const [code, line] of Object.entries(ctx.RAIL_LINES)) {
        assert.ok(line.name.en, `${code} missing name.en`);
        assert.ok(line.name.zh, `${code} missing name.zh`);
        assert.ok(line.color, `${code} missing color`);
        assert.ok(line.color.startsWith('#'), `${code} color should start with #`);
      }
    });
  });

  // ========== STATION_CLASSES ==========

  describe('STATION_CLASSES', () => {
    it('has 4 classes (1, 2, 3, S)', () => {
      const keys = Object.keys(ctx.STATION_CLASSES);
      assert.equal(keys.length, 4);
      assert.ok(keys.includes('1'));
      assert.ok(keys.includes('2'));
      assert.ok(keys.includes('3'));
      assert.ok(keys.includes('S'));
    });

    it('each class has name and color', () => {
      for (const [key, cls] of Object.entries(ctx.STATION_CLASSES)) {
        assert.ok(cls.name.en, `Class ${key} missing name.en`);
        assert.ok(cls.name.zh, `Class ${key} missing name.zh`);
        assert.ok(cls.color, `Class ${key} missing color`);
      }
    });
  });

  // ========== STATIONS ==========

  describe('STATIONS', () => {
    it('has entries', () => {
      assert.ok(ctx.STATIONS.length > 100, `Expected > 100 stations, got ${ctx.STATIONS.length}`);
    });

    it('each station has required fields', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.id, 'Missing id');
        assert.ok(s.name.en, `${s.id} missing name.en`);
        assert.ok(s.name.zh, `${s.id} missing name.zh`);
        assert.ok(s.line, `${s.id} missing line`);
        assert.ok(s.class, `${s.id} missing class`);
        assert.equal(typeof s.lat, 'number', `${s.id} lat not number`);
        assert.equal(typeof s.lng, 'number', `${s.id} lng not number`);
        assert.equal(typeof s.km, 'number', `${s.id} km not number`);
      }
    });

    it('all stations reference valid lines', () => {
      const validLines = Object.keys(ctx.RAIL_LINES);
      for (const s of ctx.STATIONS) {
        assert.ok(validLines.includes(s.line),
          `Station ${s.id} (${s.name.en}) has invalid line ${s.line}`);
      }
    });

    it('all stations reference valid classes', () => {
      const validClasses = Object.keys(ctx.STATION_CLASSES);
      for (const s of ctx.STATIONS) {
        assert.ok(validClasses.includes(s.class),
          `Station ${s.id} (${s.name.en}) has invalid class ${s.class}`);
      }
    });

    it('coordinates are in Taiwan range', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.lat >= 22 && s.lat <= 26, `${s.id} lat out of range: ${s.lat}`);
        assert.ok(s.lng >= 119 && s.lng <= 122, `${s.id} lng out of range: ${s.lng}`);
      }
    });

    it('has stations for all 13 lines', () => {
      const linesWithStations = new Set(ctx.STATIONS.map(s => s.line));
      for (const lineCode of Object.keys(ctx.RAIL_LINES)) {
        assert.ok(linesWithStations.has(lineCode),
          `No stations found for line ${lineCode}`);
      }
    });
  });
});
