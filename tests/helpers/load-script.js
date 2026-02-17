'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/**
 * Create a mock localStorage (simple in-memory implementation)
 */
function createMockLocalStorage() {
  const store = {};
  return {
    getItem(key) { return store[key] ?? null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    clear() { Object.keys(store).forEach(k => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] ?? null; },
    _store: store
  };
}

/**
 * Create a minimal mock document for DOM operations
 */
function createMockDocument() {
  const elements = {};
  const mockElement = (tag) => ({
    tagName: tag,
    textContent: '',
    innerHTML: '',
    value: '',
    style: {},
    dataset: {},
    classList: {
      _classes: new Set(),
      add(...cls) { cls.forEach(c => this._classes.add(c)); },
      remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) { this._classes.delete(c); return false; }
          this._classes.add(c); return true;
        }
        if (force) { this._classes.add(c); } else { this._classes.delete(c); }
        return force;
      },
      contains(c) { return this._classes.has(c); }
    },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    scrollIntoView() {},
    options: [],
    children: [],
    appendChild() {},
    click() {}
  });

  return {
    title: '',
    getElementById(id) { return elements[id] || (elements[id] = mockElement('div')); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) { return mockElement(tag); },
    addEventListener() {},
    _elements: elements
  };
}

/**
 * Create a Leaflet stub that returns chainable objects
 */
function createLeafletStub() {
  const chainable = () => {
    const obj = {
      setView() { return obj; },
      addTo() { return obj; },
      bindPopup() { return obj; },
      on() { return obj; },
      openPopup() { return obj; },
      setPopupContent() { return obj; },
      getLatLng() { return { lat: 0, lng: 0 }; },
      removeLayer() { return obj; },
      fitBounds() { return obj; },
      invalidateSize() { return obj; }
    };
    return obj;
  };

  return {
    map() { return chainable(); },
    tileLayer() { return chainable(); },
    marker() { return chainable(); },
    circleMarker() { return chainable(); },
    polyline() { return chainable(); },
    divIcon(opts) { return { options: opts }; },
    latLngBounds() { return chainable(); }
  };
}

/**
 * Create a browser-like vm context with mocked globals
 * @param {Object} overrides - Extra globals to inject or override
 * @returns {vm.Context}
 */
function createBrowserContext(overrides = {}) {
  const localStorage = createMockLocalStorage();
  const document = createMockDocument();
  const window = {};
  const navigator = { language: 'en-US', userAgent: '', geolocation: { getCurrentPosition() {} } };

  // Pre-populate window with stub methods
  window.addEventListener = function() {};
  window.removeEventListener = function() {};
  window.matchMedia = function() { return { matches: false }; };
  window.innerWidth = 1024;
  window.innerHeight = 768;

  const ctx = {
    window,
    document,
    navigator,
    localStorage,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    Date,
    Math,
    JSON,
    Array,
    Object,
    Number,
    String,
    Boolean,
    RegExp,
    Map,
    Set,
    Promise,
    Error,
    TypeError,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    L: createLeafletStub(),
    fetch: async () => ({ ok: true, json: async () => ([]), status: 200 }),
    alert() {},
    matchMedia: function() { return { matches: false }; },
    addEventListener: function() {},
    removeEventListener: function() {},
    ...overrides,
    // Ensure window references self
    get self() { return ctx; }
  };

  // window should reference the context itself
  Object.assign(window, ctx);
  ctx.window = window;

  return vm.createContext(ctx);
}

/**
 * Load a .js file and run it in the given vm context
 * @param {string} filePath - Absolute or project-relative path to .js file
 * @param {vm.Context} ctx - vm context
 */
function loadJsFile(filePath, ctx) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '../../', filePath);
  const code = fs.readFileSync(absPath, 'utf-8');
  // Wrap to avoid strict-mode issues with module.exports check
  const wrapped = code.replace(
    /if\s*\(\s*typeof\s+module\s*!==\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)/g,
    'if (false)'
  );
  vm.runInContext(wrapped, ctx, { filename: absPath });
}

/**
 * Extract inline <script> blocks from an HTML file and run them in context.
 * Skips <script src="..."> (external scripts).
 * @param {string} filePath - Path to HTML file
 * @param {vm.Context} ctx - vm context
 */
function loadHtmlScript(filePath, ctx) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(__dirname, '../../', filePath);
  const html = fs.readFileSync(absPath, 'utf-8');

  // Match <script> blocks that do NOT have a src attribute
  const scriptRegex = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const code = match[1].trim();
    if (code) {
      vm.runInContext(code, ctx, { filename: absPath });
    }
  }
}

/**
 * Expose block-scoped variables from the vm context by evaluating them.
 * Use after loadHtmlScript or loadJsFile to read const/let variables.
 * @param {vm.Context} ctx - vm context
 * @param {string[]} names - Variable names to expose on the context
 */
function exposeVars(ctx, names) {
  for (const name of names) {
    try {
      vm.runInContext(`this.${name} = ${name};`, ctx);
    } catch (e) {
      // Variable not defined in this context, skip
    }
  }
}

/**
 * Set a closure-scoped variable inside a vm context.
 * @param {vm.Context} ctx - vm context
 * @param {string} name - Variable name
 * @param {*} value - Value to set (will be JSON-serialized)
 */
function setVar(ctx, name, value) {
  vm.runInContext(`${name} = ${JSON.stringify(value)};`, ctx);
}

module.exports = {
  createBrowserContext,
  createMockLocalStorage,
  createMockDocument,
  createLeafletStub,
  loadJsFile,
  loadHtmlScript,
  exposeVars,
  setVar
};
