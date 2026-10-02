const { test, expect } = require('@playwright/test');

async function openTool(page, name, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('https://**', route => route.abort());
  await page.goto(`/functions/${name}.html`);
  await expect(page.locator('.tool-tabs a')).toHaveCount(7);
  await expect(page.locator('.tool-tabs [aria-current="page"]')).toHaveAttribute('href', `${name}.html`);
}

test('directory filters modules by category and command, with a working empty state', async ({ page }) => {
  await page.route('https://**', route => route.abort());
  await page.goto('/');
  await page.evaluate(() => {
    document.getElementById('login-screen').style.display='none';
    window.ensureDataForPage=async()=>{};
    nav('tools',document.querySelector('.nav-item[data-route="tools"]'));
  });
  const cards=page.locator('[data-tool-directory="all"] .tool-launcher');
  await expect(cards).toHaveCount(7);
  await page.getByRole('button',{name:'Classes',exact:true}).click();
  await expect(cards).toHaveCount(3);
  await page.locator('#tool-search').fill('video.open');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Stream player');
  await expect(cards).toHaveAttribute('href','functions/watch-recording.html');
  await page.locator('#tool-search').fill('not-a-module');
  await expect(cards).toHaveCount(0);
  await expect(page.locator('.directory-empty')).toBeVisible();
});

test('test registry preserves search, detail selection and future-paper locking', async ({ page }) => {
  await openTool(page,'test-ids');
  await page.evaluate(() => {
    allTests=[{id:101,name:'Physics archive',academic_year:2026,exam_date:'2020-01-01',mode:'Online'},{id:102,name:'Future paper',academic_year:2026,exam_date:'2099-01-01',mode:'Online'}];
    document.getElementById('year-selector').innerHTML='<option value="all">All years</option>';
    document.getElementById('test-loading').style.display='none';
    filterTests();
  });
  await page.locator('#test-search').fill('101');
  await expect(page.locator('.test-item-card')).toHaveCount(1);
  await page.locator('#test-card-101').click();
  await expect(page.locator('#selected-test-name')).toHaveText('Physics archive');
  await expect(page.locator('#test-details-view')).toBeVisible();
  await expect(page.locator('#test-placeholder')).toBeHidden();
  await expect(page.locator('#test-download-locked-banner')).toBeHidden();
  await page.locator('#test-search').fill('Future');
  await page.locator('#test-card-102').click();
  await expect(page.locator('#test-download-locked-banner')).toBeVisible();
});

test('recording index keeps batch selection, subject and keyword filters', async ({ page }) => {
  await openTool(page,'classes');
  await page.evaluate(() => {
    allClasses=[{id:201,name:'Fixture batch',subject:'Physics',courseName:'Motion',academicYear:2026,startDateTime:'2026-09-01T09:00:00',duration:60},{id:202,name:'Fixture batch',subject:'Chemistry',courseName:'Atomic structure',academicYear:2026,startDateTime:'2026-09-02T09:00:00',duration:60}];
    processBatchesFromClasses();
    document.getElementById('batch-loading').style.display='none';
    renderBatchesList(allBatches);
  });
  await page.locator('.batch-item-btn').click();
  await expect(page.locator('#classes-grid .class-card')).toHaveCount(2);
  await page.locator('#batch-filters-row').getByRole('button',{name:'Physics',exact:true}).click();
  await expect(page.locator('#classes-grid .class-card')).toHaveCount(1);
  await expect(page.locator('#classes-grid')).toContainText('Motion');
  await page.locator('#class-filter-search').fill('not-found');
  await expect(page.locator('#classes-grid')).toContainText('No classes found');
});

test('batch scheduler can render returned class data without changing API behavior', async ({ page }) => {
  await openTool(page,'batch-timetable');
  await page.evaluate(() => {
    API_CONFIG.token='fixture-only';
    window.fetchTimetable=async()=>[{classDate:'2026-10-02',startTime:'09:00',subjects:'Physics',classType:'Regular Class'}];
    document.getElementById('batch-loading').style.display='none';
    renderBatchesList([{id:301,name:'Fixture science',year:2026}]);
  });
  await page.locator('#batch-btn-301').click();
  await expect(page.locator('#selected-batch-name')).toHaveText('Fixture science');
  await expect(page.locator('#timetable-grid')).toBeVisible();
  await expect(page.locator('#timetable-grid')).toContainText('Physics');
  await expect(page.locator('#timetable-placeholder')).toBeHidden();
  await expect(page.locator('.agenda-weekday')).toHaveText('FRI');
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:900});
    const geometry=await page.locator('.batch-agenda-column').evaluate(el=>({fits:el.scrollWidth<=el.clientWidth+1,day:parseFloat(getComputedStyle(el.querySelector('.agenda-weekday')).fontSize),date:parseFloat(getComputedStyle(el.querySelector('.agenda-date')).fontSize)}));
    expect(geometry.fits).toBe(true);expect(geometry.day).toBeGreaterThan(geometry.date*2);
  }
});

test('schedule explorer opens timing, venue and syllabus details', async ({ page }) => {
  await openTool(page,'test-schedule');
  await page.evaluate(() => {
    allSchedules=[{id:401,name:'Fixture examination',dateTime:'2026-10-04T09:00:00',academicYear:2026,mode:'Offline',venue:'Lab 2',courses:'Science',duration:'60 minutes',syllabus:'Physics: Mechanics'}];
    document.getElementById('schedule-loading').style.display='none';
    renderSchedulesList(allSchedules);
  });
  await page.locator('#sched-card-401').click();
  await expect(page.locator('#schedule-details-view')).toBeVisible();
  await expect(page.locator('#selected-schedule-title')).toHaveText('Fixture examination');
  await expect(page.locator('#detail-venue')).toHaveText('Lab 2');
  await expect(page.locator('#syllabus-container')).toContainText('Mechanics');
  await expect(page.locator('#syllabus-container .topic-ledger')).toHaveCount(1);
  await expect(page.locator('#syllabus-container .syllabus-subject-card')).toHaveCount(0);
  await expect(page.locator('#schedule-placeholder')).toBeHidden();
});

test('removed Master Leaderboard is absent from navigation and direct URLs', async ({ page, request }) => {
  await page.route('https://**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.manifest-row')).toHaveCount(7);
  await expect(page.locator('a[href*="master-leaderboard"]')).toHaveCount(0);
  await page.evaluate(() => {
    document.getElementById('login-screen').style.display='none';
    window.ensureDataForPage=async()=>{};
    nav('tools');
  });
  await expect(page.locator('[data-tool-directory="all"] .tool-launcher')).toHaveCount(7);
  await page.locator('#tool-search').fill('ranks.inspect');
  await expect(page.locator('[data-tool-directory="all"] .tool-launcher')).toHaveCount(0);
  await expect(page.locator('.directory-empty')).toBeVisible();
  for (const file of ['master-leaderboard.html','master-leaderboard.js','styles/master-leaderboard.css']) {
    expect((await request.get('/functions/'+file)).status()).toBe(404);
  }
  await openTool(page,'test-ids');
  await expect(page.locator('.tool-tabs a[href*="master-leaderboard"]')).toHaveCount(0);
});

test('export console keeps configuration controls and blocks jobs without authentication', async ({ page }) => {
  await openTool(page,'download-tests');
  await expect(page.locator('#btn-start')).toBeDisabled();
  await expect(page.locator('#btn-cancel')).toBeHidden();
  await expect(page.locator('#auth-warning-alert')).toBeVisible();
  await page.locator('[data-format="csv"]').click();
  await expect(page.locator('[data-format="csv"]')).toHaveClass(/active/);
  await page.locator('#item-leaderboard .switch').click();
  await expect(page.locator('#opt-leaderboard')).not.toBeChecked();
  await page.locator('#year-pills').getByText('2025',{exact:true}).click();
  await expect(page.locator('#year-pills .active')).toHaveCount(2);
});

test('stream player retains auth checks and playback/download controls', async ({ page }) => {
  await openTool(page,'watch-recording');
  await page.locator('#main-search-input').fill('601');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect(page.locator('#video-meta-info')).toHaveText('Authentication required');
  await page.evaluate(() => { API_CONFIG.token='fixture-only'; });
  await page.route('https://frosty-frog-31f9.evodev.workers.dev/**',route=>route.fulfill({json:{data:'https://example.invalid/test-video.mp4'}}));
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect(page.locator('#video-container')).toBeVisible();
  await expect(page.locator('#btn-download')).toHaveAttribute('href','https://example.invalid/test-video.mp4');
  await page.getByRole('button',{name:'2x',exact:true}).click();
  await expect(page.locator('#recording-video')).toHaveJSProperty('playbackRate',2);
});

for(const name of ['test-ids','batch-timetable','classes','test-schedule','watch-recording']) {
  test(`mobile explorer opens, traps keyboard and dismisses: ${name}`,async({page})=>{
    await openTool(page,name,390);
    await expect(page.locator('#sidebar')).toHaveJSProperty('inert',true);
    await page.getByRole('button',{name:'Open explorer',exact:true}).click();
    await expect(page.locator('#hamburger')).toHaveAttribute('aria-expanded','true');
    await expect(page.locator('#sidebar')).toHaveJSProperty('inert',false);
    await page.keyboard.press('Escape');
    await expect(page.locator('#sidebar')).toHaveJSProperty('inert',true);
  });
}

test('exam runner preserves restricted entry, loading, answer selection and review navigation',async({page})=>{
  await page.addInitScript(()=>{sessionStorage.setItem('fy_token','fixture-only');});
  await openTool(page,'attempt-test',390);
  await page.locator('#gate-passcode-input').fill('wrong');
  await page.locator('#gate-passcode-input').press('Enter');
  await expect(page.locator('#gate-passcode-error')).toBeVisible();
  await page.locator('#gate-passcode-input').fill('ntscx');
  await page.locator('#gate-passcode-input').press('Enter');
  await expect(page.locator('#modal-launcher')).toBeVisible();
  await page.route('https://frosty-frog-31f9.evodev.workers.dev/**',route=>{
    const url=new URL(route.request().url()).searchParams.get('url') || '';
    if(url.includes('GetPaperInstructions'))return route.fulfill({json:{data:{examGuid:'fixture-guid',studentExamId:1,timeDuration:60,paperName:'Fixture mechanics',totalMarks:8}}});
    if(url.includes('GetTestPaper'))return route.fulfill({json:{data:{testName:'Fixture mechanics',timeDuration:60,subjectPapers:[{subjectName:'Physics',questions:[{questionId:701,questionNo:1,questionType:'Single Choice',questionImage:'',marks:4,negativeMarks:1},{questionId:702,questionNo:2,questionType:'Single Choice',questionImage:'',marks:4,negativeMarks:1}]}]}}});
    return route.fulfill({json:{data:{},statusCode:200}});
  });
  await page.locator('#launcher-test-id').fill('701');
  await page.locator('#btn-launcher-load').click();
  await expect(page.locator('#modal-instructions')).toBeVisible();
  await page.locator('#inst-agree-check').check();
  await page.locator('[onclick="startExamSession()"]').click();
  await expect(page.locator('#modal-instructions')).toBeHidden();
  await expect(page.locator('#q-label-number')).toHaveText('Question 1');
  const buttonBounds = await page.locator('.question-footer button').evaluateAll(buttons => buttons.map(b => { const r=b.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
  expect(buttonBounds.every(Boolean)).toBe(true);
  await page.locator('#opt-card-A').click();
  await expect(page.locator('#opt-card-A')).toHaveClass(/selected/);
  await page.locator('[onclick="saveAndNext()"]', {hasText:'Save'}).first().click();
  await expect(page.locator('#q-label-number')).toHaveText('Question 2');
  await expect(page.locator('#stat-answered')).toHaveText('1');
  await page.locator('#btn-prev-q').click();
  await expect(page.locator('#opt-card-A')).toHaveClass(/selected/);
});

test('selected mobile registry keeps summary stats and metadata visible',async({page})=>{
  await openTool(page,'test-ids',390);
  await page.evaluate(()=>{
    allTests=[{id:101,name:'Fixture paper / a long course examination name',academic_year:2026,exam_date:'2020-01-01',mode:'Offline'}];
    renderTestsList(allTests);selectTest(101);
  });
  const geometry=await page.locator('.stat-grid').evaluate(el=>({height:el.getBoundingClientRect().height,scroll:document.querySelector('.content').scrollWidth,client:document.querySelector('.content').clientWidth}));
  expect(geometry.height).toBeGreaterThan(60);
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.client);
  await expect(page.locator('#detail-test-id')).toBeVisible();
  await expect(page.locator('#btn-copy-id')).toBeVisible();
});
