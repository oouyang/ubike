'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createBrowserContext, loadJsFile } = require('./helpers/load-script');

describe('js/bottom-sheet.js', () => {
  let ctx;

  beforeEach(() => {
    ctx = createBrowserContext();
    // Set up mobile window dimensions for calculations
    ctx.window.innerWidth = 375;
    ctx.window.innerHeight = 812;
    ctx.innerWidth = 375;
    ctx.innerHeight = 812;
    loadJsFile('js/bottom-sheet.js', ctx);
  });

  describe('BottomSheet class', () => {
    it('is defined on window', () => {
      assert.ok(ctx.window.BottomSheet);
      assert.equal(typeof ctx.window.BottomSheet, 'function');
    });
  });

  describe('constructor', () => {
    it('sets initial snap from options', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el, { initialSnap: 'half' });
      assert.equal(sheet.currentSnap, 'half');
    });

    it('defaults to collapsed', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el);
      assert.equal(sheet.currentSnap, 'collapsed');
    });
  });

  describe('getState()', () => {
    it('returns current snap', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el, { initialSnap: 'full' });
      assert.equal(sheet.getState(), 'full');
    });
  });

  describe('getSnapTranslateY()', () => {
    it('returns different values for each snap point', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el);
      const collapsed = sheet.getSnapTranslateY('collapsed');
      const half = sheet.getSnapTranslateY('half');
      const full = sheet.getSnapTranslateY('full');

      // collapsed should have the highest translateY (most hidden)
      assert.ok(collapsed > half, 'collapsed translateY should be > half');
      assert.ok(half > full, 'half translateY should be > full');
    });

    it('collapsed shows 56px (handle)', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el);
      const panelHeight = ctx.window.innerHeight * 0.9;
      const collapsed = sheet.getSnapTranslateY('collapsed');
      assert.equal(collapsed, panelHeight - 56);
    });

    it('half shows 50% of viewport', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el);
      const panelHeight = ctx.window.innerHeight * 0.9;
      const half = sheet.getSnapTranslateY('half');
      assert.equal(half, panelHeight - (ctx.window.innerHeight * 0.5));
    });

    it('full shows 90% of viewport', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el);
      const panelHeight = ctx.window.innerHeight * 0.9;
      const full = sheet.getSnapTranslateY('full');
      assert.equal(full, panelHeight - (ctx.window.innerHeight * 0.9));
      assert.equal(full, 0);
    });

    it('default returns collapsed value', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el);
      assert.equal(
        sheet.getSnapTranslateY('unknown'),
        sheet.getSnapTranslateY('collapsed')
      );
    });
  });

  describe('snapPoints', () => {
    it('has three snap points', () => {
      const el = {
        classList: {
          _classes: new Set(),
          add(...cls) { cls.forEach(c => this._classes.add(c)); },
          remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        querySelector() { return null; }
      };

      const sheet = new ctx.window.BottomSheet(el);
      assert.equal(sheet.snapPoints.length, 3);
      assert.equal(sheet.snapPoints[0], 'collapsed');
      assert.equal(sheet.snapPoints[1], 'half');
      assert.equal(sheet.snapPoints[2], 'full');
    });
  });
});
