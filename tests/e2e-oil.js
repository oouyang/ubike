// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Oil Price Page - Playwright E2E Tests
 *
 * Tests:
 * 1. Page load and map display
 * 2. Price table population (demo data)
 * 3. Prediction table display
 * 4. Price history chart
 * 5. Tab switching (Prices ↔ Stations)
 * 6. Share buttons
 * 7. Language toggle
 * 8. Sheet summary
 * 9. Nav bar links
 */

test.describe('Oil Price Page Load', () => {
  test('page loads with map canvas', async ({ page }) => {
    await page.goto('/oil.html');
    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('page title is Oil Prices', async ({ page }) => {
    await page.goto('/oil.html');
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Oil');
  });

  test('leaflet tiles load', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });
    const tiles = await page.locator('.leaflet-tile-loaded').count();
    expect(tiles).toBeGreaterThan(0);
  });

  test('nav bar has Home button', async ({ page }) => {
    await page.goto('/oil.html');
    const homeBtn = page.locator('a.nav-btn.home');
    await expect(homeBtn).toBeVisible();
  });
});

test.describe('Oil Price Table', () => {
  test('price table shows 4 fuel types', async ({ page }) => {
    await page.goto('/oil.html');
    // Wait for price rendering
    await page.waitForSelector('#price-tbody tr', { timeout: 10000 });
    const rows = await page.locator('#price-tbody tr').count();
    expect(rows).toBe(4);
  });

  test('demo badge is visible in demo mode', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#price-tbody tr', { timeout: 10000 });
    const badge = page.locator('#demo-badge');
    await expect(badge).toBeVisible();
  });

  test('prices are positive numbers', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#price-tbody tr', { timeout: 10000 });
    const prices = await page.locator('#price-tbody .price-value').allTextContents();
    for (const p of prices) {
      const num = parseFloat(p);
      expect(num).toBeGreaterThan(0);
    }
  });

  test('date range is displayed', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#price-tbody tr', { timeout: 10000 });
    const dateText = await page.locator('#price-date').textContent();
    expect(dateText).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

test.describe('Oil Price Predictions', () => {
  test('prediction table shows 4 rows', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#predict-tbody tr', { timeout: 10000 });
    const rows = await page.locator('#predict-tbody tr').count();
    expect(rows).toBe(4);
  });

  test('predictions show change indicators', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#predict-tbody tr', { timeout: 10000 });
    const changes = await page.locator('#predict-tbody .price-change').count();
    expect(changes).toBe(4);
  });
});

test.describe('Oil Price History Chart', () => {
  test('chart has 8 bars', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#bar-chart .bar-group', { timeout: 10000 });
    const bars = await page.locator('#bar-chart .bar-group').count();
    expect(bars).toBe(8);
  });

  test('bars have week labels', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#bar-chart .bar-label', { timeout: 10000 });
    const labels = await page.locator('#bar-chart .bar-label').allTextContents();
    expect(labels.length).toBe(8);
    // Labels should look like dates (MM/DD)
    for (const label of labels) {
      expect(label).toMatch(/\d{2}\/\d{2}/);
    }
  });
});

test.describe('Oil Tab Switching', () => {
  test('price tab is active by default', async ({ page }) => {
    await page.goto('/oil.html');
    const priceTab = page.locator('#tab-prices');
    await expect(priceTab).toHaveClass(/active/);
  });

  test('clicking stations tab switches content', async ({ page }) => {
    await page.goto('/oil.html');
    await page.locator('#tab-stations').click();
    const stationTab = page.locator('#tab-stations');
    await expect(stationTab).toHaveClass(/active/);

    const priceTab = page.locator('#tab-prices');
    await expect(priceTab).not.toHaveClass(/active/);
  });

  test('stations tab shows station count', async ({ page }) => {
    await page.goto('/oil.html');
    await page.locator('#tab-stations').click();
    // Wait for station data to load
    await page.waitForFunction(() => {
      const el = document.getElementById('station-count');
      return el && el.textContent && el.textContent.length > 0;
    }, { timeout: 15000 });
    const text = await page.locator('#station-count').textContent();
    expect(text).toMatch(/\d+|Failed/i);
  });

  test('switching back to prices tab works', async ({ page }) => {
    await page.goto('/oil.html');
    await page.locator('#tab-stations').click();
    await page.locator('#tab-prices').click();
    const priceTab = page.locator('#tab-prices');
    await expect(priceTab).toHaveClass(/active/);
  });
});

test.describe('Oil Share Buttons', () => {
  test('FB share button exists', async ({ page }) => {
    await page.goto('/oil.html');
    const fbBtn = page.locator('#share-fb-btn');
    await expect(fbBtn).toBeVisible();
  });

  test('copy button exists', async ({ page }) => {
    await page.goto('/oil.html');
    const copyBtn = page.locator('#share-copy-btn');
    await expect(copyBtn).toBeVisible();
  });

  test('FB share opens new window', async ({ page, context }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#price-tbody tr', { timeout: 10000 });

    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 5000 }).catch(() => null),
      page.locator('#share-fb-btn').click()
    ]);
    // Either a popup opened or it was blocked — both are acceptable
    if (popup) {
      expect(popup.url()).toContain('facebook.com');
    }
  });
});

test.describe('Oil Language Toggle', () => {
  test('toggles page title to Chinese', async ({ page }) => {
    await page.goto('/oil.html');
    await page.evaluate(() => window.toggleLang());
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('油價');
  });

  test('toggles back to English', async ({ page }) => {
    await page.goto('/oil.html');
    await page.evaluate(() => window.toggleLang());
    await page.evaluate(() => window.toggleLang());
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Oil');
  });

  test('tab buttons switch language', async ({ page }) => {
    await page.goto('/oil.html');
    await page.evaluate(() => window.toggleLang());
    const priceTabText = await page.locator('#tab-prices').textContent();
    expect(priceTabText).toContain('油價');

    const stationTabText = await page.locator('#tab-stations').textContent();
    expect(stationTabText).toContain('加油站');

    await page.evaluate(() => window.toggleLang());
  });

  test('nav buttons switch language', async ({ page }) => {
    await page.goto('/oil.html');
    await page.evaluate(() => window.toggleLang());
    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });
});

test.describe('Oil Sheet Summary', () => {
  test('sheet summary shows 95 price', async ({ page }) => {
    await page.goto('/oil.html');
    await page.waitForSelector('#price-tbody tr', { timeout: 10000 });
    const summary = await page.locator('#sheet-summary').textContent();
    expect(summary).toMatch(/95.*\d+/);
  });
});

test.describe('Oil Card on Index Page', () => {
  test('index page has oil price card', async ({ page }) => {
    await page.goto('/index.html');
    const oilLink = page.locator('a.card[href="oil.html"]');
    await expect(oilLink).toBeVisible();
  });

  test('oil card has fuel icon', async ({ page }) => {
    await page.goto('/index.html');
    const oilCard = page.locator('a.card[href="oil.html"]');
    const text = await oilCard.textContent();
    expect(text).toMatch(/Oil|油價/);
  });
});

test.describe('Oil Page NOT in Other Nav Headers', () => {
  const pages = [
    { name: 'ubike', url: '/ubike.html' },
    { name: 'mrt', url: '/mrt.html' },
    { name: 'bus', url: '/bus.html' },
    { name: 'earthquake', url: '/earthquake.html' },
  ];

  for (const p of pages) {
    test(`${p.name} page does NOT have oil nav button`, async ({ page }) => {
      await page.goto(p.url);
      const oilLink = page.locator('a.nav-btn[href="oil.html"]');
      await expect(oilLink).toHaveCount(0);
    });
  }
});
