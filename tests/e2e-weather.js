// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Weather Page - Playwright E2E Tests
 *
 * Tests:
 * 1. Page load and current weather display
 * 2. Taiwan city selector
 * 3. World cities section
 * 4. Search functionality
 * 5. 7-day forecast
 * 6. Language toggle
 * 7. Navigation
 */

// Helper: wait for weather data to render
async function waitForWeatherData(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('current-weather');
    return el && el.style.display !== 'none';
  }, { timeout: 30000 });
}

test.describe('Weather Page Load', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/weather.html');
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Weather');
  });

  test('loading message appears initially', async ({ page }) => {
    await page.goto('/weather.html');
    const loading = page.locator('#loading-msg');
    await expect(loading).toBeAttached();
  });

  test('current weather card appears after loading', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);
    const card = page.locator('#current-weather');
    await expect(card).toBeVisible();
  });

  test('nav bar has Home button', async ({ page }) => {
    await page.goto('/weather.html');
    const homeBtn = page.locator('a.nav-btn.home');
    await expect(homeBtn).toBeVisible();
  });
});

test.describe('Weather Current Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);
  });

  test('shows location name', async ({ page }) => {
    const location = await page.locator('#cw-location').textContent();
    expect(location.length).toBeGreaterThan(0);
  });

  test('shows temperature', async ({ page }) => {
    const temp = await page.locator('#cw-temp').textContent();
    expect(temp).toMatch(/\d+°C/);
  });

  test('shows weather description', async ({ page }) => {
    const desc = await page.locator('#cw-desc').textContent();
    expect(desc.length).toBeGreaterThan(0);
  });

  test('shows wind speed', async ({ page }) => {
    const wind = await page.locator('#cw-wind').textContent();
    expect(wind).toMatch(/km\/h/);
  });

  test('shows humidity percentage', async ({ page }) => {
    const humidity = await page.locator('#cw-humidity').textContent();
    expect(humidity).toMatch(/%/);
  });

  test('shows precipitation', async ({ page }) => {
    const precip = await page.locator('#cw-precip').textContent();
    expect(precip).toMatch(/mm/);
  });
});

test.describe('Weather 7-Day Forecast', () => {
  test('forecast section appears after loading', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);
    const section = page.locator('#forecast-section');
    await expect(section).toBeVisible();
  });

  test('shows 7 forecast cards', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);
    const cards = await page.locator('.forecast-card').count();
    expect(cards).toBe(7);
  });

  test('first card says Today', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);
    const firstDay = await page.locator('.fc-day').first().textContent();
    expect(firstDay).toMatch(/Today|今天/);
  });

  test('cards show hi/lo temperatures', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);
    const temps = await page.locator('.fc-temps').first().textContent();
    expect(temps).toMatch(/\d+°.*\d+°/);
  });
});

test.describe('Weather Taiwan City Selector', () => {
  test('Taiwan select has options', async ({ page }) => {
    await page.goto('/weather.html');
    const optionCount = await page.locator('#taiwan-select option').count();
    // 1 placeholder + 13 cities = 14
    expect(optionCount).toBe(14);
  });

  test('selecting Taipei loads weather', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);

    await page.locator('#taiwan-select').selectOption('0'); // Taipei
    await page.waitForTimeout(2000);

    const location = await page.locator('#cw-location').textContent();
    expect(location).toMatch(/Taipei|台北/);
  });
});

test.describe('Weather World Cities', () => {
  test('world section exists', async ({ page }) => {
    await page.goto('/weather.html');
    const header = page.locator('#world-title');
    await expect(header).toBeVisible();
  });

  test('world grid is collapsed by default', async ({ page }) => {
    await page.goto('/weather.html');
    const grid = page.locator('#world-grid');
    await expect(grid).toHaveClass(/collapsed/);
  });

  test('clicking header expands world cities', async ({ page }) => {
    await page.goto('/weather.html');
    await page.locator('.world-header').click();
    const grid = page.locator('#world-grid');
    await expect(grid).not.toHaveClass(/collapsed/);
  });

  test('world grid has 20 city buttons', async ({ page }) => {
    await page.goto('/weather.html');
    await page.locator('.world-header').click();
    const buttons = await page.locator('.world-city-btn').count();
    expect(buttons).toBe(20);
  });

  test('clicking world city loads weather', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);

    await page.locator('.world-header').click();
    await page.locator('.world-city-btn').first().click(); // Tokyo
    await page.waitForTimeout(3000);

    const location = await page.locator('#cw-location').textContent();
    expect(location).toMatch(/Tokyo|東京/);
  });
});

test.describe('Weather Search', () => {
  test('search input exists', async ({ page }) => {
    await page.goto('/weather.html');
    const input = page.locator('#search-input');
    await expect(input).toBeVisible();
  });

  test('typing in search opens results dropdown', async ({ page }) => {
    await page.goto('/weather.html');
    await page.locator('#search-input').fill('Tokyo');
    await page.waitForSelector('.search-results.open', { timeout: 10000 });
    const results = page.locator('.search-results');
    await expect(results).toHaveClass(/open/);
  });

  test('search results contain items', async ({ page }) => {
    await page.goto('/weather.html');
    await page.locator('#search-input').fill('London');
    await page.waitForSelector('.search-results.open .search-result-item', { timeout: 10000 });
    const items = await page.locator('.search-result-item').count();
    expect(items).toBeGreaterThan(0);
  });
});

test.describe('Weather Language Toggle', () => {
  test('toggles page title to Chinese', async ({ page }) => {
    await page.goto('/weather.html');
    await page.evaluate(() => window.toggleLang());
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('天氣');
  });

  test('toggles forecast title to Chinese', async ({ page }) => {
    await page.goto('/weather.html');
    await waitForWeatherData(page);
    await page.evaluate(() => window.toggleLang());
    const fTitle = await page.locator('#forecast-title').textContent();
    expect(fTitle).toContain('7天預報');
  });

  test('toggles auto button text', async ({ page }) => {
    await page.goto('/weather.html');
    await page.evaluate(() => window.toggleLang());
    const btnText = await page.locator('#auto-btn').textContent();
    expect(btnText).toContain('自動');

    await page.evaluate(() => window.toggleLang());
  });

  test('nav buttons switch language', async ({ page }) => {
    await page.goto('/weather.html');
    await page.evaluate(() => window.toggleLang());
    const navTexts = await page.locator('.nav-btn').allTextContents();
    expect(navTexts.some(t => t.includes('首頁'))).toBe(true);

    await page.evaluate(() => window.toggleLang());
  });

  test('toggles back to English', async ({ page }) => {
    await page.goto('/weather.html');
    await page.evaluate(() => window.toggleLang());
    await page.evaluate(() => window.toggleLang());
    const title = await page.locator('#page-title').textContent();
    expect(title).toContain('Weather');
  });
});

test.describe('Weather Auto-detect Button', () => {
  test('auto detect button exists', async ({ page }) => {
    await page.goto('/weather.html');
    const btn = page.locator('#auto-btn');
    await expect(btn).toBeVisible();
    const text = await btn.textContent();
    expect(text).toMatch(/Auto|自動/);
  });
});
