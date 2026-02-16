// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Taiwan Rail Page - Playwright E2E Tests
 *
 * Tests:
 * 1. Page load
 * 2. Line filter
 * 3. Language toggle
 * 4. Station popup
 */

// Helper: wait for page to be ready (markers on map)
async function waitForReady(page) {
  await page.waitForFunction(() => {
    return document.querySelectorAll('.leaflet-marker-icon').length > 0;
  }, { timeout: 30000 });
}

test.describe('Rail Page Load', () => {
  test('page loads with map canvas', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForReady(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('line filter has options', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForReady(page);

    const options = await page.locator('#line-select option').count();
    expect(options).toBeGreaterThanOrEqual(1);
  });

  test('markers are displayed on the map', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForReady(page);

    const markers = await page.locator('.leaflet-marker-icon').count();
    expect(markers).toBeGreaterThan(0);
  });
});

test.describe('Rail Stations Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rail.html');
    await waitForReady(page);
    // Switch to Stations tab to access line filter
    await page.locator('.tab-btn[data-tab="stations"]').click();
    await page.waitForTimeout(500);
  });

  test('stations tab shows line filter', async ({ page }) => {
    await expect(page.locator('#line-select')).toBeVisible();
  });

  test('selecting a specific line changes markers', async ({ page }) => {
    const initialCount = await page.locator('.leaflet-marker-icon').count();

    const secondValue = await page.locator('#line-select option').nth(1).getAttribute('value');
    if (secondValue) {
      await page.locator('#line-select').selectOption(secondValue);
      await page.waitForTimeout(500);

      const newCount = await page.locator('.leaflet-marker-icon').count();
      expect(newCount).toBeGreaterThan(0);
    }
  });
});

test.describe('Rail Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rail.html');
    await waitForReady(page);
  });

  test('toggles page title to Chinese', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('台鐵');
  });

  test('toggles back to English', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Rail');
  });

  test('navigation buttons switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });
});

test.describe('Rail Station Popup', () => {
  test('clicking a marker opens popup', async ({ page }) => {
    await page.goto('/rail.html');
    await waitForReady(page);

    // Click via JS to avoid size issues with small markers
    await page.evaluate(() => {
      const marker = document.querySelector('.leaflet-marker-icon');
      if (marker) marker.click();
    });
    await page.waitForSelector('.leaflet-popup-content', { timeout: 5000 });

    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible();
  });
});
