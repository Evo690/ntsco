import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Reproduce the failure mode: a browser/host still has old unversioned assets,
// and source stylesheets cannot be fetched. The new shell must remain complete.
test('dashboard uses a complete, fresh stylesheet and script despite legacy cached URLs', async ({ page }) => {
  const legacyCss = await readFile(new URL('../src/styles/features.css', import.meta.url), 'utf8');
  const staleRequests = [], nestedStyles = [], errors = [], loadedStyles = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://localhost:3000') return route.abort();
    if (url.pathname.startsWith('/src/styles/')) {
      nestedStyles.push(url.pathname); return route.abort();
    }
    if (url.pathname === '/styles.css') {
      loadedStyles.push(url.href);
      if (!url.searchParams.has('v')) {
        staleRequests.push(url.href);
        return route.fulfill({ contentType:'text/css', body:legacyCss });
      }
    }
    if (url.pathname === '/main.js' && !url.searchParams.has('v')) {
      staleRequests.push(url.href);
      return route.fulfill({ contentType:'text/javascript', body:'window.staleBundleLoaded = true;' });
    }
    return route.continue();
  });
  await page.setViewportSize({ width:1117, height:779 });
  await page.goto('/');
  await page.evaluate(async () => {
    await document.fonts.ready;
    ensureDataForPage = async () => {};
    document.getElementById('login-screen').style.display = 'none';
    document.body.classList.remove('light-mode');
    APP_STATE.dashboardForcedStats = { testName:'INTERNAL TEST-9_12 JEE_P-2', marks:54, totalMarks:180, batchRank:8 };
    updateDashboardWidgets(); renderTodayClasses([]); renderSubnav('dashboard');
  });
  await expect(page.locator('.section-nav')).toHaveCSS('display', 'flex');
  await expect(page.locator('.home-layout')).toHaveCSS('display', 'grid');
  await expect(page.locator('.home-summary')).toHaveCSS('display', 'flex');
  await expect(page.locator('.home-summary > h2')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.site-brand').last()).toHaveCSS('display', 'flex');
  await expect(page.locator('.brand-mark').last()).toHaveCSS('width', '39px');
  await expect(page.locator('#home-score-chart')).toHaveCount(0);
  await expect(page.locator('#dash-test-score')).toHaveText('54');
  await expect(page.locator('#dash-batch-rank')).toHaveText('#8');
  expect(loadedStyles).toHaveLength(1);
  expect(staleRequests).toEqual([]); expect(nestedStyles).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.fonts.check('500 24px "Space Grotesk"'))).toBe(true);

  for (const width of [360,390,768,1117,1440]) {
    await page.setViewportSize({width,height:900});
    await page.evaluate(() => {
      document.getElementById('dash-test-name').textContent = 'INTERNAL_TEST_WITH_AN_EXTREMELY_LONG_UNBROKEN_NAME_FOR_LAYOUT_CHECKS';
      document.getElementById('dash-rank-sub').textContent = 'INTERNAL_TEST_WITH_AN_EXTREMELY_LONG_UNBROKEN_NAME_FOR_LAYOUT_CHECKS';
      document.getElementById('dash-next-exam-val').textContent = 'Tomorrow';
    });
    for (const light of [false,true]) {
      await page.evaluate(light => document.body.classList.toggle('light-mode', light), light);
      const geometry = await page.evaluate(() => {
        const root = document.getElementById('workspace-content');
        return { page:document.documentElement.scrollWidth, viewport:innerWidth, content:root.scrollWidth, available:root.clientWidth,
          cards:[...document.querySelectorAll('.home-summary .stat-card')].map(el => ({actual:el.scrollWidth, available:el.clientWidth})) };
      });
      expect(geometry.page, `${width}px document`).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.content, `${width}px content`).toBeLessThanOrEqual(geometry.available + 1);
      for (const card of geometry.cards) expect(card.actual, `${width}px snapshot card`).toBeLessThanOrEqual(card.available + 1);
    }
  }
});
