const { test, expect } = require('@playwright/test');
const populate = require('./fixtures/workspace.cjs');
async function open(page,width=390,theme='dark') {
  await page.setViewportSize({width,height:900});
  await page.route('https://**',r=>r.abort());
  await page.goto('/');
  await page.evaluate(populate);
  await page.evaluate(theme=>{setThemeMode(theme);nav('dashboard',document.querySelector('[data-route="dashboard"]'));},theme);
}
async function fits(page,selectors) {
  const geometry=await page.evaluate(selectors=>({
    documentFits:document.documentElement.scrollWidth<=innerWidth,
    contentFits:document.querySelector('.content').scrollWidth<=document.querySelector('.content').clientWidth+1,
    overflow:[...document.querySelectorAll(selectors)].filter(el=>el.getBoundingClientRect().width && el.scrollWidth>el.clientWidth+1).map(el=>el.className)
  }),selectors);
  expect(geometry).toEqual({documentFits:true,contentFits:true,overflow:[]});
}

test('four-item dock opens forced Results, keeps detail context, and navigates Classes and Settings',async({page})=>{
  await open(page);
  const dock=page.locator('.mobile-dock');
  await expect(dock.getByRole('button')).toHaveText(['Overview','Results','Classes','Settings']);
  await dock.getByRole('button',{name:'Results',exact:true}).click();
  await expect(page.locator('#page-era')).toBeVisible();
  await page.evaluate(()=>{window.fixtureCalls=[];window.fetchAppearedResult=async(token,id)=>{fixtureCalls.push(String(id));return {examId:'fixture-exam'}};});
  await page.locator('#era-list').getByRole('button',{name:'Open result'}).click();
  await expect(page.locator('.report-mode-note')).toContainText('independently of publish status');
  expect(await page.evaluate(()=>({forced:APP_STATE.currentResult.forced,source:APP_STATE.lastResultSource,calls:fixtureCalls}))).toEqual({forced:true,source:'era',calls:['501']});
  await expect(dock.getByRole('button',{name:'Results',exact:true})).toHaveAttribute('aria-current','page');
  await page.locator('#result-detail-body').getByRole('button',{name:'Leaderboard',exact:true}).click();
  await expect(page.locator('.rank-ledger-row')).toHaveCount(2);
  await expect(page.locator('.nav-item[data-route="era"]')).toHaveAttribute('aria-current','page');
  await expect(dock.getByRole('button',{name:'Results',exact:true})).toHaveAttribute('aria-current','page');
  await page.locator('#page-leaderboard').getByRole('button',{name:'Back',exact:true}).click();
  await page.locator('#page-result-detail').getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.locator('#page-era')).toBeVisible();
  await page.locator('#manual-force-test-id').fill('502');
  await page.locator('#manual-force-test-id').press('Enter');
  await expect(page.locator('.report-mode-note')).toBeVisible();
  expect(await page.evaluate(()=>fixtureCalls)).toEqual(['501','502']);
  for(const[label,id]of[['Classes','timetable'],['Settings','settings'],['Overview','dashboard']]){
    await dock.getByRole('button',{name:label,exact:true}).click();
    await expect(page.locator('#page-'+id)).toBeVisible();
    await expect(dock.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-current','page');
  }
});

test('past unpublished papers are pending, but remain available through forced Results',async({page})=>{
  await open(page);
  await page.evaluate(()=>{
    const records=[{id:601,testName:'Pending fixture paper',examDate:'2020-06-28',isOffline:true,syllabus:'Physics: Mechanics'},{id:602,testName:'Undated fixture paper',examDate:'not a date'}];
    APP_STATE.tests=records;APP_STATE.eraTests=records;nav('examhall');
  });
  await expect(page.locator('#examhall-list .paper-row')).toHaveCount(2);
  await expect(page.locator('#examhall-list .paper-status').first()).toHaveText('Awaiting result');
  await expect(page.locator('#examhall-list .paper-status').last()).toHaveText('Unpublished');
  await expect(page.locator('#examhall-list').getByRole('button',{name:'View Result'})).toHaveCount(0);
  await page.locator('.mobile-dock').getByRole('button',{name:'Results',exact:true}).click();
  await expect(page.locator('#era-list').getByRole('button',{name:'Open result'})).toHaveCount(2);
  await page.locator('#era-list .paper-row').first().getByRole('button',{name:'Open result'}).click();
  await expect(page.locator('[data-score-total]')).toHaveText('216/300');
  expect(await page.evaluate(()=>APP_STATE.currentResult.forced)).toBe(true);
});

for(const width of[360,820,1440])for(const theme of['dark','light']){
  test(`new report instruments and multi-day agenda remain usable: ${width}px ${theme}`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await open(page,width,theme);
    await page.evaluate(()=>nav('result-detail'));
    await expect(page.locator('.result-hero,.subject-result-card')).toHaveCount(0);
    await expect(page.locator('[data-score-total]')).toHaveText('216/300');
    await expect(page.locator('.score-orbit strong')).toHaveText('72%');
    await expect(page.locator('.subject-ledger')).toHaveCount(3);
    await page.locator('.subject-details').first().locator('summary').click();
    await expect(page.locator('.subject-audit').first()).toContainText('Unattempted');
    await fits(page,'.report-console,.report-mast,.score-instrument,.score-instrument-main,.standing-grid,.subject-ledger,.subject-audit');
    await page.evaluate(()=>{
      const records=Array.from({length:5},(_,day)=>APP_STATE.timetable.map(c=>({...c,classDate:new Date(Date.now()+day*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})}))).flat();
      APP_STATE.timetable=records;nav('timetable');
    });
    await expect(page.locator('.agenda-column')).toHaveCount(5);
    await expect(page.locator('#timetable-grid .session-slot')).toHaveCount(15);
    const colours=await page.locator('.agenda-column').first().locator('.session-ticket').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundColor));
    expect(new Set(colours).size).toBe(3);
    await fits(page,'.schedule-board,.agenda-column,.session-slot,.session-ticket');
    await page.evaluate(()=>nav('examhall'));
    await expect(page.locator('#examhall-list .exam-hall-item')).toHaveCount(0);
    await fits(page,'.paper-index,.paper-row,.paper-identity');
    expect(errors).toEqual([]);
  });
}

test('zero, missing and negative scores remain accurate without invalid gauges',async({page})=>{
  await open(page,360);
  for(const[value,total,text,percent]of[[0,180,'0/180','0%'],[-12,180,'-12/180','-6.7%'],[null,null,'—/—','—'],[54,180,'54/180','30%']]){
    await page.evaluate(({value,total})=>{
      nav('result-detail');
      document.getElementById('result-detail-body').innerHTML=buildResultAnalysisHtml({testName:'Edge-case fixture',result:{totalMarks:value,totalSubjectMarks:total}},null);
    },{value,total});
    await expect(page.locator('[data-score-total]')).toHaveText(text);
    await expect(page.locator('.score-orbit strong')).toHaveText(percent);
    await expect(page.locator('.report-console')).not.toContainText('NaN');
    const dash=await page.locator('.orbit-value').getAttribute('stroke-dasharray');
    expect(Number(dash.split(' ')[0])).toBeGreaterThanOrEqual(0);
    expect(Number(dash.split(' ')[0])).toBeLessThanOrEqual(100);
    await fits(page,'.score-instrument-main,.report-console');
  }
});

test('paper titles and unusual IDs remain text and preserve their action arguments',async({page})=>{
  await open(page);
  const id=`501'");window.fixtureInjected=true;//`;
  await page.evaluate(id=>{
    APP_STATE.eraTests=[{id,testName:'<img src=x onerror="fixtureInjected=true">',examDate:'2026-06-28',syllabus:'Mechanics'}];
    window.openEraForcedResult=value=>{window.fixtureClickedId=value};nav('era');
  },id);
  await expect(page.locator('#era-list h2')).toHaveText('<img src=x onerror="fixtureInjected=true">');
  await expect(page.locator('#era-list img')).toHaveCount(0);
  await page.locator('#era-list').getByRole('button',{name:'Open result'}).click();
  expect(await page.evaluate(()=>fixtureClickedId)).toBe(id);
  expect(await page.evaluate(()=>window.fixtureInjected)).toBeUndefined();
});
