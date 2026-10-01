import { test, expect } from '@playwright/test';

// Deterministic UI tests: no real credentials or calls to student services.
async function openPortal(page) {
  await page.route('**/*', route => route.request().url().startsWith('http://localhost:3000') ? route.continue() : route.abort());
  await page.goto('/');
  await expect(page.locator('#login-user')).toBeVisible();
}
async function openWorkspace(page) {
  await openPortal(page);
  await page.evaluate(() => {
    ensureDataForPage = async () => {};
    chemLoadVisitorStat = () => {};
    sessionStorage.setItem('fy_user_name', 'Alex Student');
    document.getElementById('login-screen').style.display = 'none';
    renderSubnav('dashboard');
    renderTodayClasses([]);
    updateDashboardWidgets();
  });
  await expect(page.locator('#workspace-greeting')).toContainText('Alex');
}

async function openDrawerPage(page, id) {
  await page.getByRole('button', { name:'Open navigation', exact:true }).click();
  await page.locator(`.nav-item[onclick*="'${id === 'timetable' ? 'classes' : id}'"]`).click();
}

test('login loads without JavaScript errors and has accessible fields', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openPortal(page);
  await expect(page.getByLabel('Mobile number or username')).toBeVisible();
  await expect(page.locator('.app')).toHaveAttribute('inert', '');
  await expect(page.locator('#login-error')).not.toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.locator('#login-pass')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.locator('#login-pass')).toHaveAttribute('type', 'password');
  await page.getByRole('link', { name: 'Privacy Policy' }).click();
  await expect(page.locator('#privacy-modal-backdrop')).toBeVisible();
  await page.locator('#privacy-modal-backdrop').getByRole('button', { name: 'Close' }).click();
  expect(errors).toEqual([]);
});

test('failed sign-in shows error and restores submit action', async ({ page }) => {
  await openPortal(page);
  await page.evaluate(() => { attemptLogin = async () => { throw new Error('Invalid credentials'); }; });
  await page.locator('#login-user').fill('test-student');
  await page.locator('#login-pass').fill('wrong-password');
  await page.locator('#login-submit').click();
  await expect(page.locator('#login-error')).toContainText('Invalid credentials');
  await expect(page.locator('#login-submit')).toBeEnabled();
  await expect(page.locator('#login-screen')).toBeVisible();
});

test('dashboard routes, subviews, quick actions and themes work', async ({ page }) => {
  await openWorkspace(page);
  await page.locator('.subnav-chip').filter({ hasText: 'Schedule' }).click();
  await expect(page.locator('.trend-card')).not.toBeVisible();
  await page.locator('.subnav-chip').filter({ hasText: 'Overview' }).click();
  await expect(page.locator('.trend-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.locator('body')).not.toHaveClass(/light-mode/);
  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.locator('body')).toHaveClass(/light-mode/);
  await page.locator('.desk-links').getByRole('button', { name: /Results/ }).click();
  await expect(page.locator('#page-era')).toBeVisible();
  for (const id of ['courses','messages','timetable','examhall','examcal','era','notices','settings','dashboard']) {
    await openDrawerPage(page, id);
    await expect(page.locator(`#page-${id}`)).toBeVisible();
    await expect(page.locator(`.nav-item[onclick*="'${id === 'timetable' ? 'classes' : id}'"]`)).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('button', { name: 'Quick navigation' }).click();
  await expect(page.locator('#command-input')).toBeVisible();
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`responsive shell fits ${width}px without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openWorkspace(page);
    const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, view: innerWidth, content: document.querySelector('.content').scrollWidth, contentWidth: document.querySelector('.content').clientWidth }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.view);
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.contentWidth + 1);
    if (width <= 768) {
      await expect(page.locator('.mobile-dock')).toBeVisible();
      await expect(page.locator('#sidebar')).toHaveAttribute('inert', '');
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(page.locator('#hamburger')).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(page.locator('#hamburger')).toHaveAttribute('aria-expanded', 'false');
      await page.locator('.dock-btn[data-page="era"]').click();
      await expect(page.locator('#page-era')).toBeVisible();
    } else {
      await expect(page.locator('.mobile-dock')).not.toBeVisible();
    }
  });
}

test('all primary feature layouts fit a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await page.evaluate(() => { initRankPredictor = async () => {}; });
  for (const id of ['courses','messages','timetable','examhall','era','examcal','neural','notices','study','settings']) {
    await page.evaluate(id => nav(id, document.querySelector(`.nav-item[onclick*="'${id === 'timetable' ? 'classes' : id}'"]`)), id);
    await expect(page.locator(`#page-${id}`)).toBeVisible();
    expect(await page.locator('.content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
});

test('authentication surface fits mobile, tablet, and desktop', async ({ page }) => {
  await openPortal(page);
  for (const width of [360, 390, 700, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 768 });
    await page.locator('#login-submit').scrollIntoViewIfNeeded();
    await expect(page.locator('#login-submit')).toBeInViewport();
    expect(await page.locator('#login-screen').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await expect(page.locator('#login-user')).toBeVisible();
  }
});

test('successful sign-in transitions through the existing form handler', async ({ page }) => {
  await openPortal(page);
  await page.evaluate(() => {
    attemptLogin = async () => { sessionStorage.setItem('fy_user_name', 'Alex Student'); };
    loadPortalData = async () => { renderSubnav('dashboard'); renderTodayClasses([]); updateDashboardWidgets(); };
  });
  await page.locator('#login-user').fill('test-student');
  await page.locator('#login-pass').fill('test-password');
  await page.locator('#login-submit').click();
  await expect(page.locator('#login-screen')).not.toBeVisible();
  await expect(page.locator('.app')).not.toHaveAttribute('inert', '');
  await expect(page.locator('#workspace-greeting')).toContainText('Alex');
});

test('advanced functions are hidden in Settings, searchable, and retain quick-ID inputs', async ({ page }) => {
  await openWorkspace(page);
  await expect(page.locator('.section-nav [data-route=tools]')).toHaveCount(0);
  await expect(page.locator('#page-tools')).toHaveCount(0);
  await expect(page.locator('#settings-functions-card')).not.toBeVisible();
  await page.locator('.section-nav [data-route=settings]').click();
  await expect(page.locator('#settings-functions-card')).not.toBeVisible();
  await page.locator('#settings-functions-btn').click();
  await expect(page.locator('#settings-functions-card')).toBeVisible();
  await expect(page.locator('.function-nav-card')).toHaveCount(7);
  await expect(page.locator('#settings-functions-card')).not.toContainText('Master Leaderboard');
  await page.getByLabel('Filter functions').fill('watch recording');
  await expect(page.locator('.function-nav-card:visible')).toHaveCount(1);
  await page.getByLabel('Filter functions').fill('not-a-function');
  await expect(page.locator('#tool-filter-empty')).toBeVisible();
  await page.getByLabel('Filter functions').fill('');
  await expect(page.locator('.function-nav-card:visible')).toHaveCount(7);
  await expect(page.locator('#settings-attempt-test-id-input')).toBeVisible();
  await expect(page.locator('#settings-recording-id-input')).toBeVisible();
  await page.locator('#settings-functions-btn').click();
  await expect(page.locator('#settings-functions-card')).not.toBeVisible();
});

test('course records retain data and the original open action', async ({ page }) => {
  await openWorkspace(page);
  await page.evaluate(() => {
    APP_STATE.courses = [{ courseId:123, courseName:'Example physics course', goal:'Physics', startDate:'2026-01-01', expireyDate:'2027-01-01', isLive:false }];
    openCourseDetail = id => { window.testOpenedCourse = id; };
  });
  await openDrawerPage(page, 'courses');
  await expect(page.locator('.course-record')).toContainText('Example physics course');
  await expect(page.locator('.course-record')).toContainText('2027');
  await page.locator('.course-record button').click();
  expect(await page.evaluate(() => window.testOpenedCourse)).toBe(123);
  await expect(page.locator('.course-prog-bar')).toHaveCount(0);
});

test('return link restores Settings and opens its functions after login', async ({ page }) => {
  await page.route('**/*', route => route.request().url().startsWith('http://localhost:3000') ? route.continue() : route.abort());
  await page.goto('/?module=settings&panel=functions');
  await page.evaluate(() => {
    ensureDataForPage = async () => {};
    attemptLogin = async () => {};
    loadPortalData = async () => {};
  });
  await page.locator('#login-user').fill('test-user');
  await page.locator('#login-pass').fill('test-password');
  await page.locator('#login-submit').click();
  await expect(page.locator('#page-settings')).toBeVisible();
  await expect(page.locator('#settings-functions-card')).toBeVisible();
  await expect(page.locator('.nav-item[onclick*="\'settings\'"]')).toHaveAttribute('aria-current','page');
});

test('attendance query renders record counts and a recoverable error', async ({ page }) => {
  await openWorkspace(page);
  await page.evaluate(() => { fetchAttendance = async () => [{ classDate:'2026-10-01', isPresent:true },{ classDate:'2026-10-02',isPresent:false }]; });
  await page.getByRole('button', { name:'Open navigation', exact:true }).click();
  await page.locator('.nav-item[onclick*=openAttendanceModal]').click();
  await expect(page.getByRole('dialog', { name:'Attendance' })).toBeVisible();
  await expect(page.locator('.attendance-summary')).toContainText('1 present / 1 absent');
  await page.evaluate(() => { fetchAttendance = async () => { throw new Error('Offline'); }; });
  await page.locator('#att-modal-backdrop').getByRole('button', { name:'View', exact:true }).click();
  await expect(page.locator('#att-modal-body')).toContainText('Select View to retry');
  await page.locator('#att-modal-backdrop').getByRole('button', { name:'Close' }).click();
  await expect(page.locator('#att-modal-backdrop')).not.toBeVisible();
});

test('model lab idle output switches off when a result is available', async ({ page }) => {
  await openWorkspace(page);
  await page.evaluate(() => { initRankPredictor = async () => {}; });
  await openDrawerPage(page, 'neural');
  await expect(page.locator('#rank-result-idle')).toBeVisible();
  await page.evaluate(() => { document.getElementById('rank-result').style.display='block'; });
  await expect(page.locator('#rank-result-idle')).not.toBeVisible();
  await expect(page.locator('#rank-result')).toBeVisible();
});

test('result recap, subject charts, solutions and ordinary leaderboard keep their actions', async ({page})=>{
  const analysis = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./fixtures/result.json',import.meta.url),'utf8'));
  await openWorkspace(page);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(analysis=>{
    APP_STATE.currentResult={analysis,selected:{id:101,testName:analysis.testName},leaderboard:{leaderboardScore:[{ranks:1,studentName:'Sample student',totalMarks:276,subjectPerformance:[{subjectName:'Physics',totalMarks:96}]}]}};
    document.getElementById('result-detail-body').innerHTML=buildResultAnalysisHtml(analysis,{id:101},{showLeaderboardButton:true});
    nav('result-detail');
  },analysis);
  await expect(page.locator('.score-story-value')).toContainText('186');
  await expect(page.locator('.outcome-donut')).toHaveAttribute('aria-label','Correct 48, Incorrect 12, Unattempted 15');
  await expect(page.locator('.subject-bar-row')).toHaveCount(3);
  await page.locator('.result-extra summary').click();
  await expect(page.locator('.subject-result-card')).toHaveCount(3);
  await expect(page.locator('.result-extra')).toContainText('City Rank');
  await page.locator('.result-links').getByRole('button',{name:'Solutions',exact:true}).click();
  await expect(page.locator('.sol-card')).toHaveCount(3);
  await page.locator('.sol-tab-btn').filter({hasText:'Chemistry'}).click();
  await expect(page.locator('.sol-card:visible')).toHaveCount(1);
  await page.locator('#ak-toggle-btn').click();await expect(page.locator('#ak-panel')).toBeVisible();
  await page.evaluate(()=>openCurrentLeaderboard());
  await expect(page.locator('.standing-highlight')).toContainText('276');
  await expect(page.locator('#leaderboard-body .leaderboard-table')).toContainText('Sample student');
  for(const width of [360,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const id of ['result-detail','solutions','leaderboard']){
      await page.evaluate(id=>nav(id),id);
      expect(await page.locator('.content').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('Overview no longer includes The longer view or recent score chart',async({page})=>{
  await openWorkspace(page);
  await expect(page.locator('#page-dashboard')).not.toContainText('The longer view');
  await expect(page.locator('#home-score-chart')).toHaveCount(0);
  await expect(page.locator('#page-dashboard .today-card')).toBeVisible();
});
