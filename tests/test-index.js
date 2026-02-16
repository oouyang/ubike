'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createBrowserContext, loadHtmlScript, exposeVars } = require('./helpers/load-script');

describe('index.html', () => {

  // ========== getInstallHintText ==========

  describe('getInstallHintText()', () => {
    function makeCtx(overrides = {}) {
      const mediaMatches = overrides.standalone ? true : false;
      const ctx = createBrowserContext({
        navigator: {
          language: 'en-US',
          userAgent: overrides.userAgent || 'Mozilla/5.0',
          standalone: overrides.standalone || false,
          ...(overrides.navigator || {})
        }
      });
      // Mock matchMedia
      ctx.window.matchMedia = (query) => ({
        matches: query.includes('standalone') ? mediaMatches : false
      });
      ctx.matchMedia = ctx.window.matchMedia;
      loadHtmlScript('index.html', ctx);
      exposeVars(ctx, ['getInstallHintText', 'isZh', 'updateInstallHint']);
      return ctx;
    }

    it('returns null when in standalone mode', () => {
      const ctx = makeCtx({ standalone: true });
      const result = ctx.getInstallHintText();
      assert.equal(result, null);
    });

    it('returns null when dismissed', () => {
      const ctx = makeCtx();
      ctx.localStorage.setItem('install-hint-dismissed', '1');
      const result = ctx.getInstallHintText();
      assert.equal(result, null);
    });

    it('returns iOS Safari hint', () => {
      const ctx = makeCtx({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      });
      const result = ctx.getInstallHintText();
      assert.ok(result);
      assert.ok(result.includes('Share') || result.includes('分享'));
    });

    it('returns Android Chrome hint', () => {
      const ctx = makeCtx({
        userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
      });
      const result = ctx.getInstallHintText();
      assert.ok(result);
      assert.ok(result.includes('Install') || result.includes('Chrome'));
    });

    it('returns Chrome desktop hint', () => {
      const ctx = makeCtx({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
      });
      const result = ctx.getInstallHintText();
      assert.ok(result);
      assert.ok(result.includes('install') || result.includes('安裝'));
    });

    it('returns Edge hint', () => {
      const ctx = makeCtx({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
      });
      const result = ctx.getInstallHintText();
      assert.ok(result);
    });

    it('returns Firefox hint', () => {
      const ctx = makeCtx({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'
      });
      const result = ctx.getInstallHintText();
      assert.ok(result);
      assert.ok(result.includes('Chrome') || result.includes('Edge'));
    });

    it('returns Mac Safari hint', () => {
      const ctx = makeCtx({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
      });
      const result = ctx.getInstallHintText();
      assert.ok(result);
      assert.ok(result.includes('Dock') || result.includes('File'));
    });

    it('uses Chinese text when isZh=true', () => {
      const ctx = makeCtx({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      });
      vm.runInContext('isZh = true;', ctx);
      const result = ctx.getInstallHintText();
      assert.ok(result);
      assert.ok(result.includes('分享'));
    });
  });
});
