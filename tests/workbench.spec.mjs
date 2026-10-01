import { test, expect } from '@playwright/test';
const tools = ['attempt-test','batch-timetable','classes','download-tests','test-ids','test-schedule','watch-recording'];
async function isolate(page) {
  await page.route('**/*', route => route.request().url().startsWith('http://localhost:3000') ? route.continue() : route.abort());
  page.on('dialog', dialog => dialog.dismiss());
}
for (const tool of tools) {
  test(`${tool}: shared space, controls, and phone/desktop layout`, async ({ page }) => {
    await isolate(page);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    for (const width of [360,768,1440]) {
      await page.setViewportSize({width,height:900});
      await page.goto(`/functions/${tool}.html`, {waitUntil:'networkidle'});
      await expect(page.locator('body')).toHaveAttribute('data-tool',tool);
      await expect(page.locator('.workbench-home')).toHaveAttribute('href','../index.html?module=settings&panel=functions');
      await expect(page.locator('#workbench-switch')).toHaveCount(0);
      if(await page.locator('.legacy-tool-topbar').count()){await expect(page.locator('.legacy-tool-topbar')).not.toBeVisible();await expect(page.locator('.legacy-tool-topbar')).toHaveAttribute('inert','');}
      const size = await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,content:document.querySelector('.app-full .content')?.scrollWidth,available:document.querySelector('.app-full .content')?.clientWidth}));
      expect(size.document).toBeLessThanOrEqual(size.width+1);
      if(size.content) expect(size.content).toBeLessThanOrEqual(size.available+1);
      if(tool !== 'attempt-test') await expect(page.locator('.workbench-intro')).toBeVisible();
      if(await page.locator('.collection-picker').count()) await expect(page.locator('.collection-picker')).not.toHaveAttribute('inert','');
    }
    if(tool === 'attempt-test'){await page.evaluate(()=>localStorage.setItem('fy_theme_mode','dark'));await page.reload();}
    else await page.getByRole('button',{name:'Toggle light and dark theme',exact:true}).click();
    await expect(page.locator('body')).not.toHaveClass(/light-mode/);
    await expect(page.locator('body')).toHaveCSS('background-color','rgb(17, 23, 25)');
    await expect(page.locator('meta[name=theme-color]')).toHaveAttribute('content','#111719');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
test('return from a function leads back to Settings, not a promoted toolbox', async ({page}) => {
  await isolate(page); await page.goto('/functions/watch-recording.html');
  await page.locator('.tool-back').click();
  await expect(page).toHaveURL(/module=settings&panel=functions/);
});
test('export steps preserve every control and selected values, including mobile scrolling', async ({page}) => {
  await isolate(page); await page.setViewportSize({width:390,height:700});
  await page.goto('/functions/download-tests.html');
  await page.locator('.year-pill').filter({hasText:'2024'}).click();
  await page.locator('#export-next').click();
  await expect(page.locator('[data-export-panel="1"]')).toBeVisible();
  const value = !(await page.locator('#opt-raw').isChecked());
  await page.locator('#opt-raw').setChecked(value);
  await page.locator('#opt-name-filter').fill('Physics');
  for(const id of ['opt-leaderboard','opt-subjectwise','opt-ranks','opt-unpublished','opt-raw','opt-discard-zero','opt-only-itnt','opt-only-leaderboard']) await expect(page.locator('#'+id)).toBeAttached();
  await page.locator('#export-next').click();
  await page.locator('.format-card[data-format=csv]').click();
  await expect(page.locator('#export-summary-format')).toContainText('CSV');
  await expect(page.locator('#export-summary-years')).toContainText('2024');
  await page.locator('#export-prev').click();
  expect(await page.locator('#opt-raw').isChecked()).toBe(value);
  await expect(page.locator('#opt-name-filter')).toHaveValue('Physics');
  await page.locator('[data-export-step="2"]').click();
  await page.locator('.export-log summary').click();
  await page.locator('#terminal-console').scrollIntoViewIfNeeded();
  await expect(page.locator('#terminal-console')).toBeInViewport();
  expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(0);
  await page.evaluate(()=>{document.getElementById('progress-percent').textContent='42%';});
  await expect(page.locator('#export-ring-value')).toHaveText('42%');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('test collection opens a keyboard-accessible sheet, preserving future-date download locks', async ({page}) => {
  await isolate(page); await page.goto('/functions/test-ids.html');
  await page.evaluate(()=>{
    allTests=[{id:101,name:'Physics review',academic_year:2026,exam_date:'2020-01-01'},{id:102,name:'Future chemistry',academic_year:2026,exam_date:'2999-01-01'}];
    document.getElementById('test-loading').style.display='none';renderTestsList(allTests);
  });
  await expect(page.locator('#test-detail-dialog')).not.toBeVisible();
  await page.locator('#test-card-101').focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#selected-test-name')).toHaveText('Physics review');
  await expect(page.locator('#btn-download-test-body')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.locator('#test-card-101')).toBeFocused();
  await page.locator('#test-card-102').click();
  await expect(page.locator('#test-download-locked-banner')).toBeVisible();
  for(const id of ['btn-download-test-header','btn-download-solution-header','btn-download-test-body','btn-download-solution-body']) await expect(page.locator('#'+id)).toBeDisabled();
  await page.getByRole('button',{name:'Close test details'}).click();
  await page.locator('#test-search').fill('Physics');
  await expect(page.locator('.test-item-card')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#test-card-101').click();
  expect(await page.locator('#test-detail-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
});
test('attempt session keeps exit confirmation on both shared navigation links',async({page})=>{
  await isolate(page);await page.goto('/functions/attempt-test.html');
  await page.evaluate(()=>{
    document.getElementById('modal-passcode-lock').style.display='none';
    window.exitCalls=0;window.exitExam=()=>{window.exitCalls++;};
  });
  await page.locator('.workbench-home').click();await page.locator('.tool-back').click();
  expect(await page.evaluate(()=>window.exitCalls)).toBe(2);
  await expect(page).toHaveURL(/attempt-test.html/);
});
test('phone attempt palette stays off-screen until opened and closes through its backdrop',async({page})=>{
 await isolate(page);await page.setViewportSize({width:390,height:844});await page.goto('/functions/attempt-test.html');
 // Isolate the existing exam-shell controls; no real paper is loaded or submitted.
 await page.evaluate(()=>{document.getElementById('modal-passcode-lock').style.display='none';});
 await expect.poll(async()=>(await page.locator('#palette-sidebar').boundingBox()).x).toBeGreaterThanOrEqual(390);
 await page.locator('#btn-toggle-palette').click();await expect(page.locator('#palette-sidebar')).toHaveClass(/open/);
 await expect(page.locator('#palette-backdrop')).toBeVisible();await page.locator('#palette-backdrop').click({position:{x:10,y:150}});
 await expect(page.locator('#palette-sidebar')).not.toHaveClass(/open/);
 await expect.poll(async()=>(await page.locator('#palette-sidebar').boundingBox()).x).toBeGreaterThanOrEqual(390);
});
