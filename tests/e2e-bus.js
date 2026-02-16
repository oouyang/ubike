// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Bus Page - Playwright E2E Tests
 *
 * Tests:
 * 1. Page load and tabs
 * 2. Tab navigation
 * 3. Language toggle
 * 4. City selector
 */

// Helper: wait for page to be ready (map tiles loaded)
async function waitForReady(page) {
  await page.waitForFunction(() => {
    const canvas = document.getElementById('map-canvas');
    return canvas && canvas.querySelector('.leaflet-tile-pane') !== null;
  }, { timeout: 30000 });
}

test.describe('Bus Page Load', () => {
  test('page loads with map canvas', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('has tab buttons', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);

    const tabs = page.locator('.tab-btn');
    const count = await tabs.count();
    expect(count).toBe(2);
  });

  test('route city selector is present', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);

    const citySelect = page.locator('#route-city-select');
    await expect(citySelect).toBeVisible();
  });

  test('route selector is present', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);

    const routeSelect = page.locator('#route-select');
    await expect(routeSelect).toBeVisible();
  });
});

test.describe('Bus Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);
  });

  test('schedule tab is active by default', async ({ page }) => {
    const scheduleTab = page.locator('.tab-btn[data-tab="schedule"]');
    await expect(scheduleTab).toHaveClass(/active/);
  });

  test('clicking nearby tab activates it', async ({ page }) => {
    const nearbyTab = page.locator('.tab-btn[data-tab="nearby"]');
    await nearbyTab.click();
    await expect(nearbyTab).toHaveClass(/active/);
  });

  test('clicking schedule tab re-activates it', async ({ page }) => {
    // Switch to nearby first
    await page.locator('.tab-btn[data-tab="nearby"]').click();

    // Switch back
    const scheduleTab = page.locator('.tab-btn[data-tab="schedule"]');
    await scheduleTab.click();
    await expect(scheduleTab).toHaveClass(/active/);
  });
});

test.describe('Bus Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);
  });

  test('toggles page title to Chinese', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('公車');
  });

  test('toggles back to English', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Bus');
  });

  test('tab labels switch language', async ({ page }) => {
    const scheduleTab = page.locator('.tab-btn[data-tab="schedule"]');
    const enText = await scheduleTab.textContent();

    await page.evaluate(() => window.toggleLang());
    const zhText = await scheduleTab.textContent();

    expect(enText).toContain('Route Schedule');
    expect(zhText).toContain('路線時刻');

    await page.evaluate(() => window.toggleLang());
  });

  test('navigation buttons switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);
    expect(navTexts.some(t => t.includes('公車'))).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });
});

test.describe('Bus City Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);
  });

  test('route city selector has 22+ cities', async ({ page }) => {
    const options = await page.locator('#route-city-select option').count();
    expect(options).toBeGreaterThanOrEqual(22);
  });

  test('city names switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const options = await page.locator('#route-city-select option').allTextContents();
    const hasChinese = options.some(t => /[\u4e00-\u9fff]/.test(t));
    expect(hasChinese).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });
});

test.describe('Bus Route Search', () => {
  test('search input exists', async ({ page }) => {
    await page.goto('/bus.html');
    await waitForReady(page);

    const searchInput = page.locator('#route-search-input');
    await expect(searchInput).toBeVisible();
  });
});
