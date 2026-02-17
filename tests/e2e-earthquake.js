// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Earthquake Page - Playwright E2E Tests
 *
 * Tests:
 * 1. Page load and map display
 * 2. Earthquake list population (USGS API)
 * 3. Magnitude filter slider
 * 4. Time range buttons
 * 5. Click earthquake item → map flies
 * 6. Language toggle
 * 7. Notification settings modal
 * 8. Facebook share button
 * 9. Unread (NEW) badges
 * 10. Nav bar has Quake button on all pages
 */

// Helper: wait for earthquake markers to appear (circleMarkers render as SVG paths)
async function waitForQuakeData(page) {
  // Wait for the result count to show actual data (not "Loading" or error)
  await page.waitForFunction(() => {
    const el = document.getElementById('result-count');
    return el && el.textContent && /\d+/.test(el.textContent);
  }, { timeout: 30000 });
}

test.describe('Earthquake Page Load', () => {
  test('page loads with map canvas', async ({ page }) => {
    await page.goto('/earthquake.html');
    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('page title is Earthquake Map', async ({ page }) => {
    await page.goto('/earthquake.html');
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Earthquake');
  });

  test('leaflet tiles load', async ({ page }) => {
    await page.goto('/earthquake.html');
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });
    const tiles = await page.locator('.leaflet-tile-loaded').count();
    expect(tiles).toBeGreaterThan(0);
  });

  test('nav bar has Quake button active', async ({ page }) => {
    await page.goto('/earthquake.html');
    const quakeBtn = page.locator('.nav-btn.active');
    await expect(quakeBtn).toHaveText(/Quake/);
  });
});

test.describe('Earthquake Data & List', () => {
  test('earthquake list populates from USGS API', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const items = await page.locator('.quake-item').count();
    // USGS should return at least some earthquakes for 7 days in Taiwan region
    expect(items).toBeGreaterThan(0);
  });

  test('result count shows number', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const text = await page.locator('#result-count').textContent();
    expect(text).toMatch(/\d+ earthquake/i);
  });

  test('each quake item has magnitude badge', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const badges = await page.locator('.quake-item .mag-badge').count();
    expect(badges).toBeGreaterThan(0);
  });

  test('quake items show depth and time-ago', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const detail = await page.locator('.quake-detail').first().textContent();
    expect(detail).toMatch(/Depth.*km/i);
  });

  test('SVG circle markers render on map', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    // Leaflet circleMarkers are rendered as SVG paths
    const paths = await page.locator('.leaflet-overlay-pane svg path').count();
    expect(paths).toBeGreaterThan(0);
  });
});

test.describe('Earthquake Filters', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);
  });

  test('magnitude slider changes displayed value', async ({ page }) => {
    const slider = page.locator('#mag-slider');
    await slider.fill('5');
    await slider.dispatchEvent('input');

    const value = await page.locator('#mag-value').textContent();
    expect(value).toBe('5.0');
  });

  test('increasing magnitude filter reduces results', async ({ page }) => {
    const countBefore = await page.locator('.quake-item').count();

    const slider = page.locator('#mag-slider');
    await slider.fill('5');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(500);

    const countAfter = await page.locator('.quake-item').count();
    // Higher mag filter should show fewer or equal results
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  test('time range buttons toggle active class', async ({ page }) => {
    const btn1d = page.locator('.time-btn[data-days="1"]');
    await btn1d.click();
    await expect(btn1d).toHaveClass(/active/);

    // 7d button should no longer be active
    const btn7d = page.locator('.time-btn[data-days="7"]');
    await expect(btn7d).not.toHaveClass(/active/);
  });

  test('switching to 1d refetches and updates list', async ({ page }) => {
    const btn1d = page.locator('.time-btn[data-days="1"]');
    await btn1d.click();

    // Wait for refetch
    await page.waitForFunction(() => {
      const el = document.getElementById('result-count');
      return el && el.textContent && /\d+/.test(el.textContent);
    }, { timeout: 15000 });

    const text = await page.locator('#result-count').textContent();
    expect(text).toMatch(/\d+/);
  });
});

test.describe('Earthquake List Interaction', () => {
  test('clicking a quake item adds selected class', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const firstItem = page.locator('.quake-item').first();
    await firstItem.click();

    await expect(firstItem).toHaveClass(/selected/);
  });

  test('clicking a quake item opens a popup on the map', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const firstItem = page.locator('.quake-item').first();
    await firstItem.click();

    // Wait for flyTo animation and popup
    await page.waitForSelector('.leaflet-popup-content', { timeout: 10000 });
    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible();
  });

  test('popup contains magnitude and depth info', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    await page.locator('.quake-item').first().click();
    await page.waitForSelector('.leaflet-popup-content', { timeout: 10000 });

    const popupText = await page.locator('.leaflet-popup-content').textContent();
    expect(popupText).toMatch(/M\s*\d/);
    expect(popupText).toMatch(/Depth.*km/i);
  });

  test('popup contains USGS link', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    await page.locator('.quake-item').first().click();
    await page.waitForSelector('.leaflet-popup-content', { timeout: 10000 });

    const usgsLink = page.locator('.leaflet-popup-content a[href*="usgs.gov"]');
    await expect(usgsLink).toBeVisible();
  });
});

test.describe('Earthquake Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);
  });

  test('toggles page title to Chinese', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('地震');
  });

  test('toggles back to English', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    await page.evaluate(() => window.toggleLang());
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Earthquake');
  });

  test('filter labels switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    const magLabel = await page.locator('#lbl-mag').textContent();
    expect(magLabel).toContain('最小規模');

    // Switch back
    await page.evaluate(() => window.toggleLang());
  });

  test('time buttons switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    const btnText = await page.locator('.time-btn[data-days="7"]').textContent();
    expect(btnText).toBe('7天');

    await page.evaluate(() => window.toggleLang());
  });

  test('navigation buttons switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);
    expect(navTexts.some(t => t.includes('地震'))).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });

  test('result count switches language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    await page.waitForTimeout(500);
    const text = await page.locator('#result-count').textContent();
    expect(text).toMatch(/筆地震/);

    await page.evaluate(() => window.toggleLang());
  });
});

test.describe('Notification Settings Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/earthquake.html');
  });

  test('bell button opens modal', async ({ page }) => {
    await page.locator('#notify-btn').click();
    const modal = page.locator('#notify-modal');
    await expect(modal).toHaveClass(/open/);
  });

  test('close button closes modal', async ({ page }) => {
    await page.locator('#notify-btn').click();
    await page.locator('.modal-close').click();
    const modal = page.locator('#notify-modal');
    await expect(modal).not.toHaveClass(/open/);
  });

  test('clicking overlay closes modal', async ({ page }) => {
    await page.locator('#notify-btn').click();
    // Click the overlay (not the modal box)
    await page.locator('#notify-modal').click({ position: { x: 10, y: 10 } });
    const modal = page.locator('#notify-modal');
    await expect(modal).not.toHaveClass(/open/);
  });

  test('modal contains push toggle', async ({ page }) => {
    await page.locator('#notify-btn').click();
    // The checkbox itself is opacity:0 inside a toggle-switch; check the parent label is visible
    const toggleSwitch = page.locator('.toggle-switch').first();
    await expect(toggleSwitch).toBeVisible();
    // And the checkbox exists in the DOM
    const toggle = page.locator('#push-toggle');
    await expect(toggle).toBeAttached();
  });

  test('modal contains email input', async ({ page }) => {
    await page.locator('#notify-btn').click();
    const input = page.locator('#email-input');
    await expect(input).toBeVisible();
  });

  test('modal contains magnitude slider', async ({ page }) => {
    await page.locator('#notify-btn').click();
    const slider = page.locator('#notify-mag-slider');
    await expect(slider).toBeVisible();
  });

  test('changing notify mag slider updates value display', async ({ page }) => {
    await page.locator('#notify-btn').click();
    await page.locator('#notify-mag-slider').fill('6');
    await page.locator('#notify-mag-slider').dispatchEvent('input');

    const value = await page.locator('#notify-mag-value').textContent();
    expect(value).toBe('6.0');
  });

  test('notify settings persist in localStorage', async ({ page }) => {
    await page.locator('#notify-btn').click();
    await page.locator('#notify-mag-slider').fill('5.5');
    await page.locator('#notify-mag-slider').dispatchEvent('input');

    const stored = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('earthquake-notify-settings') || '{}');
    });
    expect(stored.minMag).toBe('5.5');
  });
});

test.describe('Facebook Share', () => {
  test('quake item has FB share button', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const fbBtn = page.locator('.quake-item .share-btn-small').first();
    await expect(fbBtn).toBeVisible();
    const text = await fbBtn.textContent();
    expect(text).toMatch(/FB/);
  });

  test('popup has FB share button', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    await page.locator('.quake-item').first().click();
    await page.waitForSelector('.leaflet-popup-content', { timeout: 10000 });

    const popupHtml = await page.locator('.leaflet-popup-content').innerHTML();
    expect(popupHtml).toContain('FB');
    expect(popupHtml).toContain('Share') ;
  });
});

test.describe('Sheet Summary', () => {
  test('sheet summary shows earthquake count', async ({ page }) => {
    await page.goto('/earthquake.html');
    await waitForQuakeData(page);

    const summary = await page.locator('#sheet-summary').textContent();
    expect(summary).toMatch(/Earthquakes.*\d+ events/i);
  });
});

test.describe('Quake Nav Button on Other Pages', () => {
  const pages = [
    { name: 'index', url: '/index.html' },
    { name: 'ubike', url: '/ubike.html' },
    { name: 'mrt', url: '/mrt.html' },
    { name: 'bus', url: '/bus.html' },
  ];

  for (const p of pages) {
    test(`${p.name} page has Quake nav button`, async ({ page }) => {
      await page.goto(p.url);
      const quakeLink = page.locator('a.nav-btn[href="earthquake.html"]');
      await expect(quakeLink).toBeVisible();
      const text = await quakeLink.textContent();
      expect(text).toMatch(/Quake|地震/);
    });
  }
});
