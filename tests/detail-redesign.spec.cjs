const {test,expect}=require('@playwright/test');
const populate=require('./fixtures/workspace.cjs');
async function open(page,width=390,theme='dark') {
  await page.context().route('https://**',r=>r.abort());
  await page.setViewportSize({width,height:900});await page.goto('/');
  await page.evaluate(()=>{window.realRankInit=initRankPredictor;window.realPLInit=initPseudoLeaderboardUI});
  await page.evaluate(populate);await page.evaluate(t=>setThemeMode(t),theme);
}
async function modelFixture(page) {
  await page.route('**/models/ranknet/meta.json',route=>route.fulfill({json:{maxMarks_ref:300,stat_constants:{slope_tgn:0,intercept_tgn:.5,slope_k:0,intercept_k:1}}}));
  await page.evaluate(()=>{
    window.initRankPredictor=realRankInit;window.initPseudoLeaderboardUI=realPLInit;
    window.tf={loadLayersModel:async()=>({predict:()=>({data:async()=>[.92],dispose(){}})}),tensor2d:()=>({dispose(){}})};
    nav('neural');
  });
  await expect(page.locator('#rank-status')).toContainText('Model ready');
}
async function fits(page,selector) {
  expect(await page.evaluate(selector=>({doc:document.documentElement.scrollWidth<=innerWidth,content:document.querySelector('.content').scrollWidth<=document.querySelector('.content').clientWidth+1,overflow:[...document.querySelectorAll(selector)].filter(e=>e.getBoundingClientRect().width && e.scrollWidth>e.clientWidth+1).map(e=>e.className)}),selector)).toEqual({doc:true,content:true,overflow:[]});
}
for(const width of[390,1440])for(const theme of['dark','light']){
  test(`neural input/output, reconstruction and export use new layouts: ${width}px ${theme}`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,width,theme);await modelFixture(page);
    await expect(page.locator('#page-neural .rank-hero,#page-neural .rank-predictor-container')).toHaveCount(0);
    await page.locator('#rank-predict-btn').click();await expect(page.locator('#rank-feedback')).toContainText('Please fill');
    for(const[id,value]of[['inp-score','216'],['inp-max','300'],['inp-avg','120'],['inp-N','500']])await page.locator('#'+id).fill(value);
    await page.locator('#rank-predict-btn').click();await expect(page.locator('#r-pct')).toHaveText('92.00%');await expect(page.locator('#r-rank')).toHaveText('~40');
    await expect(page.locator('[data-rank-awaiting]')).toBeHidden();await expect(page.locator('#rank-feedback')).toBeEmpty();
    await page.locator('.lab-trace summary').click();await expect(page.locator('#p-diff')).toHaveText('0.4000');
    await fits(page,'.lab-console,.lab-input-pane,.lab-output-pane,.lab-metrics');
    await page.locator('#subnav').getByRole('button',{name:'Pseudo Leaderboard',exact:true}).click();
    await expect(page.locator('#card-ranknet-predictor')).toBeHidden();await expect(page.locator('[data-pl-awaiting]')).toBeVisible();
    await page.getByRole('button',{name:'Sync from Predictor',exact:true}).click();await expect(page.locator('#pl-avg')).toHaveValue('120');
    await page.getByRole('button',{name:'+ Add Anchor',exact:true}).click();await expect(page.locator('.lab-anchor-record')).toHaveCount(2);
    await page.getByRole('button',{name:/Remove anchor/}).last().click();await expect(page.locator('.lab-anchor-record')).toHaveCount(1);
    await page.locator('#pl-card-mode-chips').getByRole('button',{name:'More Passes',exact:true}).click();await expect(page.locator('#pl-card-passes-slider-wrap')).toBeVisible();
    await page.locator('#pl-card-passes-slider').fill('7');await expect(page.locator('#pl-card-passes-badge')).toHaveText('7x passes');
    await page.locator('#pl-n-override-val').fill('75');
    await page.evaluate(()=>{
      window.pseudoLeaderboardEngine={setModel(){},setMode(){},generateLeaderboard:async options=>{
        window.fixtureGeneration=options;
        const data=Array.from({length:75},(_,i)=>({rank:i+1,marks:275-i*2,percentile:100-i*100/75,isAnchor:i===2}));
        data.meta={modelName:'Fixture model',isNeural:true,mode:options.mode,passes:options.numPasses,timeMs:2};return data;
      }};
    });
    await page.locator('#pl-generate-btn').click();await expect(page.locator('[data-pl-awaiting]')).toBeHidden();await expect(page.locator('#pl-metric-n')).toHaveText('75');
    expect(await page.evaluate(()=>({mode:fixtureGeneration.mode,passes:fixtureGeneration.numPasses,n:fixtureGeneration.overrideN}))).toEqual({mode:'multi-pass',passes:7,n:75});
    await expect(page.locator('#pl-table-tbody tr')).toHaveCount(50);await page.locator('#pl-next-page-btn').click();await expect(page.locator('#pl-table-tbody tr')).toHaveCount(25);
    await page.locator('.lab-table-filters').getByRole('button',{name:'Anchors',exact:true}).click();await expect(page.locator('#pl-table-tbody tr')).toHaveCount(1);
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export CSV',exact:true}).click()]);expect(download.suggestedFilename()).toBe('pseudo_leaderboard_N75.csv');
    await fits(page,'.lab-console,.lab-input-pane,.lab-output-pane,.lab-anchor-row,.lab-table-scroll');expect(errors).toEqual([]);
  });
  test(`syllabus and exam information are independent inspectors: ${width}px ${theme}`,async({page,context})=>{
    await open(page,width,theme);await context.grantPermissions(['clipboard-read','clipboard-write']);await page.evaluate(()=>nav('examhall'));
    const trigger=page.locator('#examhall-list').getByRole('button',{name:'View syllabus',exact:true});await trigger.click();
    const dialog=page.getByRole('dialog',{name:'Exam syllabus',exact:true});await expect(dialog).toBeVisible();await expect(dialog.locator('.topic-ledger')).toHaveCount(3);await expect(dialog.locator('.syllabus-modal-card')).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'Close',exact:true})).toBeFocused();await dialog.locator('#exam-syllabus-copy-btn').click();await expect(dialog.locator('#exam-syllabus-copy-text')).toHaveText('Copied!');
    expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('Atomic structure');await fits(page,'.inspector-dialog,.topic-ledger');
    await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
    await page.evaluate(()=>nav('examcal'));await page.locator('#examcal-list').getByRole('button',{name:'View Details'}).click();
    const info=page.getByRole('dialog',{name:'Exam details',exact:true});await expect(info.locator('.inspector-facts')).toContainText('Examination hall 2');await expect(info.locator('.calendar-detail-card')).toHaveCount(0);
    await expect(info.locator('#calendar-detail-print-btn')).toBeEnabled();await fits(page,'.inspector-dialog,.inspector-facts,.topic-ledger');await page.keyboard.press('Escape');
  });
}
test('Settings Functions navigates to one directory, with no duplicate or overlaid legacy UI',async({page})=>{
  await open(page);await page.evaluate(()=>nav('settings'));await page.locator('#settings-functions-btn').click();
  await expect(page.locator('#page-tools')).toBeVisible();await expect(page.locator('#page-settings')).toBeHidden();await expect(page.locator('.page.active')).toHaveCount(1);
  await expect(page.locator('#settings-functions-grid .tool-launcher')).toHaveCount(7);await expect(page.locator('.legacy-tool-link,.settings-tool-link')).toHaveCount(0);
  await expect(page.locator('#page-settings #settings-functions-card')).toHaveCount(0);await expect(page.locator('#page-tools #settings-functions-card')).toHaveCount(1);
  await expect(page.locator('.dock-btn[data-page="settings"]')).toHaveAttribute('aria-current','page');
  await page.locator('#tool-search').fill('video.open');await expect(page.locator('#settings-functions-grid .tool-launcher')).toHaveCount(1);await expect(page.locator('#settings-functions-grid')).toContainText('Stream player');
});
test('neural dependency failure can be retried without stale script or duplicate output',async({page})=>{
  await open(page);await page.evaluate(()=>{window.initRankPredictor=realRankInit;nav('neural')});await expect(page.locator('#rank-status')).toContainText('Failed to load');
  await expect(page.locator('#rank-predict-btn')).toBeDisabled();await expect(page.locator('#rank-result')).toBeHidden();
  await page.getByRole('button',{name:'Reload model',exact:true}).click();await expect(page.getByRole('button',{name:'Reload model',exact:true})).toBeEnabled();await expect(page.locator('#rank-status')).toContainText('Failed to load');
  expect(await page.locator('script[src*="@tensorflow"]').count()).toBe(0);
  await modelFixture(page);await expect(page.locator('#rank-predict-btn')).toBeEnabled();await expect(page.locator('[data-rank-awaiting]')).toBeVisible();
});
