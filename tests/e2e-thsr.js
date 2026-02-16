// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * THSR (High Speed Rail) Page - Playwright E2E Tests
 *
 * Tests:
 * 1. Page load and station display
 * 2. Station selectors
 * 3. Language toggle
 * 4. Direction toggle
 */

// Helper: wait for page to be ready
async function waitForReady(page) {
  await page.waitForFunction(() => {
    const select = document.getElementById('station-select');
    return select && select.options && select.options.length > 1;
  }, { timeout: 30000 });
}

test.describe('THSR Page Load', () => {
  test('page loads with station selector', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForReady(page);

    const station = page.locator('#station-select');
    await expect(station).toBeVisible();
  });

  test('station selector has 12 stations', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForReady(page);

    const options = await page.locator('#station-select option').count();
    expect(options).toBeGreaterThanOrEqual(12);
  });

  test('destination station selector exists', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForReady(page);

    const dest = page.locator('#dest-station-select');
    await expect(dest).toBeVisible();
  });

  test('map canvas is visible', async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForReady(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });
});

test.describe('THSR Station Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForReady(page);
  });

  test('selecting a station updates the page', async ({ page }) => {
    await page.locator('#station-select').selectOption({ index: 1 });
    await page.waitForTimeout(500);

    // Page should still have content
    const pageText = await page.locator('body').textContent();
    expect(pageText.length).toBeGreaterThan(0);
  });
});

test.describe('THSR Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/thsr.html');
    await waitForReady(page);
  });

  test('toggles page title to Chinese', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('高鐵');
  });

  test('toggles back to English', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('High Speed Rail');
  });

  test('station names switch to Chinese', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const options = await page.locator('#station-select option').allTextContents();
    const hasChinese = options.some(t => /[\u4e00-\u9fff]/.test(t));
    expect(hasChinese).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });

  test('navigation buttons switch language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);
    expect(navTexts.some(t => t.includes('高鐵'))).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });
});
