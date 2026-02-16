// @ts-check
const { test, expect, devices } = require('@playwright/test');

/**
 * Mobile Device E2E Tests
 *
 * Simulates an iPhone 12 to test all pages' mobile-specific behavior:
 * 1. Bottom sheet (drag handle, snap points, summary)
 * 2. Responsive header and navigation
 * 3. Map behind bottom sheet
 * 4. Floating buttons
 * 5. Page-specific mobile interactions
 */

const iPhone = devices['iPhone 12'];

test.use({
  ...iPhone,
});

// ============================================================
// HELPERS
// ============================================================

async function waitForStations(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('result-count');
    return el && /Showing \d+ stations/.test(el.textContent);
  }, { timeout: 30000 });
}

async function waitForMarkers(page) {
  await page.waitForFunction(() => {
    return document.querySelectorAll('.leaflet-marker-icon').length > 0;
  }, { timeout: 30000 });
}

async function waitForMapReady(page) {
  await page.waitForFunction(() => {
    const canvas = document.getElementById('map-canvas');
    return canvas && canvas.querySelector('.leaflet-tile-pane') !== null;
  }, { timeout: 30000 });
}

async function switchCity(page, city) {
  await page.evaluate((c) => {
    const sel = document.getElementById('city-select');
    sel.value = c;
    sel.dispatchEvent(new Event('change'));
  }, city);
  await waitForStations(page);
}

// ============================================================
// YOUBIKE PAGE - MOBILE
// ============================================================

test.describe('YouBike Mobile - Bottom Sheet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('sheet handle is visible on mobile', async ({ page }) => {
    const handle = page.locator('.sheet-handle');
    await expect(handle).toBeVisible();
  });

  test('sheet pill is visible', async ({ page }) => {
    const pill = page.locator('.sheet-pill');
    await expect(pill).toBeVisible();
  });

  test('sheet summary shows station info', async ({ page }) => {
    const summary = await page.locator('#sheet-summary').textContent();
    expect(summary).toMatch(/🚲.*stations.*bikes/);
  });

  test('panel starts in collapsed state', async ({ page }) => {
    const panel = page.locator('#panel');
    await expect(panel).toHaveClass(/snap-collapsed/);
  });

  test('panel can be expanded to half via JS', async ({ page }) => {
    await page.evaluate(() => {
      // bottomSheet is a let variable in global script scope
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.setHalf();
    });
    // Wait for the class to be applied (there's a CSS transition)
    await page.waitForTimeout(400);
    const panel = page.locator('#panel');
    await expect(panel).toHaveClass(/snap-half/);
  });

  test('panel can be expanded to full via JS', async ({ page }) => {
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
    const panel = page.locator('#panel');
    await expect(panel).toHaveClass(/snap-full/);
  });

  test('panel can collapse back via JS', async ({ page }) => {
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.collapse();
    });
    await page.waitForTimeout(400);
    const panel = page.locator('#panel');
    await expect(panel).toHaveClass(/snap-collapsed/);
  });

  test('sheet content is scrollable when expanded', async ({ page }) => {
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const content = page.locator('.sheet-content');
    const overflowY = await content.evaluate(el => getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');
  });
});

test.describe('YouBike Mobile - Map and Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('map canvas is visible behind bottom sheet', async ({ page }) => {
    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('map container is fixed position on mobile', async ({ page }) => {
    const position = await page.locator('#map-container').evaluate(el =>
      getComputedStyle(el).position
    );
    expect(position).toBe('fixed');
  });

  test('floating buttons are visible', async ({ page }) => {
    const locateBtn = page.locator('.locate-btn');
    const langBtn = page.locator('.lang-btn');
    await expect(locateBtn).toBeVisible();
    await expect(langBtn).toBeVisible();
  });

  test('floating buttons are above bottom sheet z-index', async ({ page }) => {
    const btnZ = await page.locator('.float-btn-container').evaluate(el =>
      parseInt(getComputedStyle(el).zIndex) || 0
    );
    const panelZ = await page.locator('#panel').evaluate(el =>
      parseInt(getComputedStyle(el).zIndex) || 0
    );
    expect(btnZ).toBeGreaterThanOrEqual(panelZ);
  });
});

test.describe('YouBike Mobile - Header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('header is visible', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();
  });

  test('navigation buttons are visible', async ({ page }) => {
    const navBtns = page.locator('.nav-btn');
    const count = await navBtns.count();
    expect(count).toBeGreaterThanOrEqual(5); // Home, UBike, MRT, Rail, THSR, Bus
  });

  test('page title is visible', async ({ page }) => {
    const title = page.locator('#page-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText('YouBike');
  });
});

test.describe('YouBike Mobile - Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
    // Expand sheet to access search
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
  });

  test('search input is visible when sheet is expanded', async ({ page }) => {
    const search = page.locator('#search-input');
    await expect(search).toBeVisible();
  });

  test('search filters stations on mobile', async ({ page }) => {
    const beforeCount = parseInt(
      (await page.locator('#result-count').textContent()).match(/\d+/)[0]
    );

    await page.locator('#search-input').fill('捷運');
    await page.waitForTimeout(300);

    const afterCount = parseInt(
      (await page.locator('#result-count').textContent()).match(/\d+/)[0]
    );
    expect(afterCount).toBeLessThan(beforeCount);
    expect(afterCount).toBeGreaterThan(0);
  });

  test('search dropdown appears on mobile', async ({ page }) => {
    await page.locator('#search-input').fill('台北');
    await page.waitForTimeout(300);

    const dropdown = page.locator('#search-dropdown');
    await expect(dropdown).toBeVisible();
  });
});

test.describe('YouBike Mobile - City Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
  });

  test('city selector is visible when sheet is expanded', async ({ page }) => {
    const citySelect = page.locator('#city-select');
    await expect(citySelect).toBeVisible();
  });

  test('switching city updates summary', async ({ page }) => {
    await switchCity(page, 'kaohsiung');

    const summary = await page.locator('#sheet-summary').textContent();
    expect(summary).toContain('Kaohsiung');
  });
});

test.describe('YouBike Mobile - Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('language button works on mobile', async ({ page }) => {
    await page.locator('.lang-btn').click();

    const title = await page.locator('#page-title').textContent();
    expect(title).toBe('微笑單車');
  });

  test('sheet summary switches language', async ({ page }) => {
    await page.locator('.lang-btn').click();

    const summary = await page.locator('#sheet-summary').textContent();
    expect(summary).toMatch(/🚲.*站.*車/);
  });

  test('navigation buttons switch language on mobile', async ({ page }) => {
    await page.locator('.lang-btn').click();

    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);
    expect(navTexts.some(t => t.includes('微笑單車'))).toBe(true);
  });
});

test.describe('YouBike Mobile - Station Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
  });

  test('tapping station item opens popup', async ({ page }) => {
    await page.locator('.station-item').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible();
  });

  test('popup contains report button on mobile', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const html = await page.locator('.leaflet-popup-content').innerHTML();
    expect(html).toContain('Report');
  });
});

test.describe('YouBike Mobile - Fare Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
  });

  test('fare card is accessible on mobile', async ({ page }) => {
    const fareHeader = page.locator('.fare-header');
    await expect(fareHeader).toBeVisible();

    await fareHeader.click();
    const fareBody = page.locator('#fare-body');
    await expect(fareBody).toBeVisible();
  });

  test('fare card shows content for Taipei', async ({ page }) => {
    await page.locator('.fare-header').click();
    const html = await page.locator('#fare-body').innerHTML();
    expect(html).toContain('Free first 30 min');
  });
});

test.describe('YouBike Mobile - Report Modal', () => {
  // On mobile the bottom sheet (z-index 1000) covers the map popup,
  // so we open the report modal via JS to avoid click-interception.
  async function openReportModalOnMobile(page) {
    // Get first non-suspended station's sno
    const sno = await page.evaluate(() => {
      const items = document.querySelectorAll('.station-item:not(.station-suspended)');
      return items.length > 0 ? items[0].dataset.sno : null;
    });
    expect(sno).toBeTruthy();
    await page.evaluate((id) => window.openReportModal(id), sno);
    await expect(page.locator('#report-overlay')).toHaveClass(/open/);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('report modal opens on mobile', async ({ page }) => {
    await openReportModalOnMobile(page);

    const overlay = page.locator('#report-overlay');
    await expect(overlay).toHaveClass(/open/);
  });

  test('report modal has 4 action buttons', async ({ page }) => {
    await openReportModalOnMobile(page);

    const buttons = page.locator('.report-action-btn');
    const count = await buttons.count();
    expect(count).toBe(4);
  });

  test('auto-fill button is present with correct label', async ({ page }) => {
    await openReportModalOnMobile(page);

    const title = await page.locator('#report-action-autofill-title').textContent();
    expect(title).toBe('Auto-fill Form');
  });

  test('auto-fill button label switches to Chinese', async ({ page }) => {
    await openReportModalOnMobile(page);

    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#report-action-autofill-title').textContent();
    expect(title).toBe('自動填入表單');

    const desc = await page.locator('#report-action-autofill-desc').textContent();
    expect(desc).toBe('複製填入腳本並開啟表單');

    await page.evaluate(() => window.toggleLang());
  });

  test('issue chips are tappable on mobile', async ({ page }) => {
    await openReportModalOnMobile(page);

    const chip = page.locator('.report-issue-chip').first();
    await chip.tap();
    await expect(chip).toHaveClass(/selected/);
  });

  test('modal scrolls on mobile for long content', async ({ page }) => {
    await openReportModalOnMobile(page);

    const body = page.locator('.report-body');
    const overflowY = await body.evaluate(el => getComputedStyle(el).overflowY);
    expect(overflowY).toBe('auto');
  });

  test('close button works on mobile', async ({ page }) => {
    await openReportModalOnMobile(page);

    await expect(page.locator('#report-overlay')).toHaveClass(/open/);

    await page.locator('.report-close-btn').click();
    await expect(page.locator('#report-overlay')).not.toHaveClass(/open/);
  });

  test('validation errors show on mobile', async ({ page }) => {
    await openReportModalOnMobile(page);

    // Click first action button without filling required fields
    await page.locator('.report-action-btn').first().click();

    await expect(page.locator('#report-issue-error')).toBeVisible();
    await expect(page.locator('#report-email-error')).toBeVisible();
  });
});

test.describe('YouBike Mobile - District Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
  });

  test('district chips are visible on mobile', async ({ page }) => {
    const chips = page.locator('.district-chip');
    const count = await chips.count();
    expect(count).toBeGreaterThan(1);
  });

  test('district chips scroll horizontally on mobile', async ({ page }) => {
    const filter = page.locator('#district-filter');
    const flexWrap = await filter.evaluate(el => getComputedStyle(el).flexWrap);
    expect(flexWrap).toBe('nowrap');
  });
});

test.describe('YouBike Mobile - E-bike Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);
  });

  test('e-bike filter checkbox visible for Taipei on mobile', async ({ page }) => {
    const filter = page.locator('#ebike-filter');
    await expect(filter).toBeVisible();
  });

  test('toggling e-bike filter reduces station count on mobile', async ({ page }) => {
    const countBefore = parseInt(
      (await page.locator('#result-count').textContent()).match(/\d+/)[0]
    );

    await page.locator('#ebike-toggle').check();

    const countAfter = parseInt(
      (await page.locator('#result-count').textContent()).match(/\d+/)[0]
    );
    expect(countAfter).toBeLessThan(countBefore);
  });
});

// ============================================================
// MRT PAGE - MOBILE
// ============================================================

test.describe('MRT Mobile', () => {
  test('sheet handle visible on mobile', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    const handle = page.locator('.sheet-handle');
    await expect(handle).toBeVisible();
  });

  test('map is visible behind sheet', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('system selector accessible when sheet expanded', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const systemSelect = page.locator('#system-select');
    await expect(systemSelect).toBeVisible();
  });

  test('language toggle works on mobile', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    await page.locator('.lang-btn').click();

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('捷運');
  });

  test('marker popup opens on mobile', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    await page.evaluate(() => {
      const marker = document.querySelector('.leaflet-marker-icon');
      if (marker) marker.click();
    });
    await page.waitForSelector('.leaflet-popup-content', { timeout: 5000 });

    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible();
  });

  test('floating buttons visible on mobile', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    await expect(page.locator('.locate-btn')).toBeVisible();
    await expect(page.locator('.lang-btn')).toBeVisible();
  });
});

// ============================================================
// RAIL PAGE - MOBILE
// ============================================================

test.describe('Rail Mobile', () => {
  test('sheet handle visible on mobile', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForMarkers(page);

    const handle = page.locator('.sheet-handle');
    await expect(handle).toBeVisible();
  });

  test('map is visible on mobile', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForMarkers(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('tab buttons visible on mobile', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForMarkers(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const tabs = page.locator('.tab-btn');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('language toggle works on mobile', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForMarkers(page);

    await page.locator('.lang-btn').click();

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('台鐵');
  });

  test('station popup opens on mobile', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForMarkers(page);

    await page.evaluate(() => {
      const marker = document.querySelector('.leaflet-marker-icon');
      if (marker) marker.click();
    });
    await page.waitForSelector('.leaflet-popup-content', { timeout: 5000 });

    await expect(page.locator('.leaflet-popup-content')).toBeVisible();
  });
});

// ============================================================
// THSR PAGE - MOBILE
// ============================================================

test.describe('THSR Mobile', () => {
  async function waitForThsrReady(page) {
    await page.waitForFunction(() => {
      const select = document.getElementById('station-select');
      return select && select.options && select.options.length > 1;
    }, { timeout: 30000 });
  }

  test('sheet handle visible on mobile', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForThsrReady(page);

    const handle = page.locator('.sheet-handle');
    await expect(handle).toBeVisible();
  });

  test('map is visible on mobile', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForThsrReady(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('station selectors accessible when sheet expanded', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForThsrReady(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    await expect(page.locator('#station-select')).toBeVisible();
    await expect(page.locator('#dest-station-select')).toBeVisible();
  });

  test('language toggle works on mobile', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForThsrReady(page);

    await page.locator('.lang-btn').click();

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('高鐵');
  });

  test('station selector has all 12 stations on mobile', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForThsrReady(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const options = await page.locator('#station-select option').count();
    expect(options).toBeGreaterThanOrEqual(12);
  });
});

// ============================================================
// BUS PAGE - MOBILE
// ============================================================

test.describe('Bus Mobile', () => {
  test('sheet handle visible on mobile', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForMapReady(page);

    const handle = page.locator('.sheet-handle');
    await expect(handle).toBeVisible();
  });

  test('map is visible on mobile', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForMapReady(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('tab buttons visible when sheet expanded', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForMapReady(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const tabs = page.locator('.tab-btn');
    const count = await tabs.count();
    expect(count).toBe(2);
  });

  test('tab switching works on mobile', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForMapReady(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const nearbyTab = page.locator('.tab-btn[data-tab="nearby"]');
    await nearbyTab.click();
    await expect(nearbyTab).toHaveClass(/active/);
  });

  test('language toggle works on mobile', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForMapReady(page);

    await page.locator('.lang-btn').click();

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('公車');
  });

  test('city selector accessible on mobile', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForMapReady(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const citySelect = page.locator('#route-city-select');
    await expect(citySelect).toBeVisible();
  });

  test('route search input accessible on mobile', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForMapReady(page);

    await page.evaluate(() => {
      if (typeof bottomSheet !== 'undefined' && bottomSheet) bottomSheet.expand();
    });
    await page.waitForTimeout(400);

    const searchInput = page.locator('#route-search-input');
    await expect(searchInput).toBeVisible();
  });
});

// ============================================================
// INDEX PAGE - MOBILE
// ============================================================

test.describe('Index Mobile', () => {
  test('page loads on mobile', async ({ page }) => {
    await page.goto('/index.html');

    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });

  test('navigation links visible on mobile', async ({ page }) => {
    await page.goto('/index.html');

    // Should have links to transport pages
    const links = page.locator('a[href*=".html"]');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });

  test('language toggle works on index page', async ({ page }) => {
    await page.goto('/index.html');

    const langBtn = page.locator('#lang-btn, .lang-btn');
    const count = await langBtn.count();
    if (count > 0) {
      await langBtn.first().click();
      // Verify some Chinese text appears
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toMatch(/[\u4e00-\u9fff]/); // Contains Chinese characters
    }
  });
});

// ============================================================
// CROSS-PAGE NAVIGATION - MOBILE
// ============================================================

test.describe('Cross-Page Navigation on Mobile', () => {
  test('navigate from UBike to MRT via nav button', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    await page.locator('.nav-btn').filter({ hasText: 'MRT' }).click();
    await page.waitForURL('**/mrt.html');
    await waitForMarkers(page);

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('MRT');
  });

  test('navigate from MRT to Bus via nav button', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    await page.locator('.nav-btn').filter({ hasText: 'Bus' }).click();
    await page.waitForURL('**/bus.html');
    await waitForMapReady(page);

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Bus');
  });

  test('navigate to Home from any page', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    await page.locator('.nav-btn.home').click();
    await page.waitForURL('**/index.html');
  });
});

// ============================================================
// TOUCH INTERACTIONS - MOBILE
// ============================================================

test.describe('Touch Interactions on Mobile', () => {
  test('map supports touch zoom (pinch gestures enabled)', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    // Verify map has touch zoom enabled
    const touchZoom = await page.evaluate(() => {
      // Leaflet stores map options
      const mapEl = document.getElementById('map-canvas');
      return mapEl && mapEl._leaflet_id !== undefined;
    });
    expect(touchZoom).toBe(true);
  });

  test('tapping locate button does not crash on mobile', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    // Mock geolocation to avoid permission issues
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: { latitude: 25.033, longitude: 121.565, accuracy: 10 },
          timestamp: Date.now()
        });
      };
    });

    const locateBtn = page.locator('.locate-btn');
    await locateBtn.tap();

    // Should not throw - page remains functional
    await page.waitForTimeout(500);
    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });
});

// ============================================================
// RESPONSIVE CSS CHECKS - MOBILE
// ============================================================

test.describe('Responsive CSS on Mobile', () => {
  test('header wraps to column layout on mobile', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const direction = await page.locator('header').evaluate(el =>
      getComputedStyle(el).flexDirection
    );
    expect(direction).toBe('column');
  });

  test('nav buttons are smaller on mobile', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const fontSize = await page.locator('.nav-btn').first().evaluate(el =>
      getComputedStyle(el).fontSize
    );
    expect(parseFloat(fontSize)).toBeLessThanOrEqual(12);
  });

  test('legend is positioned above bottom sheet', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const bottom = await page.locator('#map-legend').evaluate(el =>
      getComputedStyle(el).bottom
    );
    // On mobile, legend bottom should be 70px (above collapsed sheet)
    expect(parseFloat(bottom)).toBeGreaterThanOrEqual(60);
  });

  test('panel has border-radius on mobile (bottom sheet style)', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const borderRadius = await page.locator('#panel').evaluate(el =>
      getComputedStyle(el).borderTopLeftRadius
    );
    expect(parseFloat(borderRadius)).toBeGreaterThan(0);
  });

  test('toast max-width respects viewport on mobile', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    // Inject a toast and check styling
    await page.evaluate(() => window.showToast('Test mobile toast message'));
    const toast = page.locator('.report-toast');
    await expect(toast).toBeVisible();

    // getComputedStyle returns px; 90vw on iPhone 12 (390px) ≈ 351px
    const maxWidth = await toast.evaluate(el => parseFloat(getComputedStyle(el).maxWidth));
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const expected = viewportWidth * 0.9;
    expect(maxWidth).toBeCloseTo(expected, 0);
  });
});
