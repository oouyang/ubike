// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * YouBike Page - Playwright E2E Tests
 *
 * Tests core functionality:
 * 1. Page load and station display
 * 2. City switching
 * 3. Search and autocomplete
 * 4. Station popup and navigation
 * 5. Language toggle
 * 6. Fare card
 * 7. Fault report modal
 */

// Helper: wait for stations to load
async function waitForStations(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('result-count');
    return el && /Showing \d+ stations/.test(el.textContent);
  }, { timeout: 30000 });
}

// Helper: switch city
async function switchCity(page, city) {
  await page.evaluate((c) => {
    const sel = document.getElementById('city-select');
    sel.value = c;
    sel.dispatchEvent(new Event('change'));
  }, city);
  await waitForStations(page);
}

// ========== Page Load ==========

test.describe('Page Load', () => {
  test('loads with default city (Taipei) and displays stations', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const count = await page.locator('#result-count').textContent();
    const num = parseInt(count.match(/\d+/)[0]);
    expect(num).toBeGreaterThan(0);
  });

  test('map canvas is visible', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const map = page.locator('#map-canvas');
    await expect(map).toBeVisible();
  });

  test('station list has items', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const items = page.locator('.station-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('legend is visible with all marker types', async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);

    const legend = page.locator('#map-legend');
    await expect(legend).toBeVisible();
    const html = await legend.innerHTML();
    expect(html).toContain('Available');
    expect(html).toContain('No bikes');
    expect(html).toContain('Full');
    expect(html).toContain('Suspended');
  });
});

// ========== City Switching ==========

test.describe('City Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('switching to Kaohsiung loads different stations', async ({ page }) => {
    await switchCity(page, 'kaohsiung');

    const count = parseInt((await page.locator('#result-count').textContent()).match(/\d+/)[0]);
    expect(count).toBeGreaterThan(0);

    const summary = await page.locator('#sheet-summary').textContent();
    expect(summary).toContain('Kaohsiung');
  });

  test('switching to smaller city loads fewer stations', async ({ page }) => {
    const taipeiCount = parseInt((await page.locator('#result-count').textContent()).match(/\d+/)[0]);

    await switchCity(page, 'miaoli');
    // Wait for the count to actually change
    await page.waitForFunction((prevCount) => {
      const el = document.getElementById('result-count');
      if (!el) return false;
      const match = el.textContent.match(/\d+/);
      return match && parseInt(match[0]) !== prevCount;
    }, taipeiCount, { timeout: 30000 });

    const miaoliCount = parseInt((await page.locator('#result-count').textContent()).match(/\d+/)[0]);
    expect(miaoliCount).toBeLessThan(taipeiCount);
    expect(miaoliCount).toBeGreaterThan(0);
  });

  test('district filter hidden for "all" city', async ({ page }) => {
    await switchCity(page, 'all');
    // Wait for the "all" city to fully load and hide district filter
    await page.waitForFunction(() => {
      const el = document.getElementById('district-filter');
      return el && el.style.display === 'none';
    }, { timeout: 30000 });
    const display = await page.locator('#district-filter').evaluate(el => el.style.display);
    expect(display).toBe('none');
  });

  test('city selection persists in summary', async ({ page }) => {
    await switchCity(page, 'kaohsiung');

    const summary = await page.locator('#sheet-summary').textContent();
    expect(summary).toContain('Kaohsiung');
  });
});

// ========== Search ==========

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('typing in search filters station list', async ({ page }) => {
    const beforeCount = parseInt((await page.locator('#result-count').textContent()).match(/\d+/)[0]);

    await page.locator('#search-input').fill('捷運');
    // Wait for filter to take effect
    await page.waitForTimeout(300);

    const afterCount = parseInt((await page.locator('#result-count').textContent()).match(/\d+/)[0]);
    expect(afterCount).toBeLessThan(beforeCount);
    expect(afterCount).toBeGreaterThan(0);
  });

  test('search dropdown appears for 2+ chars', async ({ page }) => {
    const dropdown = page.locator('#search-dropdown');
    await expect(dropdown).toBeHidden();

    await page.locator('#search-input').fill('台北');
    await page.waitForTimeout(300);

    await expect(dropdown).toBeVisible();
  });

  test('clearing search restores all stations', async ({ page }) => {
    const beforeCount = await page.locator('#result-count').textContent();

    await page.locator('#search-input').fill('捷運');
    await page.waitForTimeout(200);
    await page.locator('#search-input').fill('');
    await page.waitForTimeout(200);

    const afterCount = await page.locator('#result-count').textContent();
    expect(afterCount).toBe(beforeCount);
  });
});

// ========== Station Popup ==========

test.describe('Station Popup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('clicking station item opens popup on map', async ({ page }) => {
    await page.locator('.station-item').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible();
  });

  test('popup contains station name and bike/slot counts', async ({ page }) => {
    await page.locator('.station-item').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const html = await page.locator('.leaflet-popup-content').innerHTML();
    expect(html).toContain('Bikes');
    expect(html).toContain('Slots');
  });

  test('popup contains navigation links', async ({ page }) => {
    await page.locator('.station-item').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const html = await page.locator('.leaflet-popup-content').innerHTML();
    expect(html).toContain('Google Maps');
    expect(html).toContain('Apple Maps');
  });

  test('popup contains report button for active stations', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    const html = await page.locator('.leaflet-popup-content').innerHTML();
    expect(html).toContain('Report');
  });
});

// ========== Language Toggle ==========

test.describe('Language Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('toggles to Chinese', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const title = await page.locator('#page-title').textContent();
    expect(title).toBe('微笑單車');
  });

  test('toggles back to English', async ({ page }) => {
    await page.evaluate(() => window.toggleLang()); // to ZH
    await page.evaluate(() => window.toggleLang()); // back to EN

    const title = await page.locator('#page-title').textContent();
    expect(title).toBe('YouBike');
  });

  test('legend text switches language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const legend = await page.locator('#map-legend').innerHTML();
    expect(legend).toContain('可借可還');
    expect(legend).toContain('無車可借');
  });

  test('search placeholder switches language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const placeholder = await page.locator('#search-input').getAttribute('placeholder');
    expect(placeholder).toContain('搜尋');
  });

  test('city selector switches language', async ({ page }) => {
    await page.evaluate(() => window.toggleLang());

    const options = await page.locator('#city-select option').allTextContents();
    // CITIES uses 台 not 臺
    expect(options).toContain('台北市');
    expect(options).toContain('高雄市');
  });
});

// ========== Fare Card ==========

test.describe('Fare Card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('fare card expands on click', async ({ page }) => {
    const body = page.locator('#fare-body');
    await expect(body).toBeHidden();

    await page.locator('.fare-header').click();
    await expect(body).toBeVisible();
  });

  test('Taipei shows free 30 min badge', async ({ page }) => {
    await page.locator('.fare-header').click();
    const html = await page.locator('#fare-body').innerHTML();
    expect(html).toContain('Free first 30 min');
  });

  test('fare card collapses on second click', async ({ page }) => {
    await page.locator('.fare-header').click();
    await expect(page.locator('#fare-body')).toBeVisible();

    await page.locator('.fare-header').click();
    await expect(page.locator('#fare-body')).toBeHidden();
  });

  test('"all" city shows select city message', async ({ page }) => {
    await switchCity(page, 'all');
    await page.locator('.fare-header').click();
    const html = await page.locator('#fare-body').innerHTML();
    expect(html).toContain('Select a city');
  });
});

// ========== Fault Report Modal ==========

test.describe('Fault Report Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('report button opens modal from popup', async ({ page }) => {
    // Click a non-suspended station
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');

    // Click report button inside popup
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    // Modal should be visible
    const overlay = page.locator('#report-overlay');
    await expect(overlay).toHaveClass(/open/);
  });

  test('modal shows station info', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    const info = await page.locator('#report-station-info').innerHTML();
    expect(info).toContain('Bikes');
    expect(info).toContain('Slots');
  });

  test('issue type chips are clickable and selectable', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    // Click first issue chip
    const chip = page.locator('.report-issue-chip').first();
    await chip.click();
    await expect(chip).toHaveClass(/selected/);
  });

  test('selecting another chip deselects the first', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    const chip1 = page.locator('.report-issue-chip').nth(0);
    const chip2 = page.locator('.report-issue-chip').nth(1);

    await chip1.click();
    await expect(chip1).toHaveClass(/selected/);

    await chip2.click();
    await expect(chip2).toHaveClass(/selected/);
    await expect(chip1).not.toHaveClass(/selected/);
  });

  test('close button closes modal', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    await expect(page.locator('#report-overlay')).toHaveClass(/open/);

    await page.locator('.report-close-btn').click();
    await expect(page.locator('#report-overlay')).not.toHaveClass(/open/);
  });

  test('ESC key closes modal', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    await expect(page.locator('#report-overlay')).toHaveClass(/open/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#report-overlay')).not.toHaveClass(/open/);
  });

  test('validation shows errors when required fields missing', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    // Try to submit without selecting issue or entering email
    await page.locator('.report-action-btn').first().click();

    // Error messages should appear
    await expect(page.locator('#report-issue-error')).toBeVisible();
    await expect(page.locator('#report-email-error')).toBeVisible();
  });

  test('language toggle updates modal labels', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    const titleEN = await page.locator('#report-title').textContent();
    expect(titleEN).toBe('Report Issue');

    await page.evaluate(() => window.toggleLang());

    const titleZH = await page.locator('#report-title').textContent();
    expect(titleZH).toBe('問題回報');

    // Toggle back
    await page.evaluate(() => window.toggleLang());
  });

  test('email persists in localStorage', async ({ page }) => {
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    // Fill email
    await page.locator('#report-email').fill('test@example.com');
    // Select an issue and submit to trigger save
    await page.locator('.report-issue-chip').first().click();

    // Use phone report to trigger saveContactInfo without needing clipboard
    await page.locator('.report-action-btn').nth(1).click();

    // Re-open modal
    await page.locator('.station-item:not(.station-suspended)').first().click();
    await page.waitForSelector('.leaflet-popup-content');
    await page.locator('.leaflet-popup-content button').filter({ hasText: 'Report' }).click();

    const savedEmail = await page.locator('#report-email').inputValue();
    expect(savedEmail).toBe('test@example.com');
  });
});

// ========== District Filter ==========

test.describe('District Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ubike.html');
    await waitForStations(page);
  });

  test('district chips are displayed for a single city', async ({ page }) => {
    const chips = page.locator('.district-chip');
    const count = await chips.count();
    expect(count).toBeGreaterThan(1); // "All" + at least one district
  });

  test('"All" chip is active by default', async ({ page }) => {
    const allChip = page.locator('.district-chip').first();
    await expect(allChip).toHaveClass(/active/);
  });
});
