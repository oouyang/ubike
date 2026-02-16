// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * YouBike 2.0E (E-bike) Enhancement - Playwright E2E Tests
 *
 * Tests the 4 new features:
 * 1. E-bike filter toggle
 * 2. Range reference in fare card
 * 3. Nearby e-bike stations in popup
 * 4. E-bike count in bottom sheet summary
 */

// Helper: wait for stations to load
async function waitForStations(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('result-count');
    return el && /Showing \d+ stations/.test(el.textContent);
  }, { timeout: 30000 });
}

// Helper: switch city via JS (select change)
async function switchCity(page, city) {
  await page.evaluate((c) => {
    const sel = document.getElementById('city-select');
    sel.value = c;
    sel.dispatchEvent(new Event('change'));
  }, city);
  await waitForStations(page);
}

test.describe('E-bike Filter Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('filter checkbox visible for Taipei (e-bike city)', async ({ page }) => {
    const filter = page.locator('#ebike-filter');
    await expect(filter).toBeVisible();
    const checkbox = page.locator('#ebike-toggle');
    await expect(checkbox).not.toBeChecked();
  });

  test('checking filter reduces station count', async ({ page }) => {
    const countBefore = await page.locator('#result-count').textContent();
    const totalBefore = parseInt(countBefore.match(/\d+/)[0]);

    await page.locator('#ebike-toggle').check();

    const countAfter = await page.locator('#result-count').textContent();
    const totalAfter = parseInt(countAfter.match(/\d+/)[0]);

    expect(totalAfter).toBeLessThan(totalBefore);
    expect(totalAfter).toBeGreaterThan(0);
  });

  test('unchecking filter restores all stations', async ({ page }) => {
    const countBefore = await page.locator('#result-count').textContent();

    await page.locator('#ebike-toggle').check();
    await page.locator('#ebike-toggle').uncheck();

    const countAfter = await page.locator('#result-count').textContent();
    expect(countAfter).toBe(countBefore);
  });

  test('filter hidden for non-ebike city (Taichung)', async ({ page }) => {
    await switchCity(page, 'taichung');
    const filter = page.locator('#ebike-filter');
    await expect(filter).toBeHidden();
  });

  test('filter resets when switching to non-ebike city', async ({ page }) => {
    // Check the filter
    await page.locator('#ebike-toggle').check();
    await expect(page.locator('#ebike-toggle')).toBeChecked();

    // Switch to Taichung (no ebike)
    await switchCity(page, 'taichung');

    // Checkbox should be unchecked
    await expect(page.locator('#ebike-toggle')).not.toBeChecked();

    // Switch back to Taipei
    await switchCity(page, 'taipei');
    await expect(page.locator('#ebike-toggle')).not.toBeChecked();
  });

  test('filter visible again when switching back to ebike city', async ({ page }) => {
    await switchCity(page, 'taichung');
    await expect(page.locator('#ebike-filter')).toBeHidden();

    await switchCity(page, 'newtaipei');
    await expect(page.locator('#ebike-filter')).toBeVisible();
  });
});

test.describe('Range Reference in Fare Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('range table shown for ebike city (Taipei)', async ({ page }) => {
    // Open fare card
    await page.locator('.fare-header').click();
    await expect(page.locator('#fare-body')).toBeVisible();

    const fareHtml = await page.locator('#fare-body').innerHTML();
    expect(fareHtml).toContain('Range Reference');
    expect(fareHtml).toContain('Flat terrain');
    expect(fareHtml).toContain('~50 km');
    expect(fareHtml).toContain('Hilly terrain');
    expect(fareHtml).toContain('~30 km');
    expect(fareHtml).toContain('Cold weather');
    expect(fareHtml).toContain('~35 km');
    expect(fareHtml).toContain('Official max');
    expect(fareHtml).toContain('80 km');
  });

  test('range table NOT shown for non-ebike city (Taichung)', async ({ page }) => {
    await switchCity(page, 'taichung');
    await page.locator('.fare-header').click();

    const fareHtml = await page.locator('#fare-body').innerHTML();
    expect(fareHtml).not.toContain('Range Reference');
  });

  test('range table shows Chinese text after language toggle', async ({ page }) => {
    await page.locator('.fare-header').click();
    // Toggle to Chinese
    await page.evaluate(() => window.toggleLang());

    const fareHtml = await page.locator('#fare-body').innerHTML();
    expect(fareHtml).toContain('續航參考');
    expect(fareHtml).toContain('平坦路面');
    expect(fareHtml).toContain('山坡地形');
    expect(fareHtml).toContain('公里');
  });

  test('2.0E rate table precedes range table', async ({ page }) => {
    await page.locator('.fare-header').click();
    const fareHtml = await page.locator('#fare-body').innerHTML();

    const ebikeRateIdx = fareHtml.indexOf('YouBike 2.0E');
    const rangeIdx = fareHtml.indexOf('Range Reference');
    expect(ebikeRateIdx).toBeGreaterThan(-1);
    expect(rangeIdx).toBeGreaterThan(ebikeRateIdx);
  });
});

test.describe('Nearby E-bike Stations in Popup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('popup shows nearby e-bike count for Taipei station', async ({ page }) => {
    // Click first station to open popup
    await page.locator('.station-item').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const popupHtml = await page.locator('.leaflet-popup-content').innerHTML();
    expect(popupHtml).toContain('e-bike stations within 500m');
  });

  test('popup shows Chinese nearby text after language toggle', async ({ page }) => {
    await page.evaluate(() => window.toggleLang()); // to Chinese

    await page.locator('.station-item').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const popupHtml = await page.locator('.leaflet-popup-content').innerHTML();
    expect(popupHtml).toContain('500m內有電輔車的站點');

    // Toggle back
    await page.evaluate(() => window.toggleLang());
  });

  test('popup does NOT show nearby info for non-ebike city', async ({ page }) => {
    await switchCity(page, 'taichung');

    await page.locator('.station-item').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const popupHtml = await page.locator('.leaflet-popup-content').innerHTML();
    expect(popupHtml).not.toContain('e-bike stations within 500m');
    expect(popupHtml).not.toContain('500m內有電輔車的站點');
  });
});

test.describe('E-bike Count in Bottom Sheet Summary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('summary includes e-bike count for Taipei', async ({ page }) => {
    const summaryText = await page.locator('#sheet-summary').textContent();
    expect(summaryText).toMatch(/⚡\d+ e-bikes/);
  });

  test('summary shows Chinese e-bike text after toggle', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());
    const summaryText = await page.locator('#sheet-summary').textContent();
    expect(summaryText).toMatch(/⚡\d+ 電輔車/);
    await page.evaluate(() => window.toggleLang()); // back to EN
  });

  test('summary does NOT include e-bike count for non-ebike city', async ({ page }) => {
    await switchCity(page, 'taichung');
    const summaryText = await page.locator('#sheet-summary').textContent();
    expect(summaryText).not.toContain('e-bikes');
    expect(summaryText).not.toContain('電輔車');
  });

  test('summary does NOT include e-bike count for "all" cities', async ({ page }) => {
    await switchCity(page, 'all');
    // Wait for "All" to appear in the summary (confirming city switch completed)
    await page.waitForFunction(() => {
      const el = document.getElementById('sheet-summary');
      return el && el.textContent.includes('All');
    }, { timeout: 30000 });
    const summaryText = await page.locator('#sheet-summary').textContent();
    expect(summaryText).not.toContain('e-bikes');
    expect(summaryText).not.toContain('電輔車');
  });
});

test.describe('E-bike Filter Label Language', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('filter label switches between EN and ZH', async ({ page }) => {
    const labelEN = await page.locator('#ebike-filter-text').textContent();
    expect(labelEN).toContain('E-bikes only');

    await page.evaluate(() => window.toggleLang());
    const labelZH = await page.locator('#ebike-filter-text').textContent();
    expect(labelZH).toContain('僅顯示電輔車');

    await page.evaluate(() => window.toggleLang());
    const labelEN2 = await page.locator('#ebike-filter-text').textContent();
    expect(labelEN2).toContain('E-bikes only');
  });
});
