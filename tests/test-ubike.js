'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserContext, loadJsFile, exposeVars, setVar } = require('./helpers/load-script');

const UBIKE_VARS = [
  'LABELS', 'YOUBIKE_CONTACTS', 'FAULT_TYPES', 'REGION_SLUGS', 'YOUBIKE_FARES',
  'CONFIG', 'isZh', 'currentCity', 'currentReportStation', 'selectedIssueType',
  'getPopupContent', 'getReportButtonHtml', 'buildReportText',
  'validateReport', 'buildIssueTypeGrid', 'selectIssueType',
  'getFilteredStations', 'countNearbyEbikeStations',
  'formatTierLabel', 'updateSheetSummary'
];

function loadUbike(overrides = {}) {
  const ctx = createBrowserContext(overrides);
  loadJsFile('js/common.js', ctx);
  loadJsFile('js/ubike.js', ctx);
  exposeVars(ctx, UBIKE_VARS);
  return ctx;
}

describe('js/ubike.js', () => {
  let ctx;

  beforeEach(() => {
    ctx = loadUbike();
  });

  // ========== LABELS ==========

  describe('LABELS', () => {
    it('has en and zh keys', () => {
      assert.ok(ctx.LABELS.en);
      assert.ok(ctx.LABELS.zh);
    });

    it('en and zh have the same keys', () => {
      const enKeys = Object.keys(ctx.LABELS.en).sort();
      const zhKeys = Object.keys(ctx.LABELS.zh).sort();
      assert.deepEqual(enKeys, zhKeys);
    });

    it('has report-related labels', () => {
      assert.ok(ctx.LABELS.en.reportBtn);
      assert.ok(ctx.LABELS.en.reportTitle);
      assert.ok(ctx.LABELS.en.reportStation);
      assert.ok(ctx.LABELS.en.reportSelectIssue);
      assert.ok(ctx.LABELS.en.reportActionForm);
      assert.ok(ctx.LABELS.en.reportActionCall);
      assert.ok(ctx.LABELS.en.reportActionEmail);
      assert.ok(ctx.LABELS.en.reportCopied);
    });

    it('has fault type labels', () => {
      assert.ok(ctx.LABELS.en.faultFlatTire);
      assert.ok(ctx.LABELS.en.faultBrokenSeat);
      assert.ok(ctx.LABELS.en.faultBrakeIssue);
      assert.ok(ctx.LABELS.en.faultBrokenDock);
      assert.ok(ctx.LABELS.en.faultCannotLock);
      assert.ok(ctx.LABELS.en.faultStationFull);
      assert.ok(ctx.LABELS.en.faultOther);
    });

    it('zh fault labels are Chinese', () => {
      assert.ok(ctx.LABELS.zh.faultFlatTire.includes('輪胎'));
      assert.ok(ctx.LABELS.zh.faultBrokenSeat.includes('座椅'));
      assert.ok(ctx.LABELS.zh.faultStationFull.includes('滿載'));
    });
  });

  // ========== YOUBIKE_CONTACTS ==========

  describe('YOUBIKE_CONTACTS', () => {
    it('has 13 city entries', () => {
      assert.equal(Object.keys(ctx.YOUBIKE_CONTACTS).length, 13);
    });

    it('each entry has phone, email, formalName', () => {
      for (const [key, contact] of Object.entries(ctx.YOUBIKE_CONTACTS)) {
        assert.ok(contact.phone, `${key} missing phone`);
        assert.ok(contact.email, `${key} missing email`);
        assert.ok(contact.formalName, `${key} missing formalName`);
      }
    });

    it('emails follow youbike.com.tw domain', () => {
      for (const [key, contact] of Object.entries(ctx.YOUBIKE_CONTACTS)) {
        assert.ok(contact.email.endsWith('@youbike.com.tw'),
          `${key} email does not end with @youbike.com.tw: ${contact.email}`);
      }
    });

    it('formalName uses 臺 not 台 for Taipei/Taichung/Tainan/Taitung', () => {
      assert.equal(ctx.YOUBIKE_CONTACTS.taipei.formalName, '臺北市');
      assert.equal(ctx.YOUBIKE_CONTACTS.taichung.formalName, '臺中市');
      assert.equal(ctx.YOUBIKE_CONTACTS.tainan.formalName, '臺南市');
      assert.equal(ctx.YOUBIKE_CONTACTS.taitung.formalName, '臺東縣');
    });

    it('matches CITIES keys', () => {
      const cities = ctx.window.CITIES;
      for (const key of Object.keys(ctx.YOUBIKE_CONTACTS)) {
        assert.ok(cities[key], `YOUBIKE_CONTACTS has key "${key}" not in CITIES`);
      }
    });
  });

  // ========== FAULT_TYPES ==========

  describe('FAULT_TYPES', () => {
    it('has 11 fault types', () => {
      assert.equal(ctx.FAULT_TYPES.length, 11);
    });

    it('each fault type has matching labels in en and zh', () => {
      for (const type of ctx.FAULT_TYPES) {
        assert.ok(ctx.LABELS.en[type], `Missing en label for ${type}`);
        assert.ok(ctx.LABELS.zh[type], `Missing zh label for ${type}`);
      }
    });

    it('includes bike, dock, station, and other categories', () => {
      // Bike issues
      assert.ok(ctx.FAULT_TYPES.includes('faultFlatTire'));
      assert.ok(ctx.FAULT_TYPES.includes('faultBrokenSeat'));
      assert.ok(ctx.FAULT_TYPES.includes('faultBrakeIssue'));
      assert.ok(ctx.FAULT_TYPES.includes('faultChainProblem'));
      assert.ok(ctx.FAULT_TYPES.includes('faultOtherBike'));
      // Dock issues
      assert.ok(ctx.FAULT_TYPES.includes('faultBrokenDock'));
      assert.ok(ctx.FAULT_TYPES.includes('faultCannotLock'));
      assert.ok(ctx.FAULT_TYPES.includes('faultCannotUnlock'));
      // Station issues
      assert.ok(ctx.FAULT_TYPES.includes('faultStationFull'));
      assert.ok(ctx.FAULT_TYPES.includes('faultNoBikes'));
      // Other
      assert.ok(ctx.FAULT_TYPES.includes('faultOther'));
    });
  });

  // ========== REGION_SLUGS ==========

  describe('REGION_SLUGS', () => {
    it('has 13 entries matching CITIES', () => {
      assert.equal(Object.keys(ctx.REGION_SLUGS).length, 13);
    });

    it('each slug is a non-empty string', () => {
      for (const [key, slug] of Object.entries(ctx.REGION_SLUGS)) {
        assert.ok(typeof slug === 'string' && slug.length > 0, `${key} slug is invalid`);
      }
    });

    it('taipei maps to "taipei"', () => {
      assert.equal(ctx.REGION_SLUGS.taipei, 'taipei');
    });

    it('newtaipei maps to "ntpc"', () => {
      assert.equal(ctx.REGION_SLUGS.newtaipei, 'ntpc');
    });
  });

  // ========== CONFIG ==========

  describe('CONFIG', () => {
    it('has REFRESH_INTERVAL of 5 minutes', () => {
      assert.equal(ctx.CONFIG.REFRESH_INTERVAL, 5 * 60 * 1000);
    });

    it('has DEFAULT_ZOOM of 14', () => {
      assert.equal(ctx.CONFIG.DEFAULT_ZOOM, 14);
    });
  });

  // ========== getPopupContent ==========

  describe('getPopupContent()', () => {
    const mockStation = {
      sno: 'S001',
      sna: '台北車站',
      snaen: 'Taipei Station',
      ar: '北平西路',
      aren: 'Beiping W Rd',
      city: 'taipei',
      latitude: 25.0478,
      longitude: 121.517,
      available_rent_bikes: 10,
      available_return_bikes: 5,
      status: 1,
      ebikes: 2
    };

    it('includes station name in English', () => {
      setVar(ctx, 'isZh', false);
      const html = ctx.getPopupContent(mockStation);
      assert.ok(html.includes('Taipei Station'));
    });

    it('includes station name in Chinese', () => {
      setVar(ctx, 'isZh', true);
      const html = ctx.getPopupContent(mockStation);
      assert.ok(html.includes('台北車站'));
    });

    it('includes bike and slot counts', () => {
      setVar(ctx, 'isZh', false);
      const html = ctx.getPopupContent(mockStation);
      assert.ok(html.includes('10'));
      assert.ok(html.includes('5'));
    });

    it('includes report button for active stations', () => {
      const html = ctx.getPopupContent(mockStation);
      assert.ok(html.includes('Report') || html.includes('回報'));
      assert.ok(html.includes('openReportModal'));
    });

    it('does NOT include report button for suspended stations', () => {
      const suspended = { ...mockStation, status: 2 };
      const html = ctx.getPopupContent(suspended);
      assert.ok(!html.includes('openReportModal'));
    });

    it('includes navigation links', () => {
      const html = ctx.getPopupContent(mockStation);
      assert.ok(html.includes('google.com/maps'));
      assert.ok(html.includes('maps.apple.com'));
    });

    it('shows suspended label for status 2', () => {
      setVar(ctx, 'isZh', false);
      const suspended = { ...mockStation, status: 2 };
      const html = ctx.getPopupContent(suspended);
      assert.ok(html.includes('Suspended'));
    });
  });

  // ========== getReportButtonHtml ==========

  describe('getReportButtonHtml()', () => {
    it('returns HTML with onclick handler', () => {
      const html = ctx.getReportButtonHtml('S001');
      assert.ok(html.includes("openReportModal('S001')"));
    });

    it('uses English label when isZh=false', () => {
      setVar(ctx, 'isZh', false);
      const html = ctx.getReportButtonHtml('S001');
      assert.ok(html.includes('Report'));
    });

    it('uses Chinese label when isZh=true', () => {
      setVar(ctx, 'isZh', true);
      const html = ctx.getReportButtonHtml('S001');
      assert.ok(html.includes('回報'));
    });
  });

  // ========== buildReportText ==========

  describe('buildReportText()', () => {
    const station = {
      sno: 'S001',
      sna: '台北車站',
      snaen: 'Taipei Station',
      ar: '北平西路',
      aren: 'Beiping W Rd',
      city: 'taipei',
      available_rent_bikes: 10,
      available_return_bikes: 5,
      status: 1
    };

    it('returns empty string when no station set', () => {
      setVar(ctx, 'currentReportStation', null);
      const text = ctx.buildReportText();
      assert.equal(text, '');
    });

    it('includes station name in EN report', () => {
      setVar(ctx, 'isZh', false);
      setVar(ctx, 'currentReportStation', station);
      setVar(ctx, 'selectedIssueType', 'faultFlatTire');
      const text = ctx.buildReportText();
      assert.ok(text.includes('Taipei Station'));
      assert.ok(text.includes('Flat tire'));
    });

    it('includes station name in ZH report', () => {
      setVar(ctx, 'isZh', true);
      setVar(ctx, 'currentReportStation', station);
      setVar(ctx, 'selectedIssueType', 'faultFlatTire');
      const text = ctx.buildReportText();
      assert.ok(text.includes('台北車站'));
      assert.ok(text.includes('輪胎沒氣'));
    });

    it('includes formal city name', () => {
      setVar(ctx, 'isZh', true);
      setVar(ctx, 'currentReportStation', station);
      setVar(ctx, 'selectedIssueType', 'faultOther');
      const text = ctx.buildReportText();
      assert.ok(text.includes('臺北市'));
    });

    it('includes bike and slot counts', () => {
      setVar(ctx, 'isZh', false);
      setVar(ctx, 'currentReportStation', station);
      setVar(ctx, 'selectedIssueType', 'faultOther');
      const text = ctx.buildReportText();
      assert.ok(text.includes('10'));
      assert.ok(text.includes('5'));
    });
  });
});
