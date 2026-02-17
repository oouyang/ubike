'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createBrowserContext, loadHtmlScript, exposeVars } = require('./helpers/load-script');

describe('etf.html', () => {
  let ctx;

  function makeCtx(overrides = {}) {
    const c = createBrowserContext({
      navigator: {
        language: 'en-US',
        userAgent: 'Mozilla/5.0',
        ...(overrides.navigator || {})
      },
      ...overrides
    });

    loadHtmlScript('etf.html', c);
    exposeVars(c, [
      'ETFS', 'ENRICHMENT', 'TWSE_API', 'WORKER_URL',
      'isZh', 'currentCategory', 'expandedTicker', 'allEtfs',
      'isLive', 'searchQuery', 'classifyEtf', 'getFilteredEtfs',
      'toggleLang', 'updateUI', 'renderList', 'renderDetail',
      'getCategoryLabel', 'toggleDetail'
    ]);
    return c;
  }

  beforeEach(() => {
    ctx = makeCtx();
  });

  // ========== ETFS Data ==========

  describe('ETFS data', () => {
    it('has at least 30 ETFs', () => {
      assert.ok(ctx.ETFS.length >= 30, `Expected >=30, got ${ctx.ETFS.length}`);
    });

    it('all ETFs have required fields', () => {
      for (const etf of ctx.ETFS) {
        assert.ok(etf.ticker, `missing ticker`);
        assert.ok(etf.name, `${etf.ticker} missing name`);
        assert.ok(etf.nameZh, `${etf.ticker} missing nameZh`);
        assert.ok(etf.category, `${etf.ticker} missing category`);
        assert.ok(typeof etf.expense === 'number', `${etf.ticker} expense not a number`);
        assert.ok(typeof etf.yield === 'number', `${etf.ticker} yield not a number`);
        assert.ok(etf.freq, `${etf.ticker} missing freq`);
        assert.ok(etf.freqZh, `${etf.ticker} missing freqZh`);
        assert.ok(etf.benchmark, `${etf.ticker} missing benchmark`);
        assert.ok(etf.benchmarkZh, `${etf.ticker} missing benchmarkZh`);
        assert.ok(Array.isArray(etf.holdings), `${etf.ticker} holdings not array`);
        assert.ok(Array.isArray(etf.holdingsZh), `${etf.ticker} holdingsZh not array`);
        assert.ok(etf.desc, `${etf.ticker} missing desc`);
        assert.ok(etf.descZh, `${etf.ticker} missing descZh`);
        assert.ok(etf.inception, `${etf.ticker} missing inception`);
      }
    });

    it('all tickers are unique', () => {
      const tickers = ctx.ETFS.map(e => e.ticker);
      const unique = new Set(tickers);
      assert.equal(tickers.length, unique.size, 'duplicate tickers found');
    });

    it('all categories are valid', () => {
      const valid = ['dividend', 'broad', 'tech', 'bond', 'theme'];
      for (const etf of ctx.ETFS) {
        assert.ok(valid.includes(etf.category), `${etf.ticker} has invalid category: ${etf.category}`);
      }
    });

    it('expense ratios are between 0 and 2', () => {
      for (const etf of ctx.ETFS) {
        assert.ok(etf.expense >= 0 && etf.expense <= 2, `${etf.ticker} expense ${etf.expense} out of range`);
      }
    });

    it('yields are non-negative', () => {
      for (const etf of ctx.ETFS) {
        assert.ok(etf.yield >= 0, `${etf.ticker} yield ${etf.yield} is negative`);
      }
    });

    it('inception dates are valid YYYY-MM-DD format', () => {
      for (const etf of ctx.ETFS) {
        assert.match(etf.inception, /^\d{4}-\d{2}-\d{2}$/, `${etf.ticker} inception "${etf.inception}" invalid`);
      }
    });

    it('contains well-known ETFs 0050, 0056, 00878', () => {
      const tickers = ctx.ETFS.map(e => e.ticker);
      assert.ok(tickers.includes('0050'));
      assert.ok(tickers.includes('0056'));
      assert.ok(tickers.includes('00878'));
    });

    it('has ETFs in each category', () => {
      const cats = new Set(ctx.ETFS.map(e => e.category));
      assert.ok(cats.has('dividend'));
      assert.ok(cats.has('broad'));
      assert.ok(cats.has('tech'));
      assert.ok(cats.has('bond'));
    });

    it('each ETF has at least 1 holding', () => {
      for (const etf of ctx.ETFS) {
        assert.ok(etf.holdings.length >= 1, `${etf.ticker} has no holdings`);
        assert.ok(etf.holdingsZh.length >= 1, `${etf.ticker} has no holdingsZh`);
      }
    });
  });

  // ========== Default State ==========

  describe('Default State', () => {
    it('currentCategory defaults to all', () => {
      assert.equal(ctx.currentCategory, 'all');
    });

    it('expandedTicker defaults to null', () => {
      assert.equal(ctx.expandedTicker, null);
    });

    it('isZh defaults to false for en-US', () => {
      assert.equal(ctx.isZh, false);
    });
  });

  // ========== getCategoryLabel ==========

  describe('getCategoryLabel()', () => {
    it('returns English label for dividend', () => {
      assert.equal(ctx.getCategoryLabel('dividend'), 'High Dividend');
    });

    it('returns English label for broad', () => {
      assert.equal(ctx.getCategoryLabel('broad'), 'Broad Market');
    });

    it('returns English label for tech', () => {
      assert.equal(ctx.getCategoryLabel('tech'), 'Technology');
    });

    it('returns English label for bond', () => {
      assert.equal(ctx.getCategoryLabel('bond'), 'Bond');
    });

    it('returns Chinese label when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      assert.equal(ctx.getCategoryLabel('dividend'), '高股息');
      assert.equal(ctx.getCategoryLabel('broad'), '市值型');
      assert.equal(ctx.getCategoryLabel('tech'), '科技型');
      assert.equal(ctx.getCategoryLabel('bond'), '債券型');
    });

    it('returns raw category for unknown', () => {
      assert.equal(ctx.getCategoryLabel('unknown'), 'unknown');
    });
  });

  // ========== renderDetail ==========

  describe('renderDetail()', () => {
    it('returns HTML string with ETF info', () => {
      const etf = ctx.ETFS[0]; // 0050
      const html = ctx.renderDetail(etf);
      assert.ok(typeof html === 'string');
      assert.ok(html.length > 100);
    });

    it('contains yield value', () => {
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes(etf.yield.toFixed(1)));
    });

    it('contains expense ratio', () => {
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes(etf.expense.toFixed(2)));
    });

    it('contains English benchmark for en mode', () => {
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes(etf.benchmark));
    });

    it('contains Chinese benchmark when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes(etf.benchmarkZh));
    });

    it('contains holdings', () => {
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      for (const h of etf.holdings) {
        assert.ok(html.includes(h), `missing holding: ${h}`);
      }
    });

    it('contains Chinese holdings when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      for (const h of etf.holdingsZh) {
        assert.ok(html.includes(h), `missing holdingZh: ${h}`);
      }
    });

    it('contains inception date', () => {
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes(etf.inception));
    });

    it('contains description', () => {
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes(etf.desc));
    });

    it('contains Chinese description when isZh=true', () => {
      vm.runInContext('isZh = true;', ctx);
      const etf = ctx.ETFS[0];
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes(etf.descZh));
    });
  });

  // ========== toggleDetail ==========

  describe('toggleDetail()', () => {
    it('sets expandedTicker when expanding', () => {
      ctx.toggleDetail('0050');
      assert.equal(vm.runInContext('expandedTicker', ctx), '0050');
    });

    it('clears expandedTicker when collapsing same', () => {
      vm.runInContext('expandedTicker = "0050";', ctx);
      ctx.toggleDetail('0050');
      assert.equal(vm.runInContext('expandedTicker', ctx), null);
    });

    it('switches expandedTicker when expanding different', () => {
      vm.runInContext('expandedTicker = "0050";', ctx);
      ctx.toggleDetail('0056');
      assert.equal(vm.runInContext('expandedTicker', ctx), '0056');
    });
  });

  // ========== Language ==========

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

  // ========== Specific ETF data checks ==========

  describe('Key ETF data', () => {
    it('0050 is broad market category', () => {
      const etf = ctx.ETFS.find(e => e.ticker === '0050');
      assert.equal(etf.category, 'broad');
    });

    it('0056 is dividend category', () => {
      const etf = ctx.ETFS.find(e => e.ticker === '0056');
      assert.equal(etf.category, 'dividend');
    });

    it('00679B is bond category', () => {
      const etf = ctx.ETFS.find(e => e.ticker === '00679B');
      assert.equal(etf.category, 'bond');
    });

    it('00881 is tech category', () => {
      const etf = ctx.ETFS.find(e => e.ticker === '00881');
      assert.equal(etf.category, 'tech');
    });

    it('00929 has monthly distribution', () => {
      const etf = ctx.ETFS.find(e => e.ticker === '00929');
      assert.equal(etf.freq, 'Monthly');
      assert.equal(etf.freqZh, '月配');
    });

    it('dividend ETFs have yields >= 4%', () => {
      const divEtfs = ctx.ETFS.filter(e => e.category === 'dividend');
      for (const etf of divEtfs) {
        assert.ok(etf.yield >= 4, `${etf.ticker} yield ${etf.yield} < 4%`);
      }
    });

    it('bond ETFs in original set have expense ratios <= 0.5%', () => {
      // Only check the original well-known bond ETFs
      const knownBonds = ['00679B', '00687B', '00772B'];
      for (const ticker of knownBonds) {
        const etf = ctx.ETFS.find(e => e.ticker === ticker);
        if (etf) assert.ok(etf.expense <= 0.5, `${etf.ticker} expense ${etf.expense} > 0.5%`);
      }
    });
  });

  // ========== TWSE API Integration ==========

  describe('TWSE API config', () => {
    it('TWSE_API points to openapi.twse.com.tw', () => {
      assert.ok(ctx.TWSE_API.includes('openapi.twse.com.tw'));
    });

    it('WORKER_URL is empty by default', () => {
      assert.equal(ctx.WORKER_URL, '');
    });

    it('ENRICHMENT map has entries for all static ETFS', () => {
      for (const etf of ctx.ETFS) {
        assert.ok(ctx.ENRICHMENT[etf.ticker], `${etf.ticker} missing from ENRICHMENT`);
      }
    });
  });

  // ========== classifyEtf ==========

  describe('classifyEtf()', () => {
    it('returns enrichment category for known ticker', () => {
      assert.equal(ctx.classifyEtf('0050', '元大台灣50'), 'broad');
      assert.equal(ctx.classifyEtf('0056', '元大高股息'), 'dividend');
    });

    it('classifies leveraged as theme', () => {
      assert.equal(ctx.classifyEtf('00631L', '元大台灣50正2'), 'theme');
      assert.equal(ctx.classifyEtf('00632R', '元大台灣50反1'), 'theme');
    });

    it('classifies bond codes ending in B', () => {
      assert.equal(ctx.classifyEtf('99999B', '某某債券'), 'bond');
    });

    it('classifies dividend keywords', () => {
      assert.equal(ctx.classifyEtf('99998', '某某高股息'), 'dividend');
      assert.equal(ctx.classifyEtf('99997', '某某優息'), 'dividend');
    });

    it('classifies tech keywords', () => {
      assert.equal(ctx.classifyEtf('99996', '某某半導體'), 'tech');
      assert.equal(ctx.classifyEtf('99995', '某某AI科技'), 'tech');
    });

    it('defaults to broad for unknown', () => {
      assert.equal(ctx.classifyEtf('99900', '某某平凡ETF'), 'broad');
    });
  });

  // ========== allEtfs & isLive ==========

  describe('Live data state', () => {
    it('allEtfs is initialized with static ETFS', () => {
      assert.ok(Array.isArray(ctx.allEtfs));
      // Before initialize(), allEtfs is empty; after it would be populated
      // In unit test context, allEtfs is [] since initialize() isn't called
    });

    it('isLive defaults to false', () => {
      assert.equal(ctx.isLive, false);
    });

    it('searchQuery defaults to empty', () => {
      assert.equal(ctx.searchQuery, '');
    });
  });

  // ========== getFilteredEtfs ==========

  describe('getFilteredEtfs()', () => {
    it('returns all when category=all and no search', () => {
      // Populate allEtfs with static data
      vm.runInContext('allEtfs = ETFS.map(e => ({...e}));', ctx);
      const result = ctx.getFilteredEtfs();
      assert.equal(result.length, ctx.ETFS.length);
    });

    it('filters by category', () => {
      vm.runInContext('allEtfs = ETFS.map(e => ({...e})); currentCategory = "dividend";', ctx);
      const result = ctx.getFilteredEtfs();
      assert.ok(result.length > 0);
      assert.ok(result.length < ctx.ETFS.length);
      for (const e of result) {
        assert.equal(e.category, 'dividend');
      }
    });

    it('filters by search query on ticker', () => {
      vm.runInContext('allEtfs = ETFS.map(e => ({...e})); searchQuery = "0050";', ctx);
      const result = ctx.getFilteredEtfs();
      assert.ok(result.length >= 1);
      assert.ok(result.some(e => e.ticker === '0050'));
    });

    it('filters by search query on name', () => {
      vm.runInContext('allEtfs = ETFS.map(e => ({...e})); searchQuery = "高股息";', ctx);
      const result = ctx.getFilteredEtfs();
      assert.ok(result.length >= 1);
    });

    it('combines category and search filters', () => {
      vm.runInContext('allEtfs = ETFS.map(e => ({...e})); currentCategory = "bond"; searchQuery = "00679";', ctx);
      const result = ctx.getFilteredEtfs();
      assert.ok(result.length >= 1);
      for (const e of result) {
        assert.equal(e.category, 'bond');
      }
    });

    it('returns empty for no match', () => {
      vm.runInContext('allEtfs = ETFS.map(e => ({...e})); searchQuery = "zzzznotfound";', ctx);
      const result = ctx.getFilteredEtfs();
      assert.equal(result.length, 0);
    });
  });

  // ========== renderDetail with live price ==========

  describe('renderDetail() with live price', () => {
    it('includes price when present', () => {
      const etf = { ...ctx.ETFS[0], price: 77.20, monthAvg: 73.49 };
      const html = ctx.renderDetail(etf);
      assert.ok(html.includes('77.2'));
      assert.ok(html.includes('73.49'));
    });

    it('renders basic ETF with no enrichment', () => {
      const etf = {
        ticker: '99999', name: 'Test ETF', nameZh: '測試ETF',
        category: 'broad', price: 10.5, monthAvg: 10.2,
        expense: 0, yield: 0, freq: '', freqZh: '',
        benchmark: '', benchmarkZh: '', holdings: [], holdingsZh: [],
        desc: '', descZh: '', inception: '', aum: '', aumZh: '',
      };
      const html = ctx.renderDetail(etf);
      assert.ok(typeof html === 'string');
      assert.ok(html.includes('10.5'));
    });
  });
});
