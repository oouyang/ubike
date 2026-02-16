// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * MRT Page - Playwright E2E Tests
 *
 * Tests:
 * 1. Page load and station display
 * 2. System filter
 * 3. Language toggle
 * 4. Station popup
 */

// Helper: wait for markers to render on map
async function waitForMarkers(page) {
  await page.waitForFunction(() => {
    return document.querySelectorAll('.leaflet-marker-icon').length > 0;
  }, { timeout: 30000 });
}

test.describe('MRT Page Load', () => {
  test('page loads with map canvas', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('system selector has options', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    const options = await page.locator('#system-select option').count();
    expect(options).toBeGreaterThanOrEqual(4);
  });

  test('line selector has options', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    const options = await page.locator('#line-select option').count();
    expect(options).toBeGreaterThanOrEqual(1);
  });

  test('markers are displayed on the map', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

    const markers = await page.locator('.leaflet-marker-icon').count();
    expect(markers).toBeGreaterThan(0);
  });
});

test.describe('MRT System Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);
  });

  test('selecting TRTC shows stations', async ({ page }) => {
    await page.locator('#system-select').selectOption('TRTC');
    await page.waitForTimeout(500);

    const markers = await page.locator('.leaflet-marker-icon').count();
    expect(markers).toBeGreaterThan(0);
  });

  test('selecting KRTC shows stations', async ({ page }) => {
    await page.locator('#system-select').selectOption('KRTC');
    await page.waitForTimeout(500);

    const markers = await page.locator('.leaflet-marker-icon').count();
    expect(markers).toBeGreaterThan(0);
  });

  test('switching system changes marker count', async ({ page }) => {
    await page.locator('#system-select').selectOption('TRTC');
    await page.waitForTimeout(500);
    const trtcCount = await page.locator('.leaflet-marker-icon').count();

    await page.locator('#system-select').selectOption('KRTC');
    await page.waitForTimeout(500);
    const krtcCount = await page.locator('.leaflet-marker-icon').count();

    expect(trtcCount).not.toBe(krtcCount);
  });
});

test.describe('MRT Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);
  });

  test('toggles page title to Chinese', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('捷運');
  });

  test('toggles back to English', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('MRT');
  });

  test('navigation buttons switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);
    expect(navTexts.some(t => t.includes('捷運'))).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });
});

test.describe('MRT Station Popup', () => {
  test('clicking a marker opens popup', async ({ page }) => {
    await page.goto('/mrt.html');
    await waitForMarkers(page);

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
