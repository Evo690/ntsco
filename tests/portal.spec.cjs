const { test, expect } = require('@playwright/test');
const contract = require('./feature-contract.json');

// Never contact production student APIs, analytics, or cloud databases in UI tests.
async function openPortal(page) {
  await page.route('https://**', route => route.abort());
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
}
async function workspace(page) {
  await openPortal(page);
  await page.evaluate(() => {
    window.ensureDataForPage = async () => {};
    window.chemLoadVisitorStat = () => {};
    window.chemSyncAll = async () => {};
    window.chemDownloadProgress = async () => {};
    window.chemEnsureSupabase = async () => {};
    window.initRankPredictor = async () => {};
    window.initPseudoLeaderboardUI = () => {};
    document.getElementById('login-screen').style.display = 'none';
    sessionStorage.setItem('fy_user_name', 'Alex Student');
    setUserProfileDetails();
    initTopbarEnhancements();
    renderSubnav('dashboard');
    renderTodayClasses([]);
    updateDashboardWidgets();
  });
}

test('login is accessible, validates input, and can reveal a password', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await openPortal(page);
  await expect(page.getByRole('heading', { name: 'Authenticate', exact: true })).toBeVisible();
  await expect(page.locator('.app')).toHaveJSProperty('inert', true);
  await page.getByLabel('Password', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.locator('#login-pass')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.locator('#login-pass')).toHaveAttribute('type', 'password');
  await page.locator('#login-submit').click();
  expect(await page.locator('#login-user').evaluate(el => el.validity.valueMissing)).toBeTruthy();
  await expect(page.locator('#login-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('login errors and successful sign-in retain the existing auth handler', async ({ page }) => {
  await openPortal(page);
  await page.evaluate(() => { window.attemptLogin = async () => { throw new Error('Incorrect credentials'); }; });
  await page.getByLabel('Mobile number or username').fill('test-student');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.locator('#login-submit').click();
  await expect(page.getByRole('alert')).toHaveText('Incorrect credentials');
  await expect(page.locator('#login-submit')).toBeEnabled();
  await page.evaluate(() => {
    window.attemptLogin = async (user, pass) => { window.testCredentials = [user, pass]; };
    window.loadPortalData = async () => { window.testLoaded = true; };
  });
  await page.locator('#login-submit').click();
  await expect(page.locator('#login-screen')).toBeHidden();
  await expect(page.locator('.app')).toHaveJSProperty('inert', false);
  expect(await page.evaluate(() => testCredentials)).toEqual(['test-student', 'test-password']);
  expect(await page.evaluate(() => testLoaded)).toBe(true);
});

test('sign-in no longer exposes the removed privacy policy', async ({ page }) => {
  await openPortal(page);
  await expect(page.getByRole('link', { name: /Privacy.*policy/i })).toHaveCount(0);
  await expect(page.locator('#privacy-link, #privacy-modal-backdrop')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.showPrivacyPolicy)).toBe('undefined');
  await expect(page.locator('#login-submit')).toBeVisible();
});

test('all original pages and handlers remain mounted', async ({ page }) => {
  await workspace(page);
  for (const id of contract.ids) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  for (const route of ['courses', 'messages', 'timetable', 'examhall', 'examcal', 'era', 'study', 'notices', 'settings', 'neural', 'dashboard']) {
    await page.locator(`.sidebar .nav-item[onclick*="'${route}'"]`).click();
    await expect(page.locator(`#page-${route}`)).toBeVisible();
    await expect(page.locator('.page.active')).toHaveCount(1);
    await expect(page.locator(`.sidebar .nav-item[onclick*="'${route}'"]`)).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.locator('#welcome-name')).toHaveText('Alex');
});

test('course shortcut, search filtering, theme preference, and command palette work', async ({ page }) => {
  await workspace(page);
  await page.evaluate(() => {
    APP_STATE.courses = [{ id: 1, name: 'Physics foundations', courseName: 'Physics foundations', subjectName: 'Physics' }, { id: 2, name: 'Chemistry essentials', courseName: 'Chemistry essentials', subjectName: 'Chemistry' }];
  });
  await page.locator('.nav-item[data-route="courses"]').click();
  await expect(page.locator('#page-courses')).toBeVisible();
  await page.locator('#global-search').fill('Physics');
  await expect(page.locator('#courses-grid')).toContainText('Physics');
  await expect(page.locator('#courses-grid')).not.toContainText('Chemistry');
  await page.getByRole('button', { name: 'Switch color theme' }).click();
  await expect(page.locator('body')).toHaveClass(/light-mode/);
  expect(await page.evaluate(() => localStorage.getItem(getUserStorageKey('fy_theme_mode')))).toBe('light');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#command-input')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#command-input')).toBeHidden();
});

test('practice access stays checked and attendance remains reachable', async ({ page }) => {
  await workspace(page);
  await page.evaluate(() => { window.checkPracticeAccess = async () => false; });
  await page.locator('.sidebar .nav-item[onclick*="\'practice\'"]').click();
  await expect(page.locator('#page-dashboard')).toBeVisible();
  await page.evaluate(() => {
    window.checkPracticeAccess = async () => true;
    window.showModeSelection = () => {};
  });
  await page.locator('.sidebar .nav-item[onclick*="\'practice\'"]').click();
  await expect(page.locator('#page-practice')).toBeVisible();
  await page.evaluate(() => { window.fetchAttendance = async () => []; });
  await page.getByRole('button', { name: 'Attendance', exact: true }).click();
  await expect(page.locator('#att-modal-backdrop')).toBeVisible();
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`responsive layout at ${width}px has no horizontal page overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await workspace(page);
    const metrics = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, login: document.getElementById('login-screen').scrollWidth, content: document.querySelector('.content').scrollWidth, client: document.querySelector('.content').clientWidth }));
    expect(metrics.document).toBeLessThanOrEqual(metrics.width);
    expect(metrics.content).toBeLessThanOrEqual(metrics.client + 1);
    await page.evaluate(() => { document.getElementById('login-screen').style.display = 'flex'; });
    const login = await page.locator('#login-screen').evaluate(el => [el.scrollWidth, el.clientWidth]);
    expect(login[0]).toBeLessThanOrEqual(login[1]);
  });
}

test('mobile drawer supports keyboard, dismissal, navigation and search', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await workspace(page);
  await expect(page.locator('#sidebar')).toHaveJSProperty('inert', true);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(page.locator('#hamburger')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#main-content')).toHaveJSProperty('inert', true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#hamburger')).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.locator('.sidebar .nav-item[onclick*="\'courses\'"]').click();
  await expect(page.locator('#page-courses')).toBeVisible();
  await expect(page.locator('#sidebar')).toHaveJSProperty('inert', true);
  await page.getByRole('button', { name: 'Search workspace', exact: true }).click();
  await expect(page.locator('#global-search')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#global-search')).toBeHidden();
});

test('neural tools load on demand and report unavailable dependencies without crashing', async ({ page }) => {
  await openPortal(page);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => {
    document.getElementById('login-screen').style.display = 'none';
    window.ensureDataForPage = async () => {};
  });
  await page.locator('.sidebar .nav-item[onclick*="\'neural\'"]').click();
  await expect(page.locator('#page-neural')).toBeVisible();
  await expect(page.locator('#rank-status')).toContainText('Failed to load');
  expect(errors).toEqual([]);
});

for (const route of contract.standalone) {
  test(`standalone tool remains available: ${route}`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**', route => route.abort());
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(`/${route}`);
      expect(response.status()).toBe(200);
      await expect(page.locator('body')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    expect(errors).toEqual([]);
  });
}

// A page can have no document overflow and still be squeezed into the wrong
// grid column. Check the actual shell geometry, including a zoom-like viewport.
for (const [width, height] of [[360, 800], [390, 844], [747, 509], [768, 900], [769, 900], [1121, 764], [1440, 950]]) {
  for (const theme of ['light', 'dark']) {
    test(`signed-in ${theme} shell fills its viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await workspace(page);
      await page.evaluate(theme => setThemeMode(theme), theme);
      // Exercise the returning-user path: read the saved preference on reload.
      await workspace(page);
      await expect(page.locator('body')).toHaveClass(theme === 'light' ? /light-mode/ : /^(?!.*light-mode)/);
      const geometry = await page.evaluate(() => {
        const rect = selector => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        return {
          topbar: rect('.topbar'), main: rect('.main'), heading: rect('#page-dashboard .module-heading'),
          subnav: rect('.subnav'), contentRect: rect('.content'),
          layout: getComputedStyle(document.querySelector('.app')).display,
          accent: getComputedStyle(document.body).getPropertyValue('--accent').trim(),
          content: document.querySelector('.content').scrollWidth,
          client: document.querySelector('.content').clientWidth
        };
      });
      const left = width <= 768 ? 0 : 200;
      expect(geometry.layout).toBe('grid');
      expect(geometry.topbar.x).toBe(0);
      expect(geometry.topbar.width).toBe(width);
      expect(geometry.main.x).toBe(left);
      expect(geometry.main.width).toBe(width - left);
      expect(geometry.main.y).toBe(width <= 768 ? 54 : 58);
      expect(geometry.heading.width).toBeGreaterThan(250);
      expect(geometry.subnav.y).toBe(geometry.main.y);
      expect(geometry.contentRect.y).toBeGreaterThanOrEqual(geometry.subnav.y + geometry.subnav.height);
      expect(geometry.heading.y).toBeGreaterThanOrEqual(geometry.subnav.y + geometry.subnav.height);
      expect(geometry.accent).toBe(theme === 'light' ? '#35650e' : '#c3f779');
      expect(geometry.content).toBeLessThanOrEqual(geometry.client + 1);
    });
  }
}

test('new markup does not reuse the previous unversioned stylesheet URL', async ({ page }) => {
  let staleStylesRequested = false;
  await page.route('**/styles.css', route => {
    staleStylesRequested = true;
    return route.fulfill({ contentType: 'text/css', body: '.app { display: flex; } .topbar { width: 72vw; }' });
  });
  await workspace(page);
  await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', /^styles\.css\?v=[a-f0-9]{12}$/);
  await expect(page.locator('.app')).toHaveCSS('display', 'grid');
  expect(staleStylesRequested).toBe(false);
});

test('rank output replaces, rather than overlaps, its empty state', async ({ page }) => {
  await workspace(page);
  await page.locator('.sidebar [data-route="neural"]').click();
  await expect(page.locator('[data-rank-awaiting]')).toBeVisible();
  await page.evaluate(() => { document.getElementById('rank-result').style.display = 'block'; });
  await expect(page.locator('[data-rank-awaiting]')).toBeHidden();
  await page.evaluate(() => { document.getElementById('rank-result').style.display = 'none'; });
  await expect(page.locator('[data-rank-awaiting]')).toBeVisible();
});
