'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserContext, loadHtmlScript, exposeVars } = require('./helpers/load-script');

describe('tdx/thsr.html', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    loadHtmlScript('tdx/thsr.html', ctx);
    exposeVars(ctx, ['STATIONS']);
  });

  describe('STATIONS', () => {
    it('has 12 entries', () => {
      assert.equal(ctx.STATIONS.length, 12);
    });

    it('each station has required fields', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.id, 'Missing id');
        assert.ok(s.name.en, `${s.id} missing name.en`);
        assert.ok(s.name.zh, `${s.id} missing name.zh`);
        assert.equal(typeof s.lat, 'number', `${s.id} lat not number`);
        assert.equal(typeof s.lng, 'number', `${s.id} lng not number`);
      }
    });

    it('coordinates are in Taiwan range', () => {
      for (const s of ctx.STATIONS) {
        assert.ok(s.lat >= 22 && s.lat <= 26, `${s.id} lat out of range`);
        assert.ok(s.lng >= 120 && s.lng <= 122, `${s.id} lng out of range`);
      }
    });
  });
});

describe('tdx/air.html', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    loadHtmlScript('tdx/air.html', ctx);
    exposeVars(ctx, ['AIRPORTS']);
  });

  describe('AIRPORTS', () => {
    it('has 17 entries', () => {
      assert.equal(ctx.AIRPORTS.length, 17);
    });

    it('each airport has required fields', () => {
      for (const a of ctx.AIRPORTS) {
        assert.ok(a.id, 'Missing id');
        assert.ok(a.name.en, `${a.id} missing name.en`);
        assert.ok(a.name.zh, `${a.id} missing name.zh`);
        assert.ok(a.iata, `${a.id} missing IATA code`);
        assert.ok(a.icao, `${a.id} missing ICAO code`);
        assert.equal(typeof a.lat, 'number', `${a.id} lat not number`);
        assert.equal(typeof a.lng, 'number', `${a.id} lng not number`);
      }
    });

    it('IATA codes are 3 characters', () => {
      for (const a of ctx.AIRPORTS) {
        assert.equal(a.iata.length, 3, `${a.id} IATA code ${a.iata} not 3 chars`);
      }
    });

    it('ICAO codes are 4 characters', () => {
      for (const a of ctx.AIRPORTS) {
        assert.equal(a.icao.length, 4, `${a.id} ICAO code ${a.icao} not 4 chars`);
      }
    });

    it('includes international airports', () => {
      const international = ctx.AIRPORTS.filter(a => a.type === 'international');
      assert.ok(international.length >= 4, `Expected >= 4 international, got ${international.length}`);
    });
  });
});

describe('tdx/bus.html', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    loadHtmlScript('tdx/bus.html', ctx);
    exposeVars(ctx, ['TERMINALS']);
  });

  describe('TERMINALS', () => {
    it('has 25+ entries', () => {
      assert.ok(ctx.TERMINALS.length >= 25, `Expected >= 25 terminals, got ${ctx.TERMINALS.length}`);
    });

    it('each terminal has required fields', () => {
      for (const t of ctx.TERMINALS) {
        assert.ok(t.id, 'Missing id');
        assert.ok(t.name.en, `${t.id} missing name.en`);
        assert.ok(t.name.zh, `${t.id} missing name.zh`);
        assert.equal(typeof t.lat, 'number', `${t.id} lat not number`);
        assert.equal(typeof t.lng, 'number', `${t.id} lng not number`);
      }
    });

    it('has region tags', () => {
      const regions = new Set(ctx.TERMINALS.map(t => t.region));
      assert.ok(regions.size >= 3, `Expected >= 3 regions, got ${regions.size}`);
    });

    it('coordinates are in Taiwan range', () => {
      for (const t of ctx.TERMINALS) {
        assert.ok(t.lat >= 22 && t.lat <= 26, `${t.id} lat out of range`);
        assert.ok(t.lng >= 118 && t.lng <= 122, `${t.id} lng out of range`);
      }
    });
  });
});

describe('tdx/index.html', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    loadHtmlScript('tdx/index.html', ctx);
    exposeVars(ctx, ['toggleLang', 'updateLang']);
  });

  describe('toggleLang function', () => {
    it('exists', () => {
      assert.equal(typeof ctx.toggleLang, 'function');
    });
  });

  describe('updateLang function', () => {
    it('exists', () => {
      assert.equal(typeof ctx.updateLang, 'function');
    });
  });
});
